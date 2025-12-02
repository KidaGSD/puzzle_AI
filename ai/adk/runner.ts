/**
 * Puzzle Runner - ADK-based orchestration for puzzle workflow
 *
 * Exposes the main workflow entry points:
 * - startPuzzleSession: Full puzzle pre-generation
 * - regenerateQuadrant: Regenerate pieces for a single quadrant
 * - synthesizePuzzle: Generate puzzle summary
 *
 * Uses real ADK patterns:
 * - Feature extraction via featureStoreTool
 * - Intelligent retrieval via retrievalTool
 * - Real LlmAgent execution via Runner
 * - PreGen pool for usage tracking
 */

import { SimpleSession as Session, ToolContext } from "./types/adkTypes";
import { DesignMode, PuzzleType, Fragment, Anchor, UserPreferenceProfile } from "../../domain/models";
import {
  PieceSchema,
  PuzzleSessionStateSchema,
  QuadrantAgentInputSchema,
  QuadrantAgentOutputSchema,
  SynthesisInputSchema,
  SynthesisOutputSchema,
  FragmentFeatureSchema
} from "./schemas/puzzleSchemas";
import { runQuadrantManager, EnrichedFragment } from "./agents/quadrantManagerAgent";
import { runCentralQuestionAgent } from "./agents/centralQuestionAgent";
import { applyDiversityFilter } from "./agents/filterAgent";
import { MODE_CONFIG, runQuadrantAgentADK } from "./agents/quadrantAgent";
import { getFragmentFeatures } from "./tools/featureStoreTool";
import { getFragmentsForMode } from "./tools/retrievalTool";
import { enqueuePieces, clearPool, getPoolStats } from "./tools/preGenPoolTool";
import { readPreferenceHints } from "./tools/preferenceTool";
import { LLMClient, createProClient } from "../adkClient";
// Background services for precomputed insights
import { serviceManager } from "./services";
import { v4 as uuidv4 } from "uuid";

// ========== Session Factory ==========

/**
 * Create a new puzzle session with initial state
 * Uses real Set/Map for tracking, with serialization helpers
 */
export const createPuzzleSession = (
  userId: string,
  processAim: string,
  puzzleType: PuzzleType,
  centralQuestion: string
): Session => {
  const sessionId = uuidv4();

  // Create session with properly structured state
  const session = new Session({
    id: sessionId,
    appName: 'puzzle_app',
    userId,
    state: {
      sessionId,
      userId,
      startedAt: Date.now(),
      currentStage: 'gathering',
      puzzleType,
      centralQuestion,
      processAim,
      // PreGen pools per mode
      preGenPool_pieces: {
        FORM: [],
        MOTION: [],
        EXPRESSION: [],
        FUNCTION: []
      },
      // Usage tracking (arrays for serialization, converted to Set/Map at runtime)
      preGenPool_usedTexts: [],
      preGenPool_fragmentCounts: {},
      // Fragment features cache
      fragmentFeatures: {},
      // Quality metrics
      qualityScore: 0,
      completionPercentage: 0
    }
  });

  return session;
};

/**
 * Create tool context from session
 */
const createToolContext = (session: Session): ToolContext => ({
  invocationContext: {
    session,
    incrementLlmCallCount: () => {}
  }
});

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
 * ADK Flow:
 * 1. Extract features from fragments (featureStoreTool)
 * 2. Generate central question (CentralQuestionAgent)
 * 3. Get mode-specific fragments (retrievalTool per mode)
 * 4. Run 4 quadrant agents in parallel (real LlmAgent execution)
 * 5. Apply diversity filter to each
 * 6. Enqueue to preGen pool with usage tracking
 * 7. Return session state
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

  console.log(`[PuzzleRunner] Starting ADK session: type=${input.puzzleType}, fragments=${input.fragments.length}`);

  // Create session with initial state
  const session = createPuzzleSession('user', input.processAim, input.puzzleType, '');
  session.state.set('fragments', input.fragments);
  session.state.set('llmClient', client);
  session.state.set('preferenceProfile', input.preferenceProfile);

  const toolContext = createToolContext(session);
  await clearPool({}, toolContext);

  // ========== Check for precomputed insights (instant if available) ==========
  const precomputed = serviceManager.getPrecomputedInsights();
  const precomputedFragments = serviceManager.getEnrichedFragments();
  const usePrecomputed = precomputed && !precomputed.isStale && precomputedFragments;

  if (usePrecomputed) {
    console.log(`[PuzzleRunner] ⚡ Using precomputed insights (age: ${Date.now() - precomputed.timestamp}ms)`);
  } else {
    console.log('[PuzzleRunner] Computing fresh insights (no precomputed data available)');
  }

  // ========== Step 1: Extract features from fragments ==========
  console.log('[PuzzleRunner] Step 1: Extracting features...');
  let fragmentFeatures: FragmentFeatureSchema[] = [];

  if (usePrecomputed) {
    // Use precomputed features from background service
    const allFeatures = serviceManager.getAllFragmentFeatures();
    fragmentFeatures = input.fragments.map(f => {
      const cached = allFeatures.get(f.id);
      return {
        fragmentId: f.id,
        type: f.type === 'IMAGE' ? 'IMAGE' as const : 'TEXT' as const,
        analysisStatus: cached ? 'complete' : 'pending',
        updatedAt: cached?.extractedAt || Date.now(),
        keywords: cached?.keywords || [],
        themes: cached?.themes || [],
        mood: cached?.mood,
        palette: cached?.palette,
        objects: cached?.objects,
        uniqueInsight: cached?.uniqueInsight
      };
    });
    console.log(`[PuzzleRunner] Using ${fragmentFeatures.length} precomputed features (instant)`);
  } else {
    // Fall back to on-demand extraction
    try {
      const featureResult = await getFragmentFeatures(
        { fragmentIds: input.fragments.map(f => f.id), forceRefresh: false },
        toolContext
      );
      if (featureResult.success && featureResult.data) {
        fragmentFeatures = featureResult.data.features;
        session.state.set('fragmentFeatures', fragmentFeatures);
        console.log(`[PuzzleRunner] Extracted features: ${featureResult.data.cacheHits} cached, ${featureResult.data.newExtractions} new`);
      }
    } catch (err) {
      console.warn('[PuzzleRunner] Feature extraction failed, continuing without:', err);
    }
  }

  // ========== Step 2: Generate central question ==========
  console.log('[PuzzleRunner] Step 2: Generating central question...');
  let centralQuestion = input.centralQuestion;

  if (!centralQuestion && usePrecomputed && precomputed!.potentialQuestions.length > 0) {
    // Use precomputed question (instant)
    const bestQuestion = precomputed!.potentialQuestions[0];
    centralQuestion = bestQuestion.question;
    console.log(`[PuzzleRunner] Using precomputed question: "${centralQuestion}" (confidence: ${bestQuestion.confidence})`);
  } else if (!centralQuestion) {
    // Generate fresh using Pro model for quality
    const proClient = createProClient();
    try {
      const questionResult = await runCentralQuestionAgent({
        processAim: input.processAim,
        puzzleType: input.puzzleType,
        fragments: input.fragments,
        fragmentFeatures,
        previousQuestions: [] // Could be passed from store
      }, proClient);

      centralQuestion = questionResult.question;
      console.log(`[PuzzleRunner] Central question: "${centralQuestion}" (valid=${questionResult.isValid}, retries=${questionResult.retryCount})`);
    } catch (err) {
      console.warn('[PuzzleRunner] Central question generation failed:', err);
      centralQuestion = `What is the core design direction for ${input.processAim.split(' ').slice(0, 4).join(' ')}?`;
    }
  }
  session.state.set('centralQuestion', centralQuestion);

  // ========== Step 3: Enrich fragments with features ==========
  console.log(`[PuzzleRunner] Step 3: Enriching ${input.fragments.length} fragments...`);
  const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];

  // DEBUG: Log input fragments
  console.log(`[PuzzleRunner DEBUG] Input fragments: ${JSON.stringify(input.fragments.map(f => ({ id: f.id, title: f.title, type: f.type })))}`);

  // Build enriched fragments for the QuadrantManager
  const enrichedFragments: EnrichedFragment[] = input.fragments.map(f => {
    const features = fragmentFeatures.find(ft => ft.fragmentId === f.id);
    const combinedTags = new Set<string>();
    (f.tags || []).forEach(t => combinedTags.add(t));
    features?.keywords?.forEach(k => combinedTags.add(k));
    features?.themes?.forEach(t => combinedTags.add(t));

    return {
      id: f.id,
      title: f.title || f.summary?.slice(0, 30) || 'Untitled',
      summary: features?.uniqueInsight || f.summary || f.content?.slice(0, 120) || 'No summary',
      content: f.content,
      type: (f.type === 'IMAGE' ? 'IMAGE' : 'TEXT') as 'TEXT' | 'IMAGE',
      tags: Array.from(combinedTags),
      keywords: features?.keywords,
      themes: features?.themes,
      palette: features?.palette,
      objects: features?.objects,
      mood: features?.mood,
      uniqueInsight: features?.uniqueInsight,
      imageUrl: f.type === 'IMAGE' ? f.content : undefined
    };
  });

  // Get preference hints per mode
  const preferenceHintsByMode: Record<DesignMode, string> = {
    FORM: '',
    MOTION: '',
    EXPRESSION: '',
    FUNCTION: ''
  };

  for (const mode of modes) {
    try {
      const hint = await readPreferenceHints({ mode, puzzleType: input.puzzleType }, toolContext);
      preferenceHintsByMode[mode] = hint.hints || '';
    } catch {
      preferenceHintsByMode[mode] = '';
    }
  }

  // DEBUG: Log enriched fragments
  console.log(`[PuzzleRunner DEBUG] Enriched fragments: ${JSON.stringify(enrichedFragments.map(f => ({ id: f.id, title: f.title, keywords: f.keywords?.slice(0, 3), themes: f.themes?.slice(0, 2) })))}`);

  // ========== Step 4: Run QuadrantManager (1 Manager + 4 Agents) ==========
  console.log('[PuzzleRunner] Step 4: Running QuadrantManager (1 manager + 4 agents)...');

  const managerResult = await runQuadrantManager({
    processAim: input.processAim,
    puzzleType: input.puzzleType,
    centralQuestion: centralQuestion!,
    fragments: enrichedFragments,
    anchors: input.anchors,
    preferenceHints: preferenceHintsByMode,
    avoidPhrases: []
  }, client);

  // ========== Step 5 & 6: Apply final filter and enqueue to pool ==========
  console.log('[PuzzleRunner] Step 5-6: Final filtering and enqueueing...');
  const preGenPieces: Record<DesignMode, PieceSchema[]> = {
    FORM: [],
    MOTION: [],
    EXPRESSION: [],
    FUNCTION: []
  };

  // DEBUG: Log manager result
  console.log(`[PuzzleRunner DEBUG] Manager result pieces: FORM=${managerResult.pieces.FORM?.length || 0}, MOTION=${managerResult.pieces.MOTION?.length || 0}, EXPRESSION=${managerResult.pieces.EXPRESSION?.length || 0}, FUNCTION=${managerResult.pieces.FUNCTION?.length || 0}`);
  console.log(`[PuzzleRunner DEBUG] Manager meta: ${JSON.stringify(managerResult.meta)}`);

  const totalQuality = managerResult.meta.qualityScore;
  let successCount = 0;

  for (const mode of modes) {
    const modePieces = managerResult.pieces[mode];
    if (modePieces && modePieces.length > 0) {
      // Apply final diversity filter per mode
      const filtered = applyDiversityFilter(modePieces, [], []);
      preGenPieces[mode] = filtered.pieces;
      successCount++;

      // Enqueue to preGen pool with usage tracking
      await enqueuePieces({ mode, pieces: filtered.pieces }, toolContext);

      console.log(`[PuzzleRunner] ${mode}: ${filtered.pieces.length} pieces`);
    } else {
      console.warn(`[PuzzleRunner] ${mode}: No pieces generated`);
    }
  }

  // Log pool stats and manager meta
  const poolStats = await getPoolStats({}, toolContext);
  if (poolStats.success) {
    console.log(`[PuzzleRunner] Pool stats: ${JSON.stringify(poolStats.stats.perMode)}`);
  }
  console.log(`[PuzzleRunner] Manager meta: total=${managerResult.meta.totalPieces}, coverage=${(managerResult.meta.fragmentCoverage * 100).toFixed(0)}%, duplicates=${managerResult.meta.crossQuadrantDuplicates}`);

  const avgQuality = totalQuality;
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
 * Now accepts pre-selected fragments and features from retrieval
 */
const runQuadrantForSession = async (
  mode: DesignMode,
  puzzleType: PuzzleType,
  centralQuestion: string,
  processAim: string,
  fragments: Fragment[], // Pre-selected by retrieval tool
  anchors: Anchor[],
  preferenceHint: string,
  fragmentFeatures: FragmentFeatureSchema[], // Features from extraction
  client: LLMClient
): Promise<QuadrantAgentOutputSchema> => {
  // Use fragments directly (already selected by retrieval)
  // Enrich with features if available
  const enrichedFragments = fragments.map(f => {
    const features = fragmentFeatures.find(ft => ft.fragmentId === f.id);
    const combinedTags = new Set<string>();
    (f.tags || []).forEach(t => combinedTags.add(t));
    features?.keywords?.forEach(k => combinedTags.add(k));
    features?.themes?.forEach(t => combinedTags.add(t));
    const summaryText =
      features?.uniqueInsight ||
      f.summary ||
      f.content?.slice(0, 120) ||
      'No summary available';

    return {
      id: f.id,
      title: f.title || f.summary?.slice(0, 30) || 'Untitled',
      summary: summaryText,
      keywords: features?.keywords,
      themes: features?.themes,
      tags: Array.from(combinedTags),
      imageUrl: f.type === 'IMAGE' ? f.content : undefined,
      uniqueInsight: features?.uniqueInsight || undefined
    };
  });

  // Build input
  const input: QuadrantAgentInputSchema = {
    mode,
    puzzleType,
    centralQuestion,
    processAim,
    relevantFragments: enrichedFragments,
    existingPieces: [],
    anchors: anchors.map(a => ({ type: a.type as 'STARTING' | 'SOLUTION', text: a.text })),
    requestedCount: 6, // Over-generate, then filter
    maxTotalChars: 200,
    preferenceHints: preferenceHint
  };

  // Generate pieces via real ADK agent
  const rawOutput = await runQuadrantAgentADK(input, client);

  // Apply diversity filter (over-generate + filter pattern)
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
const buildPreferenceHintFromProfile = (
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
    preferenceHints: buildPreferenceHintFromProfile(preferenceProfile, sessionState.puzzle_type, mode),
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
