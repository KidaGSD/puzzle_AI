/**
 * MascotAgent - ADK Entry Point for Puzzle Creation
 *
 * Two modes:
 * - runMascotSelf: User asks question → Mascot proposes puzzle (type, question, modes)
 * - runMascotSuggest: AI proactively suggests puzzle based on canvas fragments
 *
 * This is the entry point to the puzzle workflow. After user confirms,
 * PUZZLE_SESSION_STARTED is emitted which triggers the QuadrantManager pipeline.
 */

import { LLMClient } from "../../adkClient";
import { DesignMode, PuzzleType } from "../../../domain/models";

// ========== Input/Output Types ==========

export interface MascotSelfInput {
  processAim: string;
  userQuestion: string;
  nearbyFragments: Array<{ summary: string; tags: string[] }>;
  puzzleSummaries: Array<{ id: string; title: string; oneLine: string }>;
  preferenceHints?: string;
}

export interface MascotSuggestInput {
  processAim: string;
  clusters: Array<{ id: string; theme: string; fragmentCount: number }>;
  puzzleSummaries: Array<{ id: string; title: string; oneLine: string }>;
  preferenceHints?: string;
  // Fragment details for insightful reasoning
  fragments?: Array<{
    id: string;
    title: string;
    summary: string;
    tags?: string[];
    keywords?: string[];
    themes?: string[];
  }>;
}

export interface MascotProposal {
  centralQuestion: string;
  puzzleType: PuzzleType;
  primaryModes: DesignMode[];
  rationale: string;
}

export interface MascotSuggestOutput {
  shouldSuggest: boolean;
  centralQuestion?: string;
  puzzleType?: PuzzleType;
  primaryModes?: DesignMode[];
  rationale?: string;
}

// ========== Prompt Builders ==========

const buildSelfPrompt = (input: MascotSelfInput): string => {
  const frags = input.nearbyFragments
    .map(f => `- ${f.summary} [${f.tags?.join(", ")}]`)
    .join("\n");

  return `You are the Mascot Agent (Self-Raised Puzzle).

CONTEXT:
- Process aim: ${input.processAim}
- User question: ${input.userQuestion}
- Nearby fragments:
${frags || "No fragments available"}
- Previous puzzles: ${input.puzzleSummaries.map(p => p.oneLine).join(" | ") || "none"}
- Preference hints: ${input.preferenceHints || "none"}

PUZZLE TYPE SELECTION:
Choose the most appropriate puzzle type based on the user's question:
- CLARIFY: Use when the question involves vague terms, fuzzy concepts, or needs sharpening (e.g., "what do we mean by...", "how should we define...")
- EXPAND: Use when the question seeks more options, new angles, or exploration (e.g., "what else could...", "what are other ways...")
- REFINE: Use when there are already ideas but need to converge, prioritize, or decide (e.g., "which should we focus on...", "how do we choose between...")

PRIMARY MODES SELECTION:
Based on the question, select 1-2 quadrants that are most relevant:
- FORM: When the question is about shape, structure, visual composition, texture, layout
- MOTION: When the question is about pacing, rhythm, animation, transitions, timing
- EXPRESSION: When the question is about mood, tone, emotion, personality, cultural feel
- FUNCTION: When the question is about audience, purpose, constraints, usability, context

Return JSON:
{
  "centralQuestion": "A focused question for the puzzle (1-2 sentences)",
  "puzzleType": "CLARIFY" | "EXPAND" | "REFINE",
  "primaryModes": ["FORM"|"MOTION"|"EXPRESSION"|"FUNCTION"],
  "rationale": "Why this puzzle type and focus (1-2 sentences, referencing fragments)"
}`;
};

const buildSuggestPrompt = (input: MascotSuggestInput): string => {
  const clusters = input.clusters
    .map(c => `${c.theme} (${c.fragmentCount})`)
    .join(" | ");

  // Build detailed fragment context for insightful reasoning
  const fragmentDetails = input.fragments?.slice(0, 5).map((f, i) => {
    const keywords = f.keywords?.slice(0, 4).join(", ") || "";
    const themes = f.themes?.slice(0, 3).join(", ") || "";
    return `  ${i + 1}. "${f.title || 'Untitled'}" - ${f.summary || 'No summary'} [${f.tags?.join(", ") || "no tags"}]${keywords ? ` | Keywords: ${keywords}` : ""}${themes ? ` | Themes: ${themes}` : ""}`;
  }).join("\n") || "No fragments available";

  return `You are the Mascot Agent (AI-Suggested Puzzle).

CONTEXT:
- Process aim: ${input.processAim}
- Fragment clusters: ${clusters || "none"}
- Previous puzzles: ${input.puzzleSummaries.map(p => p.oneLine).join(" | ") || "none"}
- Preference hints: ${input.preferenceHints || "none"}

DETAILED FRAGMENTS ON CANVAS:
${fragmentDetails}

TASK:
Analyze the context and SPECIFIC fragments to suggest a meaningful puzzle.

PUZZLE TYPE SELECTION:
- CLARIFY: When concepts are vague or need definition
- EXPAND: When exploration is thin or needs new angles
- REFINE: When there are many ideas but need to converge

═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL - FRAGMENT REFERENCE RULES (READ CAREFULLY):
═══════════════════════════════════════════════════════════════════════════════

1. ALWAYS refer to fragments by their TITLE in quotes, e.g., "Your 'Matcha Brand Colors' fragment..."
2. NEVER use fragment IDs (UUIDs like "c2624ed35c1a466cc0488e11f917be7") in your response
3. If a fragment has no title, describe it by its content type: "Your image fragment showing..."
4. Your rationale MUST mention specific fragment TITLES, not IDs
5. Use keywords and themes from fragments to craft specific questions

RATIONALE REQUIREMENTS:
Your rationale MUST:
1. Reference SPECIFIC fragments by TITLE (e.g., "Your 'Brand Colors' fragment...")
2. Explain WHY this puzzle type fits the current situation
3. Be actionable and insightful, not generic

Example GOOD rationale:
"Your 'Matcha Brand Colors' and 'Analog Warmth Reference' fragments both emphasize earthy, natural tones. A CLARIFY puzzle would help define exactly what 'warm' means for this project."

Example BAD rationale (DON'T DO THIS):
"Starting with clarification to establish foundations." (Too generic!)

If no obvious gap or need, return: { "shouldSuggest": false }

Otherwise return:
{
  "shouldSuggest": true,
  "centralQuestion": "A focused question (1-2 sentences)",
  "puzzleType": "CLARIFY" | "EXPAND" | "REFINE",
  "primaryModes": ["FORM"|"MOTION"|"EXPRESSION"|"FUNCTION"],
  "rationale": "Specific, fragment-citing explanation (2-3 sentences)"
}`;
};

// ========== Agent Runners ==========

/**
 * Run Mascot for user-raised question
 * User asks a question → Mascot proposes a puzzle
 */
export const runMascotSelf = async (
  input: MascotSelfInput,
  client: LLMClient
): Promise<MascotProposal> => {
  console.log(`[MascotAgent:Self] Processing user question: "${input.userQuestion.slice(0, 50)}..."`);

  try {
    const raw = await client.generate(buildSelfPrompt(input), 0.5);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate puzzleType
    const validTypes = ["CLARIFY", "EXPAND", "REFINE"];
    if (!parsed.puzzleType || !validTypes.includes(parsed.puzzleType)) {
      parsed.puzzleType = "CLARIFY";
    }

    // Validate primaryModes
    const validModes = ["FORM", "MOTION", "EXPRESSION", "FUNCTION"];
    if (!parsed.primaryModes || !Array.isArray(parsed.primaryModes)) {
      parsed.primaryModes = ["EXPRESSION"];
    } else {
      parsed.primaryModes = parsed.primaryModes.filter((m: string) => validModes.includes(m));
      if (parsed.primaryModes.length === 0) {
        parsed.primaryModes = ["EXPRESSION"];
      }
    }

    console.log(`[MascotAgent:Self] Proposal: type=${parsed.puzzleType}, modes=${parsed.primaryModes.join(",")}`);

    return parsed as MascotProposal;
  } catch (err) {
    console.error("[MascotAgent:Self] Failed:", err);

    // Intelligent fallback based on user question keywords
    const q = (input.userQuestion || "").toLowerCase();
    let puzzleType: PuzzleType = "CLARIFY";
    let primaryModes: DesignMode[] = ["EXPRESSION"];

    if (q.includes("more") || q.includes("other") || q.includes("expand") || q.includes("explore")) {
      puzzleType = "EXPAND";
    } else if (q.includes("choose") || q.includes("decide") || q.includes("which") || q.includes("prioritize")) {
      puzzleType = "REFINE";
    }

    // Mode detection from question
    if (q.includes("shape") || q.includes("layout") || q.includes("structure") || q.includes("visual")) {
      primaryModes = ["FORM"];
    } else if (q.includes("animation") || q.includes("motion") || q.includes("rhythm") || q.includes("timing")) {
      primaryModes = ["MOTION"];
    } else if (q.includes("audience") || q.includes("user") || q.includes("purpose") || q.includes("function")) {
      primaryModes = ["FUNCTION"];
    }

    return {
      centralQuestion: input.userQuestion || "What is the core feeling we want to preserve?",
      puzzleType,
      primaryModes,
      rationale: `Focusing on ${puzzleType.toLowerCase()} based on your question.`,
    };
  }
};

/**
 * Run Mascot for AI-suggested puzzle
 * AI proactively analyzes fragments and suggests a puzzle
 */
export const runMascotSuggest = async (
  input: MascotSuggestInput,
  client: LLMClient
): Promise<MascotSuggestOutput> => {
  console.log(`[MascotAgent:Suggest] Analyzing ${input.fragments?.length || 0} fragments, ${input.clusters.length} clusters`);

  try {
    const raw = await client.generate(buildSuggestPrompt(input), 0.5);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate if suggesting
    if (parsed.shouldSuggest) {
      const validTypes = ["CLARIFY", "EXPAND", "REFINE"];
      if (!parsed.puzzleType || !validTypes.includes(parsed.puzzleType)) {
        parsed.puzzleType = "CLARIFY";
      }

      const validModes = ["FORM", "MOTION", "EXPRESSION", "FUNCTION"];
      if (!parsed.primaryModes || !Array.isArray(parsed.primaryModes)) {
        parsed.primaryModes = ["EXPRESSION"];
      } else {
        parsed.primaryModes = parsed.primaryModes.filter((m: string) => validModes.includes(m));
        if (parsed.primaryModes.length === 0) {
          parsed.primaryModes = ["EXPRESSION"];
        }
      }

      console.log(`[MascotAgent:Suggest] Proposing: "${parsed.centralQuestion?.slice(0, 40)}..." type=${parsed.puzzleType}`);
    } else {
      console.log(`[MascotAgent:Suggest] No suggestion needed`);
    }

    return parsed as MascotSuggestOutput;
  } catch (err) {
    console.error("[MascotAgent:Suggest] Failed:", err);

    // Fallback grounded in ACTUAL fragment content
    const fragments = input.fragments || [];
    const clusterCount = input.clusters.length;

    // Extract real data from fragments
    const fragmentTitles = fragments.slice(0, 3).map(f => f.title).filter(Boolean);
    const fragmentKeywords = fragments.flatMap(f => f.keywords || []).slice(0, 5);
    const fragmentThemes = fragments.flatMap(f => f.themes || []).slice(0, 3);
    const fragmentTags = fragments.flatMap(f => f.tags || []).slice(0, 5);

    // Build question from actual fragment content
    let centralQuestion: string;
    let rationale: string;
    let puzzleType: PuzzleType = "CLARIFY";
    let primaryModes: DesignMode[] = ["EXPRESSION", "FUNCTION"];

    if (fragmentTitles.length > 0) {
      const titleList = fragmentTitles.slice(0, 2).map(t => `"${t}"`).join(" and ");
      centralQuestion = `How do ${titleList} connect to ${input.processAim.split(" ").slice(0, 5).join(" ")}...?`;
      rationale = `Your ${titleList} fragments suggest themes worth clarifying before expanding.`;
    } else if (fragmentKeywords.length > 0) {
      const keywordList = fragmentKeywords.slice(0, 3).join(", ");
      centralQuestion = `What defines the ${keywordList} direction?`;
      rationale = `Keywords like ${keywordList} from your fragments suggest a direction to clarify.`;
    } else if (fragmentThemes.length > 0) {
      const themeList = fragmentThemes.slice(0, 2).join(" and ");
      centralQuestion = `How should ${themeList} shape this project?`;
      rationale = `Themes of ${themeList} need clarification.`;
    } else if (fragmentTags.length > 0) {
      const tagList = fragmentTags.slice(0, 3).join(", ");
      centralQuestion = `What defines the ${tagList} direction?`;
      rationale = `Tags like ${tagList} from your fragments suggest a theme to clarify.`;
    } else {
      centralQuestion = `What's the core direction for: ${input.processAim.slice(0, 50)}?`;
      rationale = "Add more fragments to get more specific puzzle suggestions.";
    }

    // Adjust puzzle type based on cluster count
    if (clusterCount > 3) {
      puzzleType = "REFINE";
      centralQuestion = fragmentTitles.length > 0
        ? `Which direction between ${fragmentTitles.slice(0, 2).map(t => `"${t}"`).join(" vs ")} fits best?`
        : `Which of your ${clusterCount} themes should we prioritize?`;
      rationale = `With ${clusterCount} clusters, it's time to converge.`;
    }

    // Determine primary modes from content
    const allContent = [...fragmentKeywords, ...fragmentThemes, ...fragmentTags].join(" ").toLowerCase();
    if (allContent.includes("shape") || allContent.includes("structure") || allContent.includes("layout")) {
      primaryModes = ["FORM", "EXPRESSION"];
    } else if (allContent.includes("motion") || allContent.includes("animation") || allContent.includes("rhythm")) {
      primaryModes = ["MOTION", "EXPRESSION"];
    } else if (allContent.includes("audience") || allContent.includes("user") || allContent.includes("purpose")) {
      primaryModes = ["FUNCTION", "EXPRESSION"];
    }

    return {
      shouldSuggest: fragments.length > 0,
      centralQuestion,
      puzzleType,
      primaryModes,
      rationale,
    };
  }
};

export default {
  runMascotSelf,
  runMascotSuggest
};
