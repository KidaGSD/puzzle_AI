/**
 * SynthesisAgent - ADK End Stage for Puzzle Completion
 *
 * Generates a comprehensive summary when a puzzle session ends.
 *
 * Synthesizes:
 * - Title (3-5 words)
 * - One-line summary
 * - Direction statement (1-2 sentences)
 * - Key reasons (3-5 bullets drawn from placed pieces)
 * - Open questions (optional)
 * - Tags for organization
 */

import { LLMClient } from "../../adkClient";
import { PuzzleType, Anchor, UUID, PuzzleSummary } from "../../../domain/models";

// ========== Input/Output Types ==========

export interface SynthesisInput {
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
    fragmentTitle?: string;
    fragmentSummary?: string;
  }>;
}

export interface SynthesisOutput extends PuzzleSummary {
  keyInsights?: string[];
  nextSteps?: string[];
}

// ========== Prompt Builder ==========

const buildSynthesisPrompt = (input: SynthesisInput): string => {
  const startingAnchor = input.anchors.find(a => a.type === 'STARTING');
  const solutionAnchor = input.anchors.find(a => a.type === 'SOLUTION');

  // Group pieces by quadrant for better context
  const piecesByQuadrant: Record<string, string[]> = {};
  for (const p of input.placedPieces) {
    const q = p.quadrant.toUpperCase();
    if (!piecesByQuadrant[q]) piecesByQuadrant[q] = [];

    let pieceDesc = `"${p.text}"`;
    if (p.userAnnotation) {
      pieceDesc += ` (user note: "${p.userAnnotation}")`;
    }
    if (p.fragmentTitle) {
      pieceDesc += ` [from: ${p.fragmentTitle}]`;
    }
    piecesByQuadrant[q].push(pieceDesc);
  }

  const piecesContext = Object.entries(piecesByQuadrant)
    .map(([quadrant, pieces]) => `${quadrant}:\n  ${pieces.join('\n  ')}`)
    .join('\n\n');

  const anchorsContext = [
    startingAnchor ? `WHY (Starting Point): "${startingAnchor.text}"` : null,
    solutionAnchor ? `WHAT (Solution Direction): "${solutionAnchor.text}"` : null,
  ].filter(Boolean).join('\n');

  return `You are the Puzzle Synthesis Agent. Synthesize insights from a completed puzzle session.

CONTEXT:
- Puzzle Type: ${input.puzzleType}
- Central Question: "${input.centralQuestion}"
- Process Aim: ${input.processAim}

${anchorsContext ? `ANCHORS:\n${anchorsContext}\n` : ''}

PLACED PIECES BY QUADRANT:
${piecesContext || 'No pieces placed yet'}

PUZZLE TYPE GUIDANCE:
- CLARIFY puzzles should result in sharper, more concrete definitions
- EXPAND puzzles should surface new possibilities and perspectives
- REFINE puzzles should result in clear prioritization decisions

QUADRANT MEANING:
- FORM: Visual structure, shape, composition, texture
- MOTION: Pacing, rhythm, animation, transitions
- EXPRESSION: Mood, tone, emotion, personality
- FUNCTION: Audience, purpose, constraints, usability

SYNTHESIS REQUIREMENTS:
1. Title should capture the essence in 3-5 words
2. One-line summary should be actionable
3. Direction statement should feel like a CONCLUSION, not a repeat of the question
4. Reasons should be drawn from the placed pieces and their quadrants
5. Key insights should connect pieces across quadrants
6. Next steps should be concrete actions

Generate JSON:
{
  "title": "Short title (3-5 words)",
  "oneLine": "Single sentence summary of the direction",
  "directionStatement": "1-2 sentence direction statement that synthesizes the exploration",
  "reasons": ["Reason 1 (brief)", "Reason 2", "Reason 3"],
  "keyInsights": ["Insight connecting quadrants", "Another insight"],
  "nextSteps": ["Concrete next action", "Another action"],
  "openQuestions": ["Optional question that remains open"],
  "tags": ["tag1", "tag2", "tag3"]
}

Important:
- Reasons should cite specific pieces from the quadrants
- Keep reasons brief (under 15 words each)
- Open questions are optional - only include if genuinely unresolved
- Tags should be 2-4 keywords for organizing`;
};

// ========== Fallback Generator ==========

const getFallbackSummary = (input: SynthesisInput): SynthesisOutput => {
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

  // Extract keywords from pieces for tags
  const tags = new Set<string>([input.puzzleType.toLowerCase()]);
  for (const p of input.placedPieces) {
    const words = p.text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    words.slice(0, 2).forEach(w => tags.add(w));
  }

  return {
    puzzleId: input.puzzleId,
    title: `${input.puzzleType} Exploration`,
    oneLine: direction.slice(0, 100),
    directionStatement: direction,
    reasons,
    keyInsights: [],
    nextSteps: ['Review the placed pieces', 'Consider starting a follow-up puzzle'],
    openQuestions: [],
    tags: Array.from(tags).slice(0, 4),
    createdAt: Date.now(),
  };
};

// ========== Agent Runner ==========

/**
 * Run Synthesis Agent to generate puzzle summary
 */
export const runSynthesisAgent = async (
  input: SynthesisInput,
  client: LLMClient
): Promise<SynthesisOutput> => {
  console.log(`[SynthesisAgent] Synthesizing puzzle: ${input.puzzleId}, ${input.placedPieces.length} pieces`);

  try {
    const prompt = buildSynthesisPrompt(input);
    const raw = await client.generate(prompt, 0.6);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (!parsed.directionStatement || !parsed.reasons) {
      throw new Error("Missing required fields in response");
    }

    const result: SynthesisOutput = {
      puzzleId: input.puzzleId,
      title: parsed.title || `${input.puzzleType} Exploration`,
      oneLine: parsed.oneLine || parsed.directionStatement.slice(0, 100),
      directionStatement: parsed.directionStatement,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
      openQuestions: Array.isArray(parsed.openQuestions) ? parsed.openQuestions : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags : [input.puzzleType.toLowerCase()],
      createdAt: Date.now(),
    };

    console.log(`[SynthesisAgent] Generated summary: "${result.title}"`);

    return result;
  } catch (err) {
    console.error("[SynthesisAgent] Failed to generate summary:", err);
    return getFallbackSummary(input);
  }
};

/**
 * Alias for backward compatibility with runner.ts
 */
export const synthesizePuzzle = runSynthesisAgent;

export default {
  runSynthesisAgent,
  synthesizePuzzle
};
