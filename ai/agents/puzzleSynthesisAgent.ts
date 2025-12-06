/**
 * PuzzleSynthesisAgent - Generates a summary when a puzzle session ends
 *
 * Synthesizes:
 * - Direction statement (1-2 sentences)
 * - Key reasons (3-5 bullets)
 * - Open questions (optional)
 */

import {
  PuzzleSummary,
  PuzzleType,
  Anchor,
  UUID,
} from "../../domain/models";
import { Piece } from "../../types";
import { LLMClient } from "../adkClient";

export interface PuzzleSynthesisInput {
  puzzleId: UUID;
  puzzleType: PuzzleType;
  centralQuestion: string;
  processAim: string;
  anchors: Anchor[];
  placedPieces: Array<{
    quadrant: string;
    text: string;
    content?: string;
    userAnnotation?: string;
  }>;
}

export interface PuzzleSynthesisOutput extends PuzzleSummary {}

const buildPrompt = (input: PuzzleSynthesisInput): string => {
  const startingAnchor = input.anchors.find(a => a.type === 'STARTING');
  const solutionAnchor = input.anchors.find(a => a.type === 'SOLUTION');

  const piecesContext = input.placedPieces
    .map((p, i) => {
      let piece = `${i + 1}. [${p.quadrant.toUpperCase()}] "${p.text}"`;
      if (p.userAnnotation) {
        piece += `\n   User note: "${p.userAnnotation}"`;
      }
      return piece;
    })
    .join('\n');

  const anchorsContext = [
    startingAnchor ? `WHY (Starting): "${startingAnchor.text}"` : null,
    solutionAnchor ? `WHAT (Solution): "${solutionAnchor.text}"` : null,
  ].filter(Boolean).join('\n');

  return `You are the Puzzle Synthesis Agent. Your task is to synthesize insights from a completed puzzle session.

CONTEXT:
- Puzzle Type: ${input.puzzleType}
- Central Question: "${input.centralQuestion}"
- Process Aim: ${input.processAim}

${anchorsContext ? `ANCHORS:\n${anchorsContext}\n` : ''}

PLACED PIECES (by quadrant):
${piecesContext || 'No pieces placed yet'}

PUZZLE TYPE GUIDANCE:
- CLARIFY puzzles should result in sharper, more concrete definitions
- EXPAND puzzles should surface new possibilities and perspectives
- REFINE puzzles should result in clear prioritization decisions

TASK:
Synthesize the puzzle exploration into a coherent summary.

Generate a JSON response:
{
  "title": "Short title (3-5 words)",
  "oneLine": "Single sentence summary of the direction",
  "directionStatement": "1-2 sentence direction statement that synthesizes the exploration",
  "reasons": ["Reason 1 (brief)", "Reason 2", "Reason 3"],
  "openQuestions": ["Optional question that remains open"],
  "tags": ["tag1", "tag2", "tag3"]
}

Important:
- The direction statement should feel like a CONCLUSION, not a repeat of the question
- Reasons should be drawn from the placed pieces and their quadrants
- Keep reasons brief (under 15 words each)
- Open questions are optional - only include if genuinely unresolved
- Tags should be 2-4 keywords for organizing`;
};

const getFallbackSummary = (input: PuzzleSynthesisInput): PuzzleSummary => {
  const solutionAnchor = input.anchors.find(a => a.type === 'SOLUTION');

  // Build direction from solution anchor or central question
  const direction = solutionAnchor?.text
    ? `Direction: ${solutionAnchor.text}`
    : `Based on exploring "${input.centralQuestion}", further exploration is needed.`;

  // Build reasons from placed pieces
  const reasons = input.placedPieces.slice(0, 4).map(p =>
    `${p.quadrant}: ${p.text}`
  );

  if (reasons.length === 0) {
    reasons.push('No pieces were placed during this session');
  }

  return {
    puzzleId: input.puzzleId,
    title: `${input.puzzleType} Puzzle`,
    oneLine: direction.slice(0, 100),
    directionStatement: direction,
    reasons,
    openQuestions: [],
    tags: [input.puzzleType.toLowerCase()],
    createdAt: Date.now(),
  };
};

export const runPuzzleSynthesisAgent = async (
  input: PuzzleSynthesisInput,
  client: LLMClient,
): Promise<PuzzleSynthesisOutput> => {
  try {
    const prompt = buildPrompt(input);
    const raw = await client.generate(prompt, 0.6);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.directionStatement || !parsed.reasons) {
      throw new Error("Missing required fields in response");
    }

    return {
      puzzleId: input.puzzleId,
      title: parsed.title || `${input.puzzleType} Puzzle`,
      oneLine: parsed.oneLine || parsed.directionStatement.slice(0, 100),
      directionStatement: parsed.directionStatement,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [input.puzzleType.toLowerCase()],
      createdAt: Date.now(),
    };
  } catch (err) {
    console.error("[PuzzleSynthesisAgent] Failed to generate summary:", err);
    return getFallbackSummary(input);
  }
};
