import { LLMClient } from "../adkClient";
import { DesignMode, PuzzleType } from "../../domain/models";

export type MascotAction = "start_from_my_question" | "suggest_puzzle" | "reflection";

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
  fragments?: Array<{ id: string; title: string; summary: string; tags?: string[] }>;
}

export interface MascotReflectionInput {
  processAim: string;
  puzzleSummaries: Array<{ title: string; oneLine: string; tags?: string[] }>;
  preferenceProfile: unknown;
}

export interface MascotProposal {
  centralQuestion: string;
  puzzleType: PuzzleType;
  primaryModes: DesignMode[];
  rationale: string;
}

const buildSelfPrompt = (input: MascotSelfInput) => {
  const frags = input.nearbyFragments.map(f => `- ${f.summary} [${f.tags?.join(", ")}]`).join("\n");
  return `You are the Mascot Agent (Self-Raised Puzzle).

CONTEXT:
- Process aim: ${input.processAim}
- User question: ${input.userQuestion}
- Nearby fragments:
${frags}
- Previous puzzles: ${input.puzzleSummaries.map(p => p.oneLine).join(" | ") || "none"}
- Preference hints: ${input.preferenceHints || "none"}

PUZZLE TYPE SELECTION:
Choose the most appropriate puzzle type based on the user's question:
- CLARIFY: Use when the question involves vague terms, fuzzy concepts, or needs sharpening (e.g., "what do we mean by...", "how should we define...")
- EXPAND: Use when the question seeks more options, new angles, or exploration (e.g., "what else could...", "what are other ways...")
- REFINE: Use when there are already ideas but need to converge, prioritize, or decide (e.g., "which should we focus on...", "how do we choose between...")

Return JSON:
{
  "centralQuestion": "A focused question for the puzzle (1-2 sentences)",
  "puzzleType": "CLARIFY" | "EXPAND" | "REFINE",
  "primaryModes": ["FORM"|"MOTION"|"EXPRESSION"|"FUNCTION"],
  "rationale": "Why this puzzle type and focus (1-2 sentences)"
}`;
};

const buildSuggestPrompt = (input: MascotSuggestInput) => {
  const clusters = input.clusters.map(c => `${c.theme} (${c.fragmentCount})`).join(" | ");

  // Build detailed fragment context for insightful reasoning
  const fragmentDetails = input.fragments?.slice(0, 5).map((f, i) =>
    `  ${i + 1}. "${f.title || 'Untitled'}" - ${f.summary || 'No summary'} [${f.tags?.join(", ") || "no tags"}]`
  ).join("\n") || "No fragments available";

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

RATIONALE REQUIREMENTS:
Your rationale MUST:
1. Reference SPECIFIC fragments by TITLE (e.g., "Your 'Brand Colors' fragment...")
2. Explain WHY this puzzle type fits the current situation
3. Be actionable and insightful, not generic

Example GOOD rationale:
"Your 'Matcha Brand Colors' and 'Analog Warmth Reference' fragments both emphasize earthy, natural tones. A CLARIFY puzzle would help define exactly what 'warm' means for this project."

Example BAD rationale (DON'T DO THIS):
"Starting with clarification to establish foundations." (Too generic!)

Example WRONG rationale (NEVER DO THIS - uses ID):
"Based on fragment c2624ed35c1a466cc0488e11f917be7..." (Uses ID instead of title!)

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

export const runMascotSelf = async (input: MascotSelfInput, client: LLMClient): Promise<MascotProposal> => {
  try {
    const raw = await client.generate(buildSelfPrompt(input), 0.5);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    // Ensure puzzleType exists and is valid
    const validTypes = ["CLARIFY", "EXPAND", "REFINE"];
    if (!parsed.puzzleType || !validTypes.includes(parsed.puzzleType)) {
      parsed.puzzleType = "CLARIFY";
    }
    return parsed;
  } catch (err) {
    console.error("[mascotAgent] runMascotSelf failed:", err);
    // Intelligent fallback based on user question keywords
    const q = (input.userQuestion || "").toLowerCase();
    let puzzleType: PuzzleType = "CLARIFY";
    if (q.includes("more") || q.includes("other") || q.includes("expand") || q.includes("explore")) {
      puzzleType = "EXPAND";
    } else if (q.includes("choose") || q.includes("decide") || q.includes("which") || q.includes("prioritize")) {
      puzzleType = "REFINE";
    }
    return {
      centralQuestion: input.userQuestion || "What is the core feeling we want to preserve?",
      puzzleType,
      primaryModes: ["EXPRESSION"],
      rationale: `Focusing on ${puzzleType.toLowerCase()} based on your question.`,
    };
  }
};

export const runMascotSuggest = async (
  input: MascotSuggestInput,
  client: LLMClient,
): Promise<{ shouldSuggest: boolean } & Partial<MascotProposal>> => {
  try {
    const raw = await client.generate(buildSuggestPrompt(input), 0.5);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    // Ensure puzzleType exists and is valid when suggesting
    if (parsed.shouldSuggest) {
      const validTypes = ["CLARIFY", "EXPAND", "REFINE"];
      if (!parsed.puzzleType || !validTypes.includes(parsed.puzzleType)) {
        parsed.puzzleType = "CLARIFY";
      }
    }
    return parsed;
  } catch (err) {
    console.error("[mascotAgent] runMascotSuggest failed:", err);
    // Fallback grounded in ACTUAL fragment content - NOT generic questions
    const fragments = input.fragments || [];
    const clusterCount = input.clusters.length;

    // Extract real keywords from fragments for the question
    const fragmentTitles = fragments.slice(0, 3).map(f => f.title).filter(Boolean);
    const fragmentTags = fragments.flatMap(f => f.tags || []).slice(0, 5);

    // Build question from actual fragment content
    let centralQuestion: string;
    let rationale: string;
    let puzzleType: PuzzleType = "CLARIFY";

    if (fragmentTitles.length > 0) {
      // Create question from fragment titles
      const titleList = fragmentTitles.slice(0, 2).map(t => `"${t}"`).join(" and ");
      centralQuestion = `How do ${titleList} connect to ${input.processAim.split(" ").slice(0, 5).join(" ")}...?`;
      rationale = `Your ${titleList} fragments suggest themes worth clarifying before expanding.`;
    } else if (fragmentTags.length > 0) {
      // Create question from tags
      const tagList = fragmentTags.slice(0, 3).join(", ");
      centralQuestion = `What defines the ${tagList} direction?`;
      rationale = `Tags like ${tagList} from your fragments suggest a theme to clarify.`;
    } else {
      // Minimal fallback indicating AI couldn't generate
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

    return {
      shouldSuggest: true,
      centralQuestion,
      puzzleType,
      primaryModes: ["EXPRESSION", "FUNCTION"],
      rationale,
    };
  }
};
