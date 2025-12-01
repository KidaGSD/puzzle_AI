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
  return `You are the Mascot Agent (AI-Suggested Puzzle).

CONTEXT:
- Process aim: ${input.processAim}
- Fragment clusters: ${clusters || "none"}
- Previous puzzles: ${input.puzzleSummaries.map(p => p.oneLine).join(" | ") || "none"}
- Preference hints: ${input.preferenceHints || "none"}

TASK:
Analyze the context and suggest a puzzle that would help the user make progress.

PUZZLE TYPE SELECTION:
- CLARIFY: When concepts are vague or need definition
- EXPAND: When exploration is thin or needs new angles
- REFINE: When there are many ideas but need to converge

If no obvious gap or need, return: { "shouldSuggest": false }

Otherwise return:
{
  "shouldSuggest": true,
  "centralQuestion": "A focused question (1-2 sentences)",
  "puzzleType": "CLARIFY" | "EXPAND" | "REFINE",
  "primaryModes": ["FORM"|"MOTION"|"EXPRESSION"|"FUNCTION"],
  "rationale": "Why this puzzle now (1-2 sentences)"
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
    // Intelligent fallback based on context
    const clusterCount = input.clusters.length;
    const puzzleCount = input.puzzleSummaries.length;

    // Decide puzzle type based on context
    let puzzleType: PuzzleType = "CLARIFY";
    let centralQuestion = "What does this project's core identity feel like?";
    let rationale = "Starting with clarification to establish foundations.";

    if (clusterCount > 3) {
      puzzleType = "REFINE";
      centralQuestion = "Which direction should we prioritize from these ideas?";
      rationale = "Multiple clusters suggest it's time to converge.";
    } else if (puzzleCount === 0) {
      puzzleType = "EXPAND";
      centralQuestion = "What possibilities haven't we considered yet?";
      rationale = "No previous puzzles - let's explore the space first.";
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
