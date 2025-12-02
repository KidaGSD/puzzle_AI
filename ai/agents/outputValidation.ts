/**
 * Output Validation Module
 *
 * Validates AI-generated outputs to ensure they are grounded in fragment content
 * and not just generic/hardcoded responses.
 *
 * Key checks:
 * 1. Piece titles should not match known hardcoded examples
 * 2. Pieces should cite fragment content when fragments are provided
 * 3. Central questions should not be generic defaults
 */

import { QuadrantAgentPiece, FragmentSummary } from "../../domain/models";

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
