/**
 * Filter Agent - ADK-based diversity and quality filtering
 *
 * Implements the diversityFilter.ts logic as an ADK component:
 * - Semantic dedup (n-gram/keyword overlap)
 * - Per-fragment/per-theme quotas
 * - Avoid phrases retry
 * - Summary-not-title validation
 */

import { FunctionTool } from "../../../../adk-typescript/src/tools/FunctionTool";
import { ToolContext } from "../../../../adk-typescript/src/tools/ToolContext";
import { PieceSchema, FilterResultSchema } from "../schemas/puzzleSchemas";
import { DesignMode } from "../../../domain/models";

// ========== Configuration ==========

const FILTER_CONFIG = {
  maxPerFragment: 2,
  maxPerTheme: 3,
  minUniqueRate: 0.7,
  ngramSize: 2,
  jaccardThreshold: 0.4,
  minReasoningLength: 20
};

// Blacklisted generic phrases that indicate AI copying examples
const BLACKLISTED_PHRASES = new Set([
  'glass morphism',
  'glassmorphism',
  'glass morphism as metaphor',
  'what is the',
  'how does',
  'why should',
  'what makes',
  'consider the',
  'think about'
]);

// ========== Filter Functions ==========

/**
 * Extract n-grams from text for similarity comparison
 */
const extractNgrams = (text: string, n: number = 2): Set<string> => {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const ngrams = new Set<string>();

  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }

  return ngrams;
};

/**
 * Calculate Jaccard similarity between two texts
 */
const jaccardSimilarity = (text1: string, text2: string): number => {
  const ngrams1 = extractNgrams(text1);
  const ngrams2 = extractNgrams(text2);

  if (ngrams1.size === 0 && ngrams2.size === 0) return 0;

  const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
  const union = new Set([...ngrams1, ...ngrams2]);

  return intersection.size / union.size;
};

/**
 * Check if text contains blacklisted phrases
 */
const containsBlacklisted = (text: string): boolean => {
  const lower = text.toLowerCase();
  for (const phrase of BLACKLISTED_PHRASES) {
    if (lower.includes(phrase)) return true;
  }
  return false;
};

/**
 * Check if summary merely echoes the title
 */
const summaryEchoesTitle = (summary: string, title: string): boolean => {
  if (!summary || !title) return false;

  const summaryWords = new Set(summary.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  if (titleWords.length === 0) return false;

  const matchCount = titleWords.filter(w => summaryWords.has(w)).length;
  return matchCount / titleWords.length > 0.8;
};

/**
 * Apply full diversity pipeline to pieces
 */
export const applyDiversityFilter = (
  pieces: PieceSchema[],
  existingPieces: PieceSchema[] = [],
  avoidPhrases: string[] = []
): FilterResultSchema => {
  const filteredReasons: Record<string, number> = {};
  const recordReason = (reason: string) => {
    filteredReasons[reason] = (filteredReasons[reason] || 0) + 1;
  };

  // Track quotas
  const fragmentCounts: Record<string, number> = {};
  const themeCounts: Record<string, number> = {};
  const usedTexts = new Set<string>(existingPieces.map(p => p.text.toLowerCase().trim()));

  // Add avoid phrases to used texts
  avoidPhrases.forEach(p => usedTexts.add(p.toLowerCase().trim()));

  const validPieces: PieceSchema[] = [];

  for (const piece of pieces) {
    const normalizedText = piece.text.toLowerCase().trim();

    // 1. Blacklist check
    if (containsBlacklisted(normalizedText)) {
      recordReason('blacklisted');
      continue;
    }

    // 2. Question check (should already be filtered, but double-check)
    if (normalizedText.endsWith('?')) {
      recordReason('question');
      continue;
    }

    // 3. Word count check
    const wordCount = piece.text.trim().split(/\s+/).length;
    if (wordCount < 2 || wordCount > 5) {
      recordReason('word_count');
      continue;
    }

    // 4. Duplicate text check (exact)
    if (usedTexts.has(normalizedText)) {
      recordReason('duplicate_text');
      continue;
    }

    // 5. Semantic similarity check (fuzzy dedup)
    let tooSimilar = false;
    for (const existing of validPieces) {
      const similarity = jaccardSimilarity(normalizedText, existing.text.toLowerCase());
      if (similarity > FILTER_CONFIG.jaccardThreshold) {
        tooSimilar = true;
        break;
      }
    }
    if (tooSimilar) {
      recordReason('semantic_duplicate');
      continue;
    }

    // 6. Fragment quota check
    if (piece.fragmentId) {
      const currentCount = fragmentCounts[piece.fragmentId] || 0;
      if (currentCount >= FILTER_CONFIG.maxPerFragment) {
        recordReason('fragment_quota');
        continue;
      }
      fragmentCounts[piece.fragmentId] = currentCount + 1;
    }

    // 7. Summary-echoes-title check
    if (piece.fragmentTitle && piece.fragmentSummary) {
      if (summaryEchoesTitle(piece.fragmentSummary, piece.fragmentTitle)) {
        recordReason('summary_echoes_title');
        continue;
      }
    }

    // 8. Minimum reasoning length
    if (!piece.fragmentSummary || piece.fragmentSummary.length < FILTER_CONFIG.minReasoningLength) {
      // Don't reject, but mark for backfill
      piece.qualityMeta = {
        ...piece.qualityMeta,
        wordCount,
        isQuestion: false,
        hasFragmentGrounding: !!piece.fragmentId,
        isBlacklisted: false
      };
    }

    // Passed all checks
    usedTexts.add(normalizedText);
    validPieces.push(piece);
  }

  // Calculate stats
  const groundedCount = validPieces.filter(p => p.fragmentId).length;
  const uniqueFragments = new Set(validPieces.filter(p => p.fragmentId).map(p => p.fragmentId));

  return {
    pieces: validPieces,
    stats: {
      inputCount: pieces.length,
      outputCount: validPieces.length,
      filteredReasons,
      uniqueRate: pieces.length > 0 ? validPieces.length / pieces.length : 0,
      fragmentCoverage: validPieces.length > 0 ? groundedCount / validPieces.length : 0,
      qualityScore: calculateFilterQualityScore(validPieces, uniqueFragments.size)
    }
  };
};

/**
 * Calculate quality score for filtered pieces
 */
const calculateFilterQualityScore = (pieces: PieceSchema[], uniqueFragments: number): number => {
  if (pieces.length === 0) return 0;

  let score = 50; // Base score

  // Grounding bonus (up to 25)
  const groundedRate = pieces.filter(p => p.fragmentId).length / pieces.length;
  score += groundedRate * 25;

  // Diversity bonus (up to 15)
  const diversityRate = uniqueFragments / Math.max(1, pieces.length);
  score += diversityRate * 15;

  // Reasoning quality (up to 10)
  const avgReasoningLen = pieces.reduce((sum, p) => sum + (p.fragmentSummary?.length || 0), 0) / pieces.length;
  score += Math.min(10, avgReasoningLen / 10);

  return Math.round(Math.min(100, score));
};

// ========== ADK Tool ==========

/**
 * Filter pieces tool for ADK integration
 */
export const filterPieces = async (
  params: {
    pieces: PieceSchema[];
    existingPieces?: PieceSchema[];
    avoidPhrases?: string[];
    mode?: DesignMode;
  },
  context: ToolContext
): Promise<FilterResultSchema> => {
  const result = applyDiversityFilter(
    params.pieces,
    params.existingPieces || [],
    params.avoidPhrases || []
  );

  // Store result in session for other agents
  if (params.mode) {
    const session = context.invocationContext.session;
    const filterResults = session.state.get('filterResults', {}) as Record<DesignMode, FilterResultSchema>;
    filterResults[params.mode] = result;
    session.state.set('filterResults', filterResults);
  }

  console.log(`[FilterAgent] ${params.mode || 'unknown'}: ${result.stats.inputCount} -> ${result.stats.outputCount} pieces`);

  return result;
};

/**
 * Create ADK FunctionTool for filtering
 */
export const createFilterTool = (): FunctionTool => {
  return new FunctionTool({
    name: 'filter_pieces',
    description: 'Apply diversity and quality filters to generated pieces',
    fn: filterPieces,
    functionDeclaration: {
      name: 'filter_pieces',
      description: 'Filter pieces for duplicates, quotas, and quality',
      parameters: {
        type: 'object',
        properties: {
          pieces: {
            type: 'array',
            description: 'Pieces to filter'
          },
          existingPieces: {
            type: 'array',
            description: 'Already used pieces to avoid'
          },
          avoidPhrases: {
            type: 'array',
            items: { type: 'string' },
            description: 'Phrases to exclude'
          },
          mode: {
            type: 'string',
            enum: ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'],
            description: 'Quadrant mode for tracking'
          }
        },
        required: ['pieces']
      }
    }
  });
};

/**
 * Retry filter with additional avoid phrases
 * Used when initial filter yields too few results
 */
export const retryFilterWithAvoidPhrases = async (
  pieces: PieceSchema[],
  existingPieces: PieceSchema[],
  targetCount: number,
  context: ToolContext
): Promise<FilterResultSchema> => {
  // First pass
  let result = applyDiversityFilter(pieces, existingPieces, []);

  if (result.pieces.length >= targetCount) {
    return result;
  }

  // If not enough, collect rejected phrases and retry with relaxed thresholds
  console.log(`[FilterAgent] Retry: only ${result.pieces.length}/${targetCount} pieces, relaxing filters`);

  // For retry, we relax semantic similarity threshold
  const relaxedPieces = pieces.filter(p => {
    const normalizedText = p.text.toLowerCase().trim();

    // Keep basic checks
    if (containsBlacklisted(normalizedText)) return false;
    if (normalizedText.endsWith('?')) return false;
    if (p.text.trim().split(/\s+/).length < 2 || p.text.trim().split(/\s+/).length > 6) return false;

    return true;
  });

  // Take what we need
  const usedTexts = new Set(result.pieces.map(p => p.text.toLowerCase().trim()));
  const additionalPieces = relaxedPieces
    .filter(p => !usedTexts.has(p.text.toLowerCase().trim()))
    .slice(0, targetCount - result.pieces.length);

  return {
    pieces: [...result.pieces, ...additionalPieces],
    stats: {
      ...result.stats,
      outputCount: result.pieces.length + additionalPieces.length
    }
  };
};
