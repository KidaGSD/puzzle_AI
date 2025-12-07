/**
 * PiecePrecomputer - Pre-generates puzzle pieces in background
 *
 * When InsightPrecomputer completes, this service immediately generates
 * pieces for all quadrants. Results are cached for instant puzzle creation.
 *
 * Flow:
 * 1. InsightPrecomputer finishes -> triggers recompute
 * 2. PiecePrecomputer runs QuadrantManager in background
 * 3. Results cached with fragment hash for invalidation
 * 4. Runner checks cache first -> instant if valid
 */

import { DesignMode, PuzzleType, Anchor } from "../../../domain/models";
import { LLMClient, createFlashClient } from "../../adkClient";
import { PieceSchema } from "../schemas/puzzleSchemas";
import { runQuadrantManager, EnrichedFragment } from "../agents/quadrantManagerAgent";
import { PrecomputedInsights } from "./insightPrecomputer";
import { applyDiversityFilter } from "../agents/filterAgent";

// ========== Types ==========

export interface PrecomputedPieces {
  pieces: Record<DesignMode, PieceSchema[]>;
  centralQuestion: string;
  puzzleType: PuzzleType;
  timestamp: number;
  fragmentHash: string;
  qualityScore: number;
  isValid: boolean;
}

export interface PiecePrecomputerStatus {
  isReady: boolean;
  isComputing: boolean;
  lastComputed: number;
  pieceCount: Record<DesignMode, number>;
  fragmentHash: string | null;
}

// ========== Hash Utility ==========

/**
 * Generate a hash from fragment IDs for cache invalidation
 */
const generateFragmentHash = (fragments: EnrichedFragment[]): string => {
  const ids = fragments.map(f => f.id).sort().join('|');
  // Simple hash: use first 8 chars of joined IDs
  let hash = 0;
  for (let i = 0; i < ids.length; i++) {
    const char = ids.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).slice(0, 8);
};

// ========== PiecePrecomputer Class ==========

export class PiecePrecomputer {
  private cachedPieces: PrecomputedPieces | null = null;
  private flashClient: LLMClient;
  private computing: boolean = false;
  private readonly CACHE_VALIDITY_MS = 600000; // 10 minutes

  constructor() {
    this.flashClient = createFlashClient();
    console.log('[PiecePrecomputer] Initialized');
  }

  // ========== Public API ==========

  /**
   * Precompute pieces from insights
   * Called when InsightPrecomputer finishes
   */
  async precomputePieces(
    insights: PrecomputedInsights,
    fragments: EnrichedFragment[],
    processAim: string,
    puzzleType: PuzzleType = 'CLARIFY',
    anchors: Anchor[] = []
  ): Promise<PrecomputedPieces | null> {
    if (this.computing) {
      console.log('[PiecePrecomputer] Already computing, skipping');
      return this.cachedPieces;
    }

    // Check if we need to recompute
    const newHash = generateFragmentHash(fragments);
    if (this.cachedPieces &&
        this.cachedPieces.fragmentHash === newHash &&
        !this.isStale()) {
      console.log('[PiecePrecomputer] Cache still valid, skipping');
      return this.cachedPieces;
    }

    this.computing = true;
    const startTime = Date.now();
    console.log(`[PiecePrecomputer] Starting precomputation for ${fragments.length} fragments...`);

    try {
      // Use the best question from insights
      const centralQuestion = insights.potentialQuestions.length > 0
        ? insights.potentialQuestions[0].question
        : `What is the core design direction for ${processAim.split(' ').slice(0, 4).join(' ')}?`;

      // Get preference hints from insights
      const preferenceHints = insights.preferenceHints;

      // Run QuadrantManager with precomputed data
      const managerResult = await runQuadrantManager({
        processAim,
        puzzleType,
        centralQuestion,
        fragments,
        anchors,
        preferenceHints,
        avoidPhrases: []
      }, this.flashClient);

      // Apply final diversity filter
      const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];
      const finalPieces: Record<DesignMode, PieceSchema[]> = {
        FORM: [],
        MOTION: [],
        EXPRESSION: [],
        FUNCTION: []
      };

      for (const mode of modes) {
        const modePieces = managerResult.pieces[mode];
        if (modePieces && modePieces.length > 0) {
          const filtered = applyDiversityFilter(modePieces, [], []);
          finalPieces[mode] = filtered.pieces;
        }
      }

      // Cache the results
      this.cachedPieces = {
        pieces: finalPieces,
        centralQuestion,
        puzzleType,
        timestamp: Date.now(),
        fragmentHash: newHash,
        qualityScore: managerResult.meta.qualityScore,
        isValid: true
      };

      const duration = Date.now() - startTime;
      const totalPieces = modes.reduce((sum, m) => sum + finalPieces[m].length, 0);
      console.log(`[PiecePrecomputer] Precomputed ${totalPieces} pieces in ${duration}ms`);

      return this.cachedPieces;

    } catch (error) {
      console.error('[PiecePrecomputer] Error:', error);
      return null;
    } finally {
      this.computing = false;
    }
  }

  /**
   * Get cached pieces (instant access)
   */
  getCachedPieces(): PrecomputedPieces | null {
    if (!this.cachedPieces) return null;

    // Mark as invalid if stale
    if (this.isStale()) {
      this.cachedPieces.isValid = false;
    }

    return this.cachedPieces;
  }

  /**
   * Check if cache is valid for given fragments
   */
  isCacheValidFor(fragments: EnrichedFragment[]): boolean {
    if (!this.cachedPieces || !this.cachedPieces.isValid) return false;

    const currentHash = generateFragmentHash(fragments);
    return this.cachedPieces.fragmentHash === currentHash && !this.isStale();
  }

  /**
   * Check if precomputed pieces are ready
   */
  get isReady(): boolean {
    return this.cachedPieces !== null && this.cachedPieces.isValid && !this.isStale();
  }

  /**
   * Get status
   */
  getStatus(): PiecePrecomputerStatus {
    return {
      isReady: this.isReady,
      isComputing: this.computing,
      lastComputed: this.cachedPieces?.timestamp || 0,
      pieceCount: this.cachedPieces ? {
        FORM: this.cachedPieces.pieces.FORM.length,
        MOTION: this.cachedPieces.pieces.MOTION.length,
        EXPRESSION: this.cachedPieces.pieces.EXPRESSION.length,
        FUNCTION: this.cachedPieces.pieces.FUNCTION.length
      } : { FORM: 0, MOTION: 0, EXPRESSION: 0, FUNCTION: 0 },
      fragmentHash: this.cachedPieces?.fragmentHash || null
    };
  }

  /**
   * Invalidate cache
   */
  invalidate(): void {
    if (this.cachedPieces) {
      this.cachedPieces.isValid = false;
    }
    console.log('[PiecePrecomputer] Cache invalidated');
  }

  /**
   * Clear cache entirely
   */
  clear(): void {
    this.cachedPieces = null;
    console.log('[PiecePrecomputer] Cache cleared');
  }

  // ========== Internal ==========

  private isStale(): boolean {
    if (!this.cachedPieces) return true;
    return Date.now() - this.cachedPieces.timestamp > this.CACHE_VALIDITY_MS;
  }
}

// Singleton instance
export const piecePrecomputer = new PiecePrecomputer();
