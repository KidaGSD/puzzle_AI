/**
 * PuzzleSessionAgent - Coordinator for multi-agent puzzle generation
 *
 * Responsibilities:
 * 1. Synthesize central question from process_aim + fragments
 * 2. Orchestrate parallel execution of 4 quadrant agents
 * 3. Aggregate outputs into PuzzleSessionState
 * 4. Handle failures with fallbacks
 */

import { v4 as uuidv4 } from "uuid";
import {
  PuzzleSessionInput,
  PuzzleSessionState,
  QuadrantAgentInput,
  QuadrantAgentOutput,
  QuadrantAgentPiece,
  PuzzleType,
  Anchor,
  FragmentSummary,
} from "../../domain/models";
import { LLMClient } from "../adkClient";
import { runFormQuadrantAgent } from "./formQuadrantAgent";
import { runMotionQuadrantAgent } from "./motionQuadrantAgent";
import { runExpressionQuadrantAgent } from "./expressionQuadrantAgent";
import { runFunctionQuadrantAgent } from "./functionQuadrantAgent";

// ========== Configuration ==========

const DEFAULT_PIECES_PER_QUADRANT = 5;
const DEFAULT_MAX_CHARS_PER_QUADRANT = 300;
const DEFAULT_TIMEOUT_MS = 15000;

// ========== Central Question Generation ==========

const buildCentralQuestionPrompt = (input: PuzzleSessionInput): string => {
  const fragmentContext = input.fragments_summary
    .slice(0, 8)
    .map((f, i) => `  ${i + 1}. "${f.summary}" [${f.tags?.join(", ") || "none"}]`)
    .join("\n");

  const previousPuzzles = input.previous_puzzle_summaries
    .slice(0, 3)
    .map((p) => `  - ${p.title || p.directionStatement}`)
    .join("\n");

  return `You are the Puzzle Session Agent for a design thinking puzzle app.

TASK: Generate a compelling central question for a ${input.puzzle_type} puzzle session.

Context:
- Process aim: ${input.process_aim}
- Puzzle type: ${input.puzzle_type}
${fragmentContext ? `\nRelevant fragments from canvas:\n${fragmentContext}` : ""}
${previousPuzzles ? `\nPrevious puzzle directions:\n${previousPuzzles}` : ""}

PUZZLE TYPE GUIDANCE:
- CLARIFY: Ask questions that help sharpen vague ideas into concrete statements
- EXPAND: Ask questions that open up new perspectives and possibilities
- REFINE: Ask questions that help prioritize and make decisions

The central question should:
1. Be concise (under 15 words)
2. Inspire thoughtful exploration
3. Connect to the process aim
4. Be appropriate for the ${input.puzzle_type} puzzle type

Return ONLY valid JSON:
{ "central_question": "Your question here?" }`;
};

const generateCentralQuestion = async (
  input: PuzzleSessionInput,
  client: LLMClient
): Promise<string> => {
  try {
    const prompt = buildCentralQuestionPrompt(input);
    const raw = await client.generate(prompt, 0.7);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.central_question || getDefaultCentralQuestion(input.puzzle_type);
  } catch (error) {
    console.error("[PuzzleSessionAgent] Failed to generate central question:", error);
    return getDefaultCentralQuestion(input.puzzle_type);
  }
};

const getDefaultCentralQuestion = (puzzleType: PuzzleType): string => {
  const defaults: Record<PuzzleType, string> = {
    CLARIFY: "What's the core essence we need to define?",
    EXPAND: "What possibilities haven't we explored yet?",
    REFINE: "Which direction should we commit to?",
  };
  return defaults[puzzleType];
};

// ========== Quadrant Agent Orchestration ==========

interface QuadrantResult {
  mode: "FORM" | "MOTION" | "EXPRESSION" | "FUNCTION";
  pieces: QuadrantAgentPiece[];
  success: boolean;
  error?: string;
}

const buildQuadrantInput = (
  input: PuzzleSessionInput,
  centralQuestion: string,
  anchors: Anchor[]
): Omit<QuadrantAgentInput, "mode"> => ({
  puzzle_type: input.puzzle_type,
  central_question: centralQuestion,
  process_aim: input.process_aim,
  anchors,
  // Pass fragments with title for AI to reference
  relevant_fragments: input.fragments_summary.slice(0, 5).map(f => ({
    ...f,
    title: f.title || f.summary?.slice(0, 30) || "Untitled",
  })),
  existing_pieces: [],
  preference_hints: buildPreferenceHints(input),
  requested_count: DEFAULT_PIECES_PER_QUADRANT,
  max_total_chars: DEFAULT_MAX_CHARS_PER_QUADRANT,
});

const buildPreferenceHints = (input: PuzzleSessionInput): string => {
  const hints: string[] = [];

  // Analyze preference profile for each mode
  for (const [key, stats] of Object.entries(input.preference_profile)) {
    if (stats.discarded > stats.placed) {
      hints.push(`${key}: user often discards, keep concise`);
    }
    if (stats.edited > stats.placed / 2) {
      hints.push(`${key}: user often edits, provide starting points`);
    }
  }

  return hints.join("; ") || "none";
};

/**
 * Run all 4 quadrant agents in parallel with timeout
 */
const runQuadrantsInParallel = async (
  baseInput: Omit<QuadrantAgentInput, "mode">,
  client: LLMClient,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<QuadrantResult[]> => {
  const agents = [
    { mode: "FORM" as const, runner: runFormQuadrantAgent },
    { mode: "MOTION" as const, runner: runMotionQuadrantAgent },
    { mode: "EXPRESSION" as const, runner: runExpressionQuadrantAgent },
    { mode: "FUNCTION" as const, runner: runFunctionQuadrantAgent },
  ];

  const results = await Promise.allSettled(
    agents.map(async ({ mode, runner }) => {
      try {
        const output = await runner(baseInput, client, timeoutMs);
        return { mode, pieces: output.pieces, success: true };
      } catch (error) {
        console.error(`[PuzzleSessionAgent] ${mode} agent failed:`, error);
        return {
          mode,
          pieces: [],
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    })
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    return {
      mode: agents[i].mode,
      pieces: [],
      success: false,
      error: result.reason?.message || "Promise rejected",
    };
  });
};

// ========== Main Session Generation ==========

export interface PuzzleSessionOutput {
  sessionState: PuzzleSessionState;
  errors: string[];
}

/**
 * Generate a complete puzzle session with pre-generated pieces for all quadrants
 */
export const runPuzzleSessionAgent = async (
  input: PuzzleSessionInput,
  client: LLMClient,
  anchors: Anchor[] = [],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<PuzzleSessionOutput> => {
  const sessionId = uuidv4();
  const errors: string[] = [];

  console.log(`[PuzzleSessionAgent] Starting session ${sessionId}, type: ${input.puzzle_type}`);

  // 1. Generate central question
  const centralQuestion = await generateCentralQuestion(input, client);
  console.log(`[PuzzleSessionAgent] Central question: "${centralQuestion}"`);

  // 2. Build shared input for quadrant agents
  const baseInput = buildQuadrantInput(input, centralQuestion, anchors);

  // 3. Run all quadrant agents in parallel
  console.log("[PuzzleSessionAgent] Running 4 quadrant agents in parallel...");
  const quadrantResults = await runQuadrantsInParallel(baseInput, client, timeoutMs);

  // 4. Collect results and errors
  const formResult = quadrantResults.find((r) => r.mode === "FORM");
  const motionResult = quadrantResults.find((r) => r.mode === "MOTION");
  const expressionResult = quadrantResults.find((r) => r.mode === "EXPRESSION");
  const functionResult = quadrantResults.find((r) => r.mode === "FUNCTION");

  for (const result of quadrantResults) {
    if (!result.success) {
      errors.push(`${result.mode}: ${result.error}`);
    }
  }

  // 5. Build session state
  const sessionState: PuzzleSessionState = {
    session_id: sessionId,
    central_question: centralQuestion,
    puzzle_type: input.puzzle_type,
    process_aim: input.process_aim,
    anchors,
    form_pieces: formResult?.pieces || [],
    motion_pieces: motionResult?.pieces || [],
    expression_pieces: expressionResult?.pieces || [],
    function_pieces: functionResult?.pieces || [],
    generation_status: errors.length === 0 ? "completed" : errors.length < 4 ? "completed" : "failed",
  };

  console.log(
    `[PuzzleSessionAgent] Session ${sessionId} completed. ` +
      `FORM: ${sessionState.form_pieces.length}, ` +
      `MOTION: ${sessionState.motion_pieces.length}, ` +
      `EXPRESSION: ${sessionState.expression_pieces.length}, ` +
      `FUNCTION: ${sessionState.function_pieces.length}, ` +
      `Errors: ${errors.length}`
  );

  return { sessionState, errors };
};

// ========== Single Quadrant Regeneration ==========

/**
 * Regenerate pieces for a single quadrant (for retry or refresh)
 */
export const regenerateQuadrant = async (
  mode: "FORM" | "MOTION" | "EXPRESSION" | "FUNCTION",
  sessionState: PuzzleSessionState,
  fragmentsSummary: FragmentSummary[],
  preferenceProfile: Record<string, { suggested: number; placed: number; edited: number; discarded: number; connected: number }>,
  client: LLMClient,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<QuadrantAgentPiece[]> => {
  const baseInput: Omit<QuadrantAgentInput, "mode"> = {
    puzzle_type: sessionState.puzzle_type,
    central_question: sessionState.central_question,
    process_aim: sessionState.process_aim,
    anchors: sessionState.anchors,
    relevant_fragments: fragmentsSummary.slice(0, 5),
    existing_pieces: [],
    preference_hints: "",
    requested_count: DEFAULT_PIECES_PER_QUADRANT,
    max_total_chars: DEFAULT_MAX_CHARS_PER_QUADRANT,
  };

  const runners = {
    FORM: runFormQuadrantAgent,
    MOTION: runMotionQuadrantAgent,
    EXPRESSION: runExpressionQuadrantAgent,
    FUNCTION: runFunctionQuadrantAgent,
  };

  try {
    const output = await runners[mode](baseInput, client, timeoutMs);
    return output.pieces;
  } catch (error) {
    console.error(`[PuzzleSessionAgent] Failed to regenerate ${mode}:`, error);
    return [];
  }
};
