import { LLMClient } from "../adkClient";
import { DesignMode } from "../../domain/models";

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
  primaryModes: DesignMode[];
  rationale: string;
}

const buildSelfPrompt = (input: MascotSelfInput) => {
  const frags = input.nearbyFragments.map(f => `- ${f.summary} [${f.tags?.join(", ")}]`).join("\n");
  return `You are the Mascot Agent (Self-Raised Puzzle).
Process aim: ${input.processAim}
User question: ${input.userQuestion}
Nearby fragments:
${frags}
Puzzle summaries: ${input.puzzleSummaries.map(p => p.oneLine).join(" | ")}
Preference hints: ${input.preferenceHints || "none"}

Return JSON: { "centralQuestion": string, "primaryModes": ["FORM"|"MOTION"|"EXPRESSION"|"FUNCTION"], "rationale": string }`;
};

const buildSuggestPrompt = (input: MascotSuggestInput) => {
  const clusters = input.clusters.map(c => `${c.theme} (${c.fragmentCount})`).join(" | ");
  return `You are the Mascot Agent (AI-Suggested Puzzle).
Process aim: ${input.processAim}
Clusters: ${clusters}
Puzzle summaries: ${input.puzzleSummaries.map(p => p.oneLine).join(" | ")}
Preference hints: ${input.preferenceHints || "none"}

If no obvious gap, return { "shouldSuggest": false }.
Otherwise return { "shouldSuggest": true, "centralQuestion": string, "primaryModes": [...], "rationale": string }.`;
};

export const runMascotSelf = async (input: MascotSelfInput, client: LLMClient): Promise<MascotProposal> => {
  try {
    const raw = await client.generate(buildSelfPrompt(input), 0.5);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    return {
      centralQuestion: input.userQuestion || "What is the core feeling we want to preserve?",
      primaryModes: ["EXPRESSION"],
      rationale: "Defaulting to clarifying the feeling because aim mentions tone.",
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
    return parsed;
  } catch {
    return {
      shouldSuggest: true,
      centralQuestion: "Which audience tradeoff are we ignoring?",
      primaryModes: ["FUNCTION"],
      rationale: "Clusters show form-heavy material; function is under-explored.",
    };
  }
};
