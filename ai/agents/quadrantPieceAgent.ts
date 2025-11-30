import { DesignMode, PuzzlePieceCategory } from "../../domain/models";
import { LLMClient } from "../adkClient";

export interface QuadrantPieceInput {
  processAim: string;
  mode: DesignMode;
  category: PuzzlePieceCategory | "CONNECT";
  puzzle: { id: string; centralQuestion: string };
  anchors: Array<{ type: string; text: string }>;
  existingPiecesForMode: Array<{
    category: PuzzlePieceCategory | "CONNECT";
    text: string;
    userAnnotation?: string;
    status: string;
  }>;
  preferenceHint?: string;
}

export interface QuadrantPieceOutput {
  pieces: Array<{
    mode: DesignMode;
    category: PuzzlePieceCategory | "CONNECT";
    text: string;
    internalNote?: string;
  }>;
}

const buildPrompt = (input: QuadrantPieceInput) => {
  const existing = input.existingPiecesForMode.map(p => `${p.category}: ${p.text}`).join(" | ");
  return `You are the Quadrant Piece Agent.
Mode: ${input.mode}
Category: ${input.category}
Process aim: ${input.processAim}
Central question: ${input.puzzle.centralQuestion}
Anchors: ${input.anchors.map(a => `${a.type}:${a.text}`).join(" | ")}
Existing pieces: ${existing}
Preference hint: ${input.preferenceHint || "none"}

Return JSON: { "pieces": [{ "mode": "...", "category": "...", "text": "...", "internalNote": "optional" }] }`;
};

export const runQuadrantPieceAgent = async (
  input: QuadrantPieceInput,
  client: LLMClient,
): Promise<QuadrantPieceOutput> => {
  try {
    const raw = await client.generate(buildPrompt(input), 0.6);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    return {
      pieces: [
        {
          mode: input.mode,
          category: input.category,
          text: input.category === "CLARIFY"
            ? "Name the one specific quality you mean here."
            : input.category === "REFINE"
              ? "Pick one element to keep, one to drop."
              : "Add a fresh angle that contrasts current notes.",
        },
      ],
    };
  }
};
