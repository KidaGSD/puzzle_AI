import { AnchorType, DesignMode, PuzzlePieceCategory } from "../../domain/models";
import { LLMClient } from "../adkClient";

export type DesignerTask = "design" | "summarize";

export interface DesignerDesignInput {
  task: "design";
  processAim: string;
  proposedCentralQuestion: string;
  primaryModes: DesignMode[];
  rationaleFromMascot: string;
  relatedClusters: Array<{ theme: string; fragmentSummaries: string[] }>;
  relatedPuzzleSummaries: Array<{ title: string; oneLine: string }>;
}

export interface DesignerSummarizeInput {
  task: "summarize";
  processAim: string;
  puzzle: { id: string; centralQuestion: string };
  anchors: Array<{ type: AnchorType; text: string }>;
  pieces: Array<{
    id: string;
    mode: DesignMode;
    category: PuzzlePieceCategory;
    text: string;
    userAnnotation?: string;
    status: string;
    attachedAnchorTypes: AnchorType[];
  }>;
}

export interface DesignerDesignOutput {
  centralQuestion: string;
  anchors: { starting: string; solution: string };
  seedPieces: Array<{ mode: DesignMode; category: PuzzlePieceCategory; text: string }>;
}

export interface DesignerSummaryOutput {
  directionStatement: string;
  reasons: string[];
  openQuestions?: string[];
}

const buildDesignPrompt = (input: DesignerDesignInput) => {
  return `You are the Puzzle Designer Agent (task: "design").
Process aim: ${input.processAim}
Proposed central question: ${input.proposedCentralQuestion}
Primary modes: ${input.primaryModes.join(",")}
Rationale from mascot: ${input.rationaleFromMascot}
Related clusters: ${input.relatedClusters.map(c => c.theme).join(" | ")}
Related puzzle summaries: ${input.relatedPuzzleSummaries.map(p => p.oneLine).join(" | ")}

Return JSON:
{
  "centralQuestion": string,
  "anchors": { "starting": string, "solution": string },
  "seedPieces": [{ "mode": "FORM"|"MOTION"|"EXPRESSION"|"FUNCTION", "category": "CLARIFY"|"EXPAND"|"REFINE", "text": string }]
}`;
};

const buildSummarizePrompt = (input: DesignerSummarizeInput) => {
  const anchorText = input.anchors.map(a => `${a.type}: ${a.text}`).join(" | ");
  const pieceText = input.pieces.map(p => `${p.mode}/${p.category}: ${p.text} :: ${p.userAnnotation || ""}`).join("\n");
  return `You are the Puzzle Designer Agent (task: "summarize").
Process aim: ${input.processAim}
Central question: ${input.puzzle.centralQuestion}
Anchors: ${anchorText}
Pieces:
${pieceText}

Return JSON:
{
  "directionStatement": string,
  "reasons": [string],
  "openQuestions": [string]
}`;
};

export const runPuzzleDesignerAgent = async (
  input: DesignerDesignInput | DesignerSummarizeInput,
  client: LLMClient,
): Promise<DesignerDesignOutput | DesignerSummaryOutput> => {
  const prompt = input.task === "design" ? buildDesignPrompt(input) : buildSummarizePrompt(input as DesignerSummarizeInput);
  try {
    const raw = await client.generate(prompt, 0.5);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    if (input.task === "design") {
      return {
        centralQuestion: (input as DesignerDesignInput).proposedCentralQuestion,
        anchors: { starting: "Why this matters now", solution: "" },
        seedPieces: (input as DesignerDesignInput).primaryModes.slice(0, 1).map(mode => ({
          mode,
          category: "CLARIFY",
          text: "What is the crisp version of this idea?",
        })),
      };
    }
    return {
      directionStatement: "Analog-warm direction with calm motion.",
      reasons: ["Process aim suggests analog warmth", "Notes emphasize retro cues"],
      openQuestions: ["Confirm audience/channel"],
    };
  }
};
