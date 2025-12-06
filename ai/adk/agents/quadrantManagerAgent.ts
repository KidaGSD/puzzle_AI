/**
 * QuadrantManagerAgent - Coordinator for the 1 Manager + 4 Agents Architecture
 *
 * Responsibilities:
 * 1. Receive enriched fragments with features (keywords, themes, palette, etc.)
 * 2. Assign fragments to modes based on relevance (avoid overlap, max 2 modes each)
 * 3. Run 4 specialized agents in parallel
 * 4. Cross-check outputs for diversity (connections OK, no duplicates)
 * 5. Merge results into unified output
 */

import { DesignMode, PuzzleType, Fragment, Anchor } from "../../../domain/models";
import { PieceSchema, QuadrantAgentOutputSchema, FragmentFeatureSchema } from "../schemas/puzzleSchemas";
import { LLMClient } from "../../adkClient";
import { runFormAgent } from "./formAgent";
import { runMotionAgent } from "./motionAgent";
import { runExpressionAgent } from "./expressionAgent";
import { runFunctionAgent } from "./functionAgent";

// ========== Fragment Assignment Keywords ==========

const MODE_KEYWORDS: Record<DesignMode, {
  primary: string[];    // Strong match keywords
  secondary: string[];  // Weak match keywords
}> = {
  FORM: {
    primary: ['shape', 'structure', 'layout', 'composition', 'texture', 'material', 'geometric', 'organic', 'silhouette', 'pattern', 'grid', 'balance', 'proportion', 'weight', 'layering'],
    secondary: ['visual', 'surface', 'line', 'form', 'spatial', 'round', 'angular', 'soft', 'sharp', 'heavy', 'light']
  },
  MOTION: {
    primary: ['movement', 'animation', 'transition', 'rhythm', 'pacing', 'flow', 'pour', 'whisk', 'bloom', 'fade', 'snap', 'ease', 'timing', 'speed', 'dynamic'],
    secondary: ['slow', 'fast', 'glide', 'hover', 'drift', 'settle', 'rise', 'entrance', 'exit', 'micro', 'interaction', 'pulse']
  },
  EXPRESSION: {
    primary: ['emotion', 'mood', 'tone', 'personality', 'voice', 'feeling', 'atmosphere', 'warmth', 'energy', 'calm', 'bold', 'quiet', 'playful', 'serious', 'cultural'],
    secondary: ['happy', 'confident', 'elegant', 'modern', 'traditional', 'premium', 'accessible', 'zen', 'ceremonial', 'spirit']
  },
  FUNCTION: {
    primary: ['audience', 'user', 'purpose', 'context', 'accessibility', 'platform', 'constraint', 'mobile', 'responsive', 'legibility', 'usability', 'goal', 'job'],
    secondary: ['print', 'screen', 'packaging', 'menu', 'navigation', 'button', 'icon', 'shelf', 'retail', 'digital']
  }
};

// ========== Fragment Assignment Types ==========

export interface EnrichedFragment {
  id: string;
  title: string;
  summary: string;
  content?: string;
  type: 'TEXT' | 'IMAGE';
  tags?: string[];
  keywords?: string[];
  themes?: string[];
  palette?: string[];
  objects?: string[];
  mood?: string;
  uniqueInsight?: string;
  imageUrl?: string;
}

export interface FragmentAssignment {
  mode: DesignMode;
  fragments: EnrichedFragment[];
  score: number;  // Relevance score for this mode
}

export interface ManagerInput {
  processAim: string;
  puzzleType: PuzzleType;
  centralQuestion: string;
  fragments: EnrichedFragment[];
  anchors: Anchor[];
  preferenceHints?: Record<DesignMode, string>;
  avoidPhrases?: string[];
}

export interface ManagerOutput {
  pieces: Record<DesignMode, PieceSchema[]>;
  meta: {
    totalPieces: number;
    perModeCount: Record<DesignMode, number>;
    qualityScore: number;
    fragmentCoverage: number;
    crossQuadrantDuplicates: number;
  };
}

// ========== Fragment Assignment Logic ==========

/**
 * Calculate relevance score for a fragment to a specific mode
 */
const calculateModeRelevance = (
  fragment: EnrichedFragment,
  mode: DesignMode
): number => {
  const modeKeys = MODE_KEYWORDS[mode];
  let score = 0;

  // Check keywords
  const allContent = [
    fragment.title,
    fragment.summary,
    fragment.content,
    ...(fragment.tags || []),
    ...(fragment.keywords || []),
    ...(fragment.themes || []),
    fragment.mood,
    fragment.uniqueInsight
  ].filter(Boolean).join(' ').toLowerCase();

  // Primary keywords: +3 each
  for (const kw of modeKeys.primary) {
    if (allContent.includes(kw)) {
      score += 3;
    }
  }

  // Secondary keywords: +1 each
  for (const kw of modeKeys.secondary) {
    if (allContent.includes(kw)) {
      score += 1;
    }
  }

  // Image fragments get bonus for FORM and EXPRESSION
  if (fragment.type === 'IMAGE') {
    if (mode === 'FORM') score += 2;
    if (mode === 'EXPRESSION') score += 2;
    // Palette presence bonus
    if (fragment.palette && fragment.palette.length > 0) {
      if (mode === 'FORM') score += 1;
      if (mode === 'EXPRESSION') score += 1;
    }
  }

  return score;
};

/**
 * Assign fragments to modes based on relevance
 * Each fragment can appear in at most 2 modes
 */
export const assignFragmentsToModes = (
  fragments: EnrichedFragment[]
): Record<DesignMode, EnrichedFragment[]> => {
  const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];
  const assignments: Record<DesignMode, EnrichedFragment[]> = {
    FORM: [],
    MOTION: [],
    EXPRESSION: [],
    FUNCTION: []
  };

  // Track how many modes each fragment is assigned to
  const fragmentAssignmentCount = new Map<string, number>();

  // Calculate scores for each fragment-mode pair
  const scoredPairs: Array<{
    fragment: EnrichedFragment;
    mode: DesignMode;
    score: number;
  }> = [];

  for (const fragment of fragments) {
    for (const mode of modes) {
      const score = calculateModeRelevance(fragment, mode);
      if (score > 0) {
        scoredPairs.push({ fragment, mode, score });
      }
    }
  }

  // Sort by score descending
  scoredPairs.sort((a, b) => b.score - a.score);

  // Assign fragments to modes
  for (const { fragment, mode, score } of scoredPairs) {
    const assignmentCount = fragmentAssignmentCount.get(fragment.id) || 0;

    // Max 2 modes per fragment
    if (assignmentCount >= 2) continue;

    // Max 6 fragments per mode
    if (assignments[mode].length >= 6) continue;

    // Check if fragment already in this mode
    if (assignments[mode].some(f => f.id === fragment.id)) continue;

    // Assign
    assignments[mode].push(fragment);
    fragmentAssignmentCount.set(fragment.id, assignmentCount + 1);
  }

  // Ensure each mode has at least 2 fragments if possible
  for (const mode of modes) {
    if (assignments[mode].length < 2) {
      // Find unassigned or under-assigned fragments
      for (const fragment of fragments) {
        const assignmentCount = fragmentAssignmentCount.get(fragment.id) || 0;
        if (assignmentCount < 2 && !assignments[mode].some(f => f.id === fragment.id)) {
          assignments[mode].push(fragment);
          fragmentAssignmentCount.set(fragment.id, assignmentCount + 1);
          if (assignments[mode].length >= 2) break;
        }
      }
    }
  }

  console.log(`[QuadrantManager] Fragment assignment: FORM=${assignments.FORM.length}, MOTION=${assignments.MOTION.length}, EXPRESSION=${assignments.EXPRESSION.length}, FUNCTION=${assignments.FUNCTION.length}`);

  return assignments;
};

// ========== Cross-Quadrant Diversity Check ==========

/**
 * Remove duplicate pieces across quadrants
 * Returns the number of duplicates removed
 */
const removeCrossQuadrantDuplicates = (
  pieces: Record<DesignMode, PieceSchema[]>
): number => {
  const seenTexts = new Set<string>();
  let duplicatesRemoved = 0;
  const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];

  for (const mode of modes) {
    pieces[mode] = pieces[mode].filter(piece => {
      const normalized = piece.text.toLowerCase().trim();
      if (seenTexts.has(normalized)) {
        duplicatesRemoved++;
        console.log(`[QuadrantManager] Removed cross-quadrant duplicate: "${piece.text}" from ${mode}`);
        return false;
      }
      seenTexts.add(normalized);
      return true;
    });
  }

  return duplicatesRemoved;
};

/**
 * Calculate 3-gram similarity between two texts
 */
const calculateSimilarity = (text1: string, text2: string): number => {
  const getNGrams = (text: string, n: number): Set<string> => {
    const words = text.toLowerCase().split(/\s+/);
    const grams = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) {
      grams.add(words.slice(i, i + n).join(' '));
    }
    return grams;
  };

  const grams1 = getNGrams(text1, 2);
  const grams2 = getNGrams(text2, 2);

  if (grams1.size === 0 || grams2.size === 0) return 0;

  const intersection = new Set([...grams1].filter(g => grams2.has(g)));
  const union = new Set([...grams1, ...grams2]);

  return intersection.size / union.size;
};

/**
 * Remove similar pieces across quadrants (Jaccard > 0.5)
 */
const removeSimilarPieces = (
  pieces: Record<DesignMode, PieceSchema[]>
): number => {
  const allPieces: Array<{ mode: DesignMode; piece: PieceSchema; index: number }> = [];
  const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];

  for (const mode of modes) {
    pieces[mode].forEach((piece, index) => {
      allPieces.push({ mode, piece, index });
    });
  }

  const toRemove: Set<string> = new Set();

  for (let i = 0; i < allPieces.length; i++) {
    for (let j = i + 1; j < allPieces.length; j++) {
      const p1 = allPieces[i];
      const p2 = allPieces[j];

      // Only check across different quadrants
      if (p1.mode === p2.mode) continue;

      const similarity = calculateSimilarity(p1.piece.text, p2.piece.text);
      if (similarity > 0.5) {
        // Remove the one with lower priority (higher number)
        const removeKey = p1.piece.priority > p2.piece.priority
          ? `${p1.mode}-${p1.index}`
          : `${p2.mode}-${p2.index}`;
        toRemove.add(removeKey);
        console.log(`[QuadrantManager] Removed similar piece (${(similarity * 100).toFixed(0)}% similar): "${p1.piece.text}" vs "${p2.piece.text}"`);
      }
    }
  }

  // Remove marked pieces
  for (const mode of modes) {
    pieces[mode] = pieces[mode].filter((_, index) => !toRemove.has(`${mode}-${index}`));
  }

  return toRemove.size;
};

// ========== Manager Agent ==========

/**
 * Run the QuadrantManager - coordinates all 4 quadrant agents
 */
export const runQuadrantManager = async (
  input: ManagerInput,
  client: LLMClient
): Promise<ManagerOutput> => {
  console.log(`[QuadrantManager] Starting with ${input.fragments.length} fragments`);
  const startTime = Date.now();

  // Step 1: Assign fragments to modes
  const assignments = assignFragmentsToModes(input.fragments);

  // Step 2: Run 4 agents in parallel
  const agentPromises = [
    runFormAgent({
      processAim: input.processAim,
      puzzleType: input.puzzleType,
      centralQuestion: input.centralQuestion,
      fragments: assignments.FORM,
      anchors: input.anchors,
      preferenceHints: input.preferenceHints?.FORM,
      avoidPhrases: input.avoidPhrases
    }, client),
    runMotionAgent({
      processAim: input.processAim,
      puzzleType: input.puzzleType,
      centralQuestion: input.centralQuestion,
      fragments: assignments.MOTION,
      anchors: input.anchors,
      preferenceHints: input.preferenceHints?.MOTION,
      avoidPhrases: input.avoidPhrases
    }, client),
    runExpressionAgent({
      processAim: input.processAim,
      puzzleType: input.puzzleType,
      centralQuestion: input.centralQuestion,
      fragments: assignments.EXPRESSION,
      anchors: input.anchors,
      preferenceHints: input.preferenceHints?.EXPRESSION,
      avoidPhrases: input.avoidPhrases
    }, client),
    runFunctionAgent({
      processAim: input.processAim,
      puzzleType: input.puzzleType,
      centralQuestion: input.centralQuestion,
      fragments: assignments.FUNCTION,
      anchors: input.anchors,
      preferenceHints: input.preferenceHints?.FUNCTION,
      avoidPhrases: input.avoidPhrases
    }, client)
  ];

  const results = await Promise.allSettled(agentPromises);

  // Step 3: Collect pieces from each agent
  const pieces: Record<DesignMode, PieceSchema[]> = {
    FORM: [],
    MOTION: [],
    EXPRESSION: [],
    FUNCTION: []
  };

  const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];
  let totalQuality = 0;

  for (let i = 0; i < modes.length; i++) {
    const mode = modes[i];
    const result = results[i];

    if (result.status === 'fulfilled') {
      pieces[mode] = result.value.pieces;
      totalQuality += result.value.meta.qualityScore;
      console.log(`[QuadrantManager] ${mode}: ${result.value.pieces.length} pieces, quality=${result.value.meta.qualityScore}`);
    } else {
      console.error(`[QuadrantManager] ${mode} failed:`, result.reason);
    }
  }

  // Step 4: Cross-quadrant diversity check
  const duplicatesRemoved = removeCrossQuadrantDuplicates(pieces);
  const similarRemoved = removeSimilarPieces(pieces);

  // Step 5: Calculate final metrics
  const totalPieces = modes.reduce((sum, m) => sum + pieces[m].length, 0);
  const perModeCount: Record<DesignMode, number> = {
    FORM: pieces.FORM.length,
    MOTION: pieces.MOTION.length,
    EXPRESSION: pieces.EXPRESSION.length,
    FUNCTION: pieces.FUNCTION.length
  };

  // Fragment coverage: how many unique fragments are cited
  const citedFragments = new Set<string>();
  for (const mode of modes) {
    for (const piece of pieces[mode]) {
      if (piece.fragmentId) {
        citedFragments.add(piece.fragmentId);
      }
    }
  }
  const fragmentCoverage = input.fragments.length > 0
    ? citedFragments.size / input.fragments.length
    : 0;

  const duration = Date.now() - startTime;
  console.log(`[QuadrantManager] Completed in ${duration}ms: ${totalPieces} pieces, coverage=${(fragmentCoverage * 100).toFixed(0)}%, duplicates=${duplicatesRemoved}, similar=${similarRemoved}`);

  return {
    pieces,
    meta: {
      totalPieces,
      perModeCount,
      qualityScore: Math.round(totalQuality / 4),
      fragmentCoverage,
      crossQuadrantDuplicates: duplicatesRemoved + similarRemoved
    }
  };
};

export default {
  runQuadrantManager,
  assignFragmentsToModes
};
