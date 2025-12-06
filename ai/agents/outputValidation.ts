/**
 * Output Validation & Diversity Module
 *
 * Validates AI-generated outputs and enforces diversity constraints:
 * 1. Blacklist: Reject hardcoded/generic phrases
 * 2. Fragment grounding: Pieces should cite fragment content
 * 3. Semantic dedupe: Remove near-duplicate pieces
 * 4. Quota enforcement: Limit per-fragment and per-theme usage
 */

import { QuadrantAgentPiece, FragmentSummary } from "../../domain/models";

// ========== Diversity Types ==========

export interface DiversityStats {
  totalGenerated: number;
  afterBlacklist: number;
  afterDedupe: number;
  afterQuota: number;
  uniqueRate: number;
  fragmentCoverage: number;
  filterReasons: Record<string, number>;
}

export interface DedupeConfig {
  similarityThreshold: number;  // 0-1, pieces above this are considered duplicates
  maxPerFragment: number;       // Max pieces citing same fragment
  maxPerTheme: number;          // Max pieces with same theme
}

const DEFAULT_DEDUPE_CONFIG: DedupeConfig = {
  similarityThreshold: 0.6,
  maxPerFragment: 2,
  maxPerTheme: 3,
};

// ========== Blacklisted Generic Phrases ==========

/**
 * Known hardcoded phrases that should be rejected
 * These were previously in MODE_STATEMENT_EXAMPLES
 */
const BLACKLISTED_PHRASES = new Set([
  // Form examples (removed)
  "geometric foundation with organic accents",
  "light visual weight, airy composition",
  "card-based layout with generous whitespace",
  "glass morphism as depth metaphor",
  "asymmetric balance creating visual tension",
  "layered transparency revealing structure",
  "rounded corners (8px) as signature element",
  "two-column layout as primary structure",
  "blue-gray palette as final direction",
  // Motion examples (removed)
  "slow, deliberate transitions",
  "ease-out curves for natural deceleration",
  "minimal motion, content-focused",
  "breathing animations for living interface",
  "staggered reveals building anticipation",
  "physics-based spring animations",
  "fade transitions only, no sliding",
  "200ms duration as standard timing",
  "loading states over skeletons",
  // Expression examples (removed)
  "calm confidence, not excitement",
  "professional warmth without corporate coldness",
  "understated premium quality",
  "playful moments within serious context",
  "unexpected delight in routine interactions",
  "nostalgic references to analog tools",
  "helpful guide over neutral tool",
  "encouraging tone in empty states",
  "subtle celebration of milestones",
  // Function examples (removed)
  "mobile-first, desktop-enhanced",
  "primary audience: creative professionals",
  "quick task completion as core value",
  "offline-first for unreliable connections",
  "voice control as alternative input",
  "integration with existing workflow tools",
  "search as primary navigation pattern",
  "three-step wizard for onboarding",
  "export to pdf as must-have feature",
]);

/**
 * Generic central questions that should be rejected
 */
const GENERIC_QUESTIONS = new Set([
  "what possibilities haven't we explored yet?",
  "what possibilities haven't we considered yet?",
  "what's the core essence we need to define?",
  "which direction should we commit to?",
  "what needs defining?",
  "what else is possible?",
  "what should we prioritize?",
]);

// ========== Validation Functions ==========

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  suggestion?: string;
}

/**
 * Check if a piece text matches a blacklisted phrase
 */
export const isBlacklistedPhrase = (text: string): boolean => {
  const normalized = text.toLowerCase().trim();
  return BLACKLISTED_PHRASES.has(normalized);
};

/**
 * Check if a central question is too generic
 */
export const isGenericQuestion = (question: string): boolean => {
  const normalized = question.toLowerCase().trim();
  return GENERIC_QUESTIONS.has(normalized);
};

/**
 * Validate a single piece output
 */
export const validatePiece = (
  piece: QuadrantAgentPiece,
  fragments: FragmentSummary[]
): ValidationResult => {
  const text = piece.text?.toLowerCase().trim() || "";

  // Check 1: Reject blacklisted phrases
  if (isBlacklistedPhrase(text)) {
    return {
      isValid: false,
      reason: `Piece "${piece.text}" matches a generic/hardcoded example`,
      suggestion: "Generate insight grounded in fragment content",
    };
  }

  // Check 2: If fragments provided, piece should cite or relate to them
  if (fragments.length > 0) {
    const hasFragmentReference = piece.fragment_id || piece.fragment_title;
    const hasMeaningfulSummary = piece.fragment_summary &&
      piece.fragment_summary.length > 20 &&
      !piece.fragment_summary.includes("Fallback");

    if (!hasFragmentReference && !hasMeaningfulSummary) {
      // Check if the piece text at least uses words from fragment content
      const fragmentWords = new Set(
        fragments
          .flatMap(f => [
            ...(f.summary?.toLowerCase().split(/\W+/) || []),
            ...(f.title?.toLowerCase().split(/\W+/) || []),
            ...(f.tags?.map(t => t.toLowerCase()) || []),
          ])
          .filter(w => w.length > 3)
      );

      const pieceWords = text.split(/\W+/).filter(w => w.length > 3);
      const overlap = pieceWords.filter(w => fragmentWords.has(w));

      if (overlap.length === 0) {
        return {
          isValid: false,
          reason: `Piece "${piece.text}" has no connection to provided fragments`,
          suggestion: "Reference fragment titles, keywords, or themes",
        };
      }
    }
  }

  // Check 3: Ensure piece has some reasoning
  if (!piece.fragment_summary || piece.fragment_summary.length < 10) {
    return {
      isValid: false,
      reason: `Piece "${piece.text}" lacks reasoning/explanation`,
      suggestion: "Add fragment_summary explaining why this insight is relevant",
    };
  }

  return { isValid: true };
};

/**
 * Validate central question
 */
export const validateCentralQuestion = (
  question: string,
  fragments: FragmentSummary[]
): ValidationResult => {
  const normalized = question.toLowerCase().trim();

  // Check 1: Reject generic questions
  if (isGenericQuestion(normalized)) {
    return {
      isValid: false,
      reason: `Question "${question}" is too generic`,
      suggestion: "Question should reference specific fragment content or themes",
    };
  }

  // Check 2: If fragments provided, question should relate to them
  if (fragments.length > 0) {
    const fragmentKeywords = new Set(
      fragments
        .flatMap(f => [
          ...(f.title?.toLowerCase().split(/\W+/) || []),
          ...(f.tags?.map(t => t.toLowerCase()) || []),
        ])
        .filter(w => w.length > 3)
    );

    const questionWords = normalized.split(/\W+/).filter(w => w.length > 3);
    const overlap = questionWords.filter(w => fragmentKeywords.has(w));

    // Question should have at least some connection to fragments
    if (overlap.length === 0 && !question.includes('"')) {
      return {
        isValid: false,
        reason: "Question has no apparent connection to fragments",
        suggestion: "Reference fragment titles or themes in the question",
      };
    }
  }

  return { isValid: true };
};

/**
 * Filter and validate a batch of pieces, returning only valid ones
 * Logs warnings for rejected pieces
 */
export const filterValidPieces = (
  pieces: QuadrantAgentPiece[],
  fragments: FragmentSummary[],
  mode: string
): QuadrantAgentPiece[] => {
  const validPieces: QuadrantAgentPiece[] = [];

  for (const piece of pieces) {
    const result = validatePiece(piece, fragments);

    if (result.isValid) {
      validPieces.push(piece);
    } else {
      console.warn(`[OutputValidation] ${mode} piece rejected: ${result.reason}`);
      // Don't completely reject - but log for debugging
      // In production, might want to regenerate or use fallback
    }
  }

  // If all pieces were rejected, return the originals with a warning
  if (validPieces.length === 0 && pieces.length > 0) {
    console.warn(`[OutputValidation] All ${mode} pieces rejected, using originals`);
    return pieces;
  }

  return validPieces;
};

/**
 * Calculate a quality score for a batch of pieces
 * Higher is better (0-100)
 */
export const calculateQualityScore = (
  pieces: QuadrantAgentPiece[],
  fragments: FragmentSummary[]
): number => {
  if (pieces.length === 0) return 0;

  let totalScore = 0;

  for (const piece of pieces) {
    let pieceScore = 50; // Base score

    // +20 for having fragment reference
    if (piece.fragment_id || piece.fragment_title) {
      pieceScore += 20;
    }

    // +20 for having meaningful summary
    if (piece.fragment_summary && piece.fragment_summary.length > 30) {
      pieceScore += 20;
    }

    // -30 for being blacklisted
    if (isBlacklistedPhrase(piece.text || "")) {
      pieceScore -= 30;
    }

    // +10 for using fragment keywords
    if (fragments.length > 0 && piece.text) {
      const fragmentWords = new Set(
        fragments.flatMap(f => (f.tags || []).map(t => t.toLowerCase()))
      );
      const pieceWords = piece.text.toLowerCase().split(/\W+/);
      if (pieceWords.some(w => fragmentWords.has(w))) {
        pieceScore += 10;
      }
    }

    totalScore += Math.max(0, Math.min(100, pieceScore));
  }

  return Math.round(totalScore / pieces.length);
};

// ========== Text Normalization ==========

/**
 * Normalize text for comparison (lowercase, remove punctuation, trim)
 */
export const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Extract n-grams from text
 */
const extractNGrams = (text: string, n: number): Set<string> => {
  const normalized = normalizeText(text);
  const words = normalized.split(' ');
  const ngrams = new Set<string>();

  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }

  return ngrams;
};

// ========== Similarity Functions ==========

/**
 * Calculate 3-gram overlap between two texts
 * Returns 0-1 where 1 = identical
 */
export const calculate3GramOverlap = (text1: string, text2: string): number => {
  const ngrams1 = extractNGrams(text1, 3);
  const ngrams2 = extractNGrams(text2, 3);

  if (ngrams1.size === 0 || ngrams2.size === 0) {
    // Fall back to word overlap for short texts
    return calculateJaccardSimilarity(text1, text2);
  }

  let overlap = 0;
  for (const gram of ngrams1) {
    if (ngrams2.has(gram)) overlap++;
  }

  return overlap / Math.max(ngrams1.size, ngrams2.size);
};

/**
 * Calculate Jaccard similarity between two texts (word-level)
 * Returns 0-1 where 1 = identical
 */
export const calculateJaccardSimilarity = (text1: string, text2: string): number => {
  const words1 = new Set(normalizeText(text1).split(' ').filter(w => w.length > 2));
  const words2 = new Set(normalizeText(text2).split(' ').filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }

  const union = words1.size + words2.size - intersection;
  return intersection / union;
};

/**
 * Check if two pieces are semantically similar
 */
export const arePiecesSimilar = (
  piece1: QuadrantAgentPiece,
  piece2: QuadrantAgentPiece,
  threshold: number = DEFAULT_DEDUPE_CONFIG.similarityThreshold
): boolean => {
  const text1 = piece1.text || '';
  const text2 = piece2.text || '';

  // Exact match after normalization
  if (normalizeText(text1) === normalizeText(text2)) return true;

  // 3-gram overlap check
  const overlap = calculate3GramOverlap(text1, text2);
  if (overlap >= threshold) return true;

  // Jaccard similarity as backup
  const jaccard = calculateJaccardSimilarity(text1, text2);
  return jaccard >= threshold;
};

// ========== Deduplication ==========

/**
 * Remove duplicate pieces based on semantic similarity
 */
export const dedupePieces = (
  pieces: QuadrantAgentPiece[],
  config: DedupeConfig = DEFAULT_DEDUPE_CONFIG
): { pieces: QuadrantAgentPiece[]; removed: number } => {
  const unique: QuadrantAgentPiece[] = [];
  let removed = 0;

  for (const piece of pieces) {
    const isDuplicate = unique.some(existing =>
      arePiecesSimilar(piece, existing, config.similarityThreshold)
    );

    if (isDuplicate) {
      removed++;
      console.log(`[Dedupe] Removed duplicate: "${piece.text}"`);
    } else {
      unique.push(piece);
    }
  }

  return { pieces: unique, removed };
};

/**
 * Enforce per-fragment quota
 */
export const enforceFragmentQuota = (
  pieces: QuadrantAgentPiece[],
  existingCounts: Map<string, number>,
  maxPerFragment: number = DEFAULT_DEDUPE_CONFIG.maxPerFragment
): { pieces: QuadrantAgentPiece[]; removed: number } => {
  const counts = new Map(existingCounts);
  const allowed: QuadrantAgentPiece[] = [];
  let removed = 0;

  for (const piece of pieces) {
    const fragmentId = piece.fragment_id;
    if (!fragmentId) {
      // No fragment reference, allow it
      allowed.push(piece);
      continue;
    }

    const currentCount = counts.get(fragmentId) || 0;
    if (currentCount >= maxPerFragment) {
      removed++;
      console.log(`[Quota] Fragment over-quota (${currentCount}/${maxPerFragment}): "${piece.text}"`);
    } else {
      counts.set(fragmentId, currentCount + 1);
      allowed.push(piece);
    }
  }

  return { pieces: allowed, removed };
};

/**
 * Enforce per-theme quota
 */
export const enforceThemeQuota = (
  pieces: QuadrantAgentPiece[],
  existingCounts: Map<string, number>,
  maxPerTheme: number = DEFAULT_DEDUPE_CONFIG.maxPerTheme
): { pieces: QuadrantAgentPiece[]; removed: number } => {
  const counts = new Map(existingCounts);
  const allowed: QuadrantAgentPiece[] = [];
  let removed = 0;

  for (const piece of pieces) {
    // Extract theme-like keywords from piece text
    const text = normalizeText(piece.text || '');
    const words = text.split(' ').filter(w => w.length > 3);

    let overQuota = false;
    for (const word of words) {
      const currentCount = counts.get(word) || 0;
      if (currentCount >= maxPerTheme) {
        overQuota = true;
        break;
      }
    }

    if (overQuota) {
      removed++;
      console.log(`[Quota] Theme over-quota: "${piece.text}"`);
    } else {
      // Update counts for all keywords
      for (const word of words) {
        counts.set(word, (counts.get(word) || 0) + 1);
      }
      allowed.push(piece);
    }
  }

  return { pieces: allowed, removed };
};

// ========== Combined Diversity Pipeline ==========

/**
 * Run full diversity pipeline: dedupe + fragment quota + theme quota
 */
export const applyDiversityPipeline = (
  pieces: QuadrantAgentPiece[],
  existingFragmentCounts: Map<string, number> = new Map(),
  existingThemeCounts: Map<string, number> = new Map(),
  config: DedupeConfig = DEFAULT_DEDUPE_CONFIG
): { pieces: QuadrantAgentPiece[]; stats: DiversityStats } => {
  const filterReasons: Record<string, number> = {};
  const initialCount = pieces.length;

  // Step 1: Remove blacklisted
  let current = pieces.filter(p => {
    if (isBlacklistedPhrase(p.text || '')) {
      filterReasons['blacklisted'] = (filterReasons['blacklisted'] || 0) + 1;
      return false;
    }
    return true;
  });
  const afterBlacklist = current.length;

  // Step 2: Dedupe
  const dedupeResult = dedupePieces(current, config);
  current = dedupeResult.pieces;
  filterReasons['duplicate'] = dedupeResult.removed;
  const afterDedupe = current.length;

  // Step 3: Fragment quota
  const fragmentResult = enforceFragmentQuota(current, existingFragmentCounts, config.maxPerFragment);
  current = fragmentResult.pieces;
  filterReasons['fragment_quota'] = fragmentResult.removed;

  // Step 4: Theme quota
  const themeResult = enforceThemeQuota(current, existingThemeCounts, config.maxPerTheme);
  current = themeResult.pieces;
  filterReasons['theme_quota'] = themeResult.removed;
  const afterQuota = current.length;

  // Calculate stats
  const uniqueFragments = new Set(current.map(p => p.fragment_id).filter(Boolean));
  const stats: DiversityStats = {
    totalGenerated: initialCount,
    afterBlacklist,
    afterDedupe,
    afterQuota,
    uniqueRate: initialCount > 0 ? afterQuota / initialCount : 0,
    fragmentCoverage: uniqueFragments.size,
    filterReasons,
  };

  return { pieces: current, stats };
};

/**
 * Log diversity stats to console
 */
export const logDiversityStats = (stats: DiversityStats, mode: string): void => {
  console.log(`[DIVERSITY STATS] ${mode}:
  Generated: ${stats.totalGenerated}
  After blacklist: ${stats.afterBlacklist}
  After dedupe: ${stats.afterDedupe}
  After quota: ${stats.afterQuota}
  Unique rate: ${(stats.uniqueRate * 100).toFixed(1)}%
  Fragment coverage: ${stats.fragmentCoverage} unique fragments
  Filter reasons: ${JSON.stringify(stats.filterReasons)}`);
};

// ========== Avoid Phrases for Retry ==========

/**
 * Extract phrases to avoid from rejected pieces
 */
export const extractAvoidPhrases = (
  rejectedPieces: QuadrantAgentPiece[]
): string[] => {
  return rejectedPieces
    .map(p => normalizeText(p.text || ''))
    .filter(t => t.length > 0);
};

/**
 * Check if a piece matches any avoid phrase
 */
export const matchesAvoidPhrase = (
  piece: QuadrantAgentPiece,
  avoidPhrases: string[]
): boolean => {
  const normalized = normalizeText(piece.text || '');
  return avoidPhrases.some(phrase => {
    if (normalized === phrase) return true;
    return calculate3GramOverlap(normalized, phrase) > 0.7;
  });
};
