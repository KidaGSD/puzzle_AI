/**
 * Puzzle Runner - ADK-based orchestration for puzzle workflow
 *
 * Exposes the main workflow entry points:
 * - startPuzzleSession: Full puzzle pre-generation
 * - regenerateQuadrant: Regenerate pieces for a single quadrant
 * - synthesizePuzzle: Generate puzzle summary
 *
 * Uses ADK Session for state management and event streaming.
 */

import { Session } from "../../../adk-typescript/src/sessions/Session";
import { State } from "../../../adk-typescript/src/sessions/State";
import { Event } from "../../../adk-typescript/src/events/Event";
import { DesignMode, PuzzleType, Fragment, Anchor, UserPreferenceProfile } from "../../domain/models";
import {
  PuzzleSessionStateSchema,
  PieceSchema,
  QuadrantAgentInputSchema,
  QuadrantAgentOutputSchema,
  SynthesisInputSchema,
  SynthesisOutputSchema
} from "./schemas/puzzleSchemas";
import { runQuadrantAgentADK, MODE_CONFIG, PUZZLE_TYPE_CONFIG } from "./agents/quadrantAgent";
import { applyDiversityFilter } from "./agents/filterAgent";
import { getFragmentsForMode } from "./tools/retrievalTool";
import { LLMClient } from "../adkClient";
import { v4 as uuidv4 } from "uuid";

// ========== Session Factory ==========

/**
 * Create a new puzzle session with initial state
 */
export const createPuzzleSession = (
  userId: string,
  processAim: string,
  puzzleType: PuzzleType,
  centralQuestion: string
): Session => {
  const sessionId = uuidv4();

  const initialState: PuzzleSessionStateSchema = {
    sessionId,
    userId,
    startedAt: Date.now(),
    currentStage: 'gathering',
    puzzleType,
    centralQuestion,
    preGenPieces: {
      FORM: [],
      MOTION: [],
      EXPRESSION: [],
      FUNCTION: []
    },
    usedTexts: new Set(),
    usedFragmentCounts: new Map(),
    qualityScore: 0,
    completionPercentage: 0
  };

  return new Session({
    id: sessionId,
    appName: 'puzzle_app',
    userId,
    state: {
      ...initialState,
      processAim,
      // Convert Set/Map to serializable format
      usedTexts: [],
      usedFragmentCounts: {}
    }
  });
};

// ========== Main Workflow: Start Puzzle Session ==========

export interface PuzzleSessionResult {
  sessionState: {
    session_id: string;
    puzzle_type: PuzzleType;
    central_question: string;
    pre_gen_pieces: Record<DesignMode, PieceSchema[]>;
    quality_score: number;
  };
  errors: string[];
}

/**
 * Start a full puzzle session with pre-generation for all quadrants
 *
 * Flow:
 * 1. Rank and select fragments (retrieval)
 * 2. Run 4 quadrant agents in parallel
 * 3. Apply diversity filter to each
 * 4. Enqueue to preGen pool
 * 5. Return session state
 */
export const startPuzzleSession = async (
  input: {
    processAim: string;
    puzzleType: PuzzleType;
    centralQuestion?: string;
    fragments: Fragment[];
    anchors: Anchor[];
    preferenceProfile: UserPreferenceProfile;
  },
  client: LLMClient
): Promise<PuzzleSessionResult> => {
  const errors: string[] = [];
  const startTime = Date.now();

  // Generate central question if not provided
  let centralQuestion = input.centralQuestion;
  if (!centralQuestion) {
    centralQuestion = await generateCentralQuestion(input.processAim, input.fragments, client);
  }

  console.log(`[PuzzleRunner] Starting session: type=${input.puzzleType}, question="${centralQuestion}"`);

  // Create mock session for tool context
  const session = createPuzzleSession('user', input.processAim, input.puzzleType, centralQuestion);
  session.state.set('fragments', input.fragments);
  session.state.set('llmClient', client);

  const mockToolContext = {
    invocationContext: {
      session
    }
  } as any;

  // Run quadrant agents in parallel
  const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];
  const quadrantResults = await Promise.allSettled(
    modes.map(mode => runQuadrantForSession(
      mode,
      input.puzzleType,
      centralQuestion!,
      input.processAim,
      input.fragments,
      input.anchors,
      input.preferenceProfile,
      client
    ))
  );

  // Collect results
  const preGenPieces: Record<DesignMode, PieceSchema[]> = {
    FORM: [],
    MOTION: [],
    EXPRESSION: [],
    FUNCTION: []
  };

  let totalQuality = 0;
  let successCount = 0;

  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const result = quadrantResults[i];

    if (result.status === 'fulfilled') {
      preGenPieces[mode] = result.value.pieces;
      totalQuality += result.value.meta.qualityScore;
      successCount++;
      console.log(`[PuzzleRunner] ${mode}: ${result.value.pieces.length} pieces, quality=${result.value.meta.qualityScore}`);
    } else {
      errors.push(`${mode} generation failed: ${result.reason}`);
      console.error(`[PuzzleRunner] ${mode} failed:`, result.reason);
    }
  }

  const avgQuality = successCount > 0 ? Math.round(totalQuality / successCount) : 0;
  const duration = Date.now() - startTime;

  console.log(`[PuzzleRunner] Session complete in ${duration}ms, avg quality=${avgQuality}`);

  return {
    sessionState: {
      session_id: session.id,
      puzzle_type: input.puzzleType,
      central_question: centralQuestion,
      pre_gen_pieces: preGenPieces,
      quality_score: avgQuality
    },
    errors
  };
};

/**
 * Run a single quadrant's generation pipeline
 */
const runQuadrantForSession = async (
  mode: DesignMode,
  puzzleType: PuzzleType,
  centralQuestion: string,
  processAim: string,
  fragments: Fragment[],
  anchors: Anchor[],
  preferenceProfile: UserPreferenceProfile,
  client: LLMClient
): Promise<QuadrantAgentOutputSchema> => {
  // Select fragments optimized for this mode
  const modeConfig = MODE_CONFIG[mode];
  const selectedFragments = selectFragmentsForMode(fragments, mode, 6);

  // Build input
  const input: QuadrantAgentInputSchema = {
    mode,
    puzzleType,
    centralQuestion,
    processAim,
    relevantFragments: selectedFragments.map(f => ({
      id: f.id,
      title: f.title || f.summary?.slice(0, 30) || 'Untitled',
      summary: f.summary || f.content?.slice(0, 100) || '',
      tags: f.tags,
      imageUrl: f.type === 'IMAGE' ? f.content : undefined,
      uniqueInsight: undefined
    })),
    existingPieces: [],
    anchors: anchors.map(a => ({ type: a.type as 'STARTING' | 'SOLUTION', text: a.text })),
    requestedCount: 4,
    maxTotalChars: 200,
    preferenceHints: buildPreferenceHint(preferenceProfile, puzzleType, mode)
  };

  // Generate pieces
  const rawOutput = await runQuadrantAgentADK(input, client);

  // Apply diversity filter
  const filtered = applyDiversityFilter(rawOutput.pieces, [], []);

  return {
    pieces: filtered.pieces,
    meta: {
      ...rawOutput.meta,
      filteredCount: filtered.pieces.length,
      qualityScore: filtered.stats.qualityScore
    }
  };
};

/**
 * Select fragments optimized for a specific mode
 */
const selectFragmentsForMode = (
  fragments: Fragment[],
  mode: DesignMode,
  limit: number
): Fragment[] => {
  const modeKeywords = MODE_CONFIG[mode].keywords;

  // Score each fragment for relevance to this mode
  const scored = fragments.map(f => {
    let score = 0;

    // Tag matching
    const fragTags = (f.tags || []).map(t => t.toLowerCase());
    for (const kw of modeKeywords) {
      if (fragTags.some(t => t.includes(kw))) {
        score += 2;
      }
    }

    // Content matching
    const content = (f.content || '').toLowerCase();
    for (const kw of modeKeywords) {
      if (content.includes(kw)) {
        score += 1;
      }
    }

    // Type balance bonus
    if (f.type === 'IMAGE') score += 0.5;

    return { fragment: f, score };
  });

  // Sort and select
  scored.sort((a, b) => b.score - a.score);

  // Ensure mix of text and images
  const textFrags = scored.filter(s => s.fragment.type !== 'IMAGE');
  const imageFrags = scored.filter(s => s.fragment.type === 'IMAGE');

  const selected: Fragment[] = [];
  const maxImages = Math.min(2, imageFrags.length);
  const maxText = limit - maxImages;

  selected.push(...textFrags.slice(0, maxText).map(s => s.fragment));
  selected.push(...imageFrags.slice(0, maxImages).map(s => s.fragment));

  return selected.slice(0, limit);
};

/**
 * Build preference hint from profile
 */
const buildPreferenceHint = (
  profile: UserPreferenceProfile,
  puzzleType: PuzzleType,
  mode: DesignMode
): string => {
  const key = `${puzzleType}_${mode}`;
  const stats = profile[key];

  if (!stats) return '';

  const hints: string[] = [];

  if (stats.discarded > stats.placed) {
    hints.push('User often discards suggestions; keep concise');
  }
  if (stats.edited > stats.placed / 2) {
    hints.push('User often edits; provide flexible starting points');
  }
  if (stats.connected > stats.placed / 3) {
    hints.push('User likes connecting pieces; enable relationships');
  }

  return hints.join('. ');
};

// ========== Regenerate Quadrant ==========

/**
 * Regenerate pieces for a single quadrant
 */
export const regenerateQuadrant = async (
  mode: DesignMode,
  sessionState: {
    puzzle_type: PuzzleType;
    central_question: string;
  },
  fragments: Fragment[],
  anchors: Anchor[],
  existingPieces: PieceSchema[],
  preferenceProfile: UserPreferenceProfile,
  processAim: string,
  client: LLMClient
): Promise<QuadrantAgentOutputSchema> => {
  console.log(`[PuzzleRunner] Regenerating ${mode} quadrant`);

  // Build avoid phrases from existing pieces
  const avoidPhrases = existingPieces.map(p => p.text.toLowerCase());

  const input: QuadrantAgentInputSchema = {
    mode,
    puzzleType: sessionState.puzzle_type,
    centralQuestion: sessionState.central_question,
    processAim,
    relevantFragments: selectFragmentsForMode(fragments, mode, 6).map(f => ({
      id: f.id,
      title: f.title || f.summary?.slice(0, 30) || 'Untitled',
      summary: f.summary || f.content?.slice(0, 100) || '',
      tags: f.tags,
      imageUrl: f.type === 'IMAGE' ? f.content : undefined
    })),
    existingPieces: existingPieces.map(p => ({ text: p.text, priority: p.priority })),
    anchors: anchors.map(a => ({ type: a.type as 'STARTING' | 'SOLUTION', text: a.text })),
    requestedCount: 4,
    maxTotalChars: 200,
    preferenceHints: buildPreferenceHint(preferenceProfile, sessionState.puzzle_type, mode),
    avoidPhrases
  };

  const rawOutput = await runQuadrantAgentADK(input, client);
  const filtered = applyDiversityFilter(rawOutput.pieces, existingPieces, avoidPhrases);

  return {
    pieces: filtered.pieces,
    meta: {
      ...rawOutput.meta,
      filteredCount: filtered.pieces.length,
      qualityScore: filtered.stats.qualityScore
    }
  };
};

// ========== Central Question Generation ==========

/**
 * Generate central question from fragments and process aim
 */
const generateCentralQuestion = async (
  processAim: string,
  fragments: Fragment[],
  client: LLMClient
): Promise<string> => {
  const fragmentSummaries = fragments
    .slice(0, 5)
    .map(f => f.summary || f.content?.slice(0, 100))
    .filter(Boolean)
    .join('; ');

  const prompt = `Given this design process aim: "${processAim}"
And these fragment insights: ${fragmentSummaries}

Generate a single, clear central question (10-15 words) that captures the core design challenge.
The question should be open-ended and inspire exploration.

Return ONLY the question, no quotes or explanation.`;

  try {
    const response = await client.generate(prompt, 0.7);
    const question = response.trim().replace(/^["']|["']$/g, '');
    return question || 'What is the core design direction?';
  } catch (error) {
    console.warn('[PuzzleRunner] Central question generation failed:', error);
    return 'What is the core design direction?';
  }
};

// ========== Synthesize Puzzle ==========

/**
 * Generate puzzle summary after completion
 */
export const synthesizePuzzle = async (
  input: SynthesisInputSchema,
  client: LLMClient
): Promise<SynthesisOutputSchema> => {
  // Build context from placed pieces
  const quadrantSummaries = input.placedPieces.reduce((acc, p) => {
    if (!acc[p.quadrant]) acc[p.quadrant] = [];
    acc[p.quadrant].push(p.text);
    return acc;
  }, {} as Record<string, string[]>);

  const prompt = `Synthesize this completed design puzzle:

Central Question: ${input.centralQuestion}
Puzzle Type: ${input.puzzleType}
Process Aim: ${input.processAim}

Placed pieces by quadrant:
${Object.entries(quadrantSummaries).map(([q, pieces]) => `${q}: ${pieces.join(', ')}`).join('\n')}

Anchors: ${input.anchors.map(a => `${a.type}: ${a.text}`).join('; ')}

Generate a synthesis with:
1. A short title (3-5 words)
2. A one-line summary
3. A direction statement (2-3 sentences)
4. 3-4 key insights
5. 2-3 suggested next steps

Return as JSON:
{
  "title": "...",
  "oneLine": "...",
  "directionStatement": "...",
  "keyInsights": ["...", "..."],
  "nextSteps": ["...", "..."]
}`;

  try {
    const response = await client.generate(prompt, 0.6);
    const cleaned = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      title: parsed.title || 'Design Direction',
      oneLine: parsed.oneLine || 'Synthesis pending',
      directionStatement: parsed.directionStatement || '',
      keyInsights: parsed.keyInsights || [],
      nextSteps: parsed.nextSteps
    };
  } catch (error) {
    console.error('[PuzzleRunner] Synthesis failed:', error);
    return {
      title: 'Design Synthesis',
      oneLine: 'Your design exploration is complete.',
      directionStatement: `Based on ${input.placedPieces.length} placed pieces across the quadrants, you've explored multiple dimensions of ${input.processAim}.`,
      keyInsights: ['Synthesis generation encountered an error'],
      nextSteps: ['Review placed pieces', 'Refine key directions']
    };
  }
};

// ========== Export ==========

export default {
  createPuzzleSession,
  startPuzzleSession,
  regenerateQuadrant,
  synthesizePuzzle
};
