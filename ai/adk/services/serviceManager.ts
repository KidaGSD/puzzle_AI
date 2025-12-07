/**
 * ServiceManager - Lifecycle management for background AI services
 *
 * Started on app mount, stopped on unmount.
 * Coordinates ContextCollector and InsightPrecomputer.
 * Exposes ready state for UI indicators.
 */

import { Fragment, PuzzleType, Anchor } from "../../../domain/models";
import { EventBus } from "../../../store/eventBus";
import { ContextStore } from "../../../store/contextStore";
import { contextCollector, FragmentFeature } from "./contextCollector";
import { insightPrecomputer, PrecomputedInsights, EnrichedFragment } from "./insightPrecomputer";
import { piecePrecomputer, PrecomputedPieces, PiecePrecomputerStatus } from "./piecePrecomputer";

// ========== Types ==========

export interface ServiceStatus {
  isReady: boolean;
  contextReady: boolean;
  insightsReady: boolean;
  piecesReady: boolean;
  fragmentCount: number;
  pieceCount: number;
  lastUpdated: number;
}

// ========== ServiceManager Class ==========

export class ServiceManager {
  private started: boolean = false;
  private eventUnsubscribe: (() => void) | null = null;
  private storeUnsubscribe: (() => void) | null = null;
  private contextReadyUnsubscribe: (() => void) | null = null;
  private store: ContextStore | null = null;

  // ========== Public API ==========

  /**
   * Start background services
   */
  start(eventBus: EventBus, store: ContextStore): void {
    if (this.started) {
      console.log('[ServiceManager] Already started');
      return;
    }

    this.store = store;
    this.started = true;
    console.log('[ServiceManager] Starting background AI services...');

    // Initial fragment processing
    const state = store.getState();
    if (state.fragments.length > 0) {
      console.log(`[ServiceManager] Processing ${state.fragments.length} initial fragments`);
      contextCollector.processImmediately(state.fragments);
    }

    // Subscribe to store changes for fragment updates
    this.storeUnsubscribe = store.subscribe(() => {
      const currentState = store.getState();
      contextCollector.onFragmentChange(currentState.fragments);
    });

    // Subscribe to fragment events
    this.eventUnsubscribe = eventBus.subscribe((event) => {
      if (event.type === 'FRAGMENT_ADDED' || event.type === 'FRAGMENT_UPDATED') {
        const currentState = store.getState();
        contextCollector.onFragmentChange(currentState.fragments);
      }
    });

    // Start insight precomputer with fragment getter
    const fragmentsGetter = () => store.getState().fragments;
    const processAim = state.project.processAim;
    insightPrecomputer.startPeriodicRecompute(fragmentsGetter, processAim);

    // EVENT-DRIVEN: Subscribe to context ready events for immediate precomputation
    this.contextReadyUnsubscribe = contextCollector.onReady(async () => {
      const currentState = store.getState();
      const currentProcessAim = currentState.project.processAim;
      console.log('[ServiceManager] Context ready - triggering immediate insight recomputation');

      // Step 1: Recompute insights
      await insightPrecomputer.recompute(currentState.fragments, currentProcessAim);

      // Step 2: If insights are ready and we have enough fragments, precompute pieces
      const insights = insightPrecomputer.getInsights();
      const enrichedFragments = this.getEnrichedFragments();
      if (insights && enrichedFragments && enrichedFragments.length >= 2) {
        console.log('[ServiceManager] Insights ready - triggering piece precomputation');
        await piecePrecomputer.precomputePieces(
          insights,
          enrichedFragments,
          currentProcessAim,
          'CLARIFY', // Default puzzle type
          []
        );
      }
    });

    console.log('[ServiceManager] Background services started with event-driven precomputation');
  }

  /**
   * Stop background services
   */
  stop(): void {
    if (!this.started) return;

    console.log('[ServiceManager] Stopping background AI services...');

    if (this.eventUnsubscribe) {
      this.eventUnsubscribe();
      this.eventUnsubscribe = null;
    }

    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }

    if (this.contextReadyUnsubscribe) {
      this.contextReadyUnsubscribe();
      this.contextReadyUnsubscribe = null;
    }

    insightPrecomputer.stopPeriodicRecompute();

    this.started = false;
    this.store = null;
    console.log('[ServiceManager] Background services stopped');
  }

  /**
   * Check if services are ready
   */
  isReady(): boolean {
    return contextCollector.isReady;
  }

  /**
   * Get detailed service status
   */
  getStatus(): ServiceStatus {
    const contextStatus = contextCollector.getStatus();
    const pieceStatus = piecePrecomputer.getStatus();
    const totalPieces = pieceStatus.pieceCount.FORM +
                        pieceStatus.pieceCount.MOTION +
                        pieceStatus.pieceCount.EXPRESSION +
                        pieceStatus.pieceCount.FUNCTION;
    return {
      isReady: contextCollector.isReady && piecePrecomputer.isReady,
      contextReady: contextCollector.isReady,
      insightsReady: insightPrecomputer.isReady,
      piecesReady: piecePrecomputer.isReady,
      fragmentCount: contextStatus.fragmentCount,
      pieceCount: totalPieces,
      lastUpdated: Math.max(contextStatus.lastUpdated, pieceStatus.lastComputed)
    };
  }

  /**
   * Get precomputed insights (instant access for puzzle generation)
   */
  getPrecomputedInsights(): PrecomputedInsights | null {
    return insightPrecomputer.getInsights();
  }

  /**
   * Get fragment features from context collector
   */
  getFragmentFeatures(fragmentId: string): FragmentFeature | undefined {
    return contextCollector.getFeatures(fragmentId);
  }

  /**
   * Get all fragment features
   */
  getAllFragmentFeatures(): Map<string, FragmentFeature> {
    return contextCollector.getAllFeatures();
  }

  /**
   * Get fragments sorted by relevance for a mode
   */
  getFragmentsForMode(mode: 'FORM' | 'MOTION' | 'EXPRESSION' | 'FUNCTION'): string[] {
    return contextCollector.getFragmentsForMode(mode);
  }

  /**
   * Get enriched fragments ready for puzzle generation
   */
  getEnrichedFragments(): EnrichedFragment[] | null {
    const insights = this.getPrecomputedInsights();
    if (!insights) return null;

    // Flatten all mode assignments into unique fragments
    const allFragments = new Map<string, EnrichedFragment>();
    const modes: Array<'FORM' | 'MOTION' | 'EXPRESSION' | 'FUNCTION'> = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];

    for (const mode of modes) {
      for (const fragment of insights.modeAssignments[mode]) {
        if (!allFragments.has(fragment.id)) {
          allFragments.set(fragment.id, fragment);
        }
      }
    }

    return Array.from(allFragments.values());
  }

  /**
   * Get precomputed pieces (instant access for puzzle creation)
   */
  getPrecomputedPieces(): PrecomputedPieces | null {
    return piecePrecomputer.getCachedPieces();
  }

  /**
   * Check if pieces are ready for given fragments
   */
  arePiecesReadyFor(fragments: EnrichedFragment[]): boolean {
    return piecePrecomputer.isCacheValidFor(fragments);
  }

  /**
   * Get piece precomputer status
   */
  getPieceStatus(): PiecePrecomputerStatus {
    return piecePrecomputer.getStatus();
  }

  /**
   * Force immediate recomputation of insights and pieces
   */
  async forceRecompute(): Promise<void> {
    if (!this.store) return;

    const state = this.store.getState();
    await contextCollector.processImmediately(state.fragments);
    await insightPrecomputer.recompute(state.fragments, state.project.processAim);

    // Also recompute pieces
    const insights = insightPrecomputer.getInsights();
    const enrichedFragments = this.getEnrichedFragments();
    if (insights && enrichedFragments && enrichedFragments.length >= 2) {
      await piecePrecomputer.precomputePieces(
        insights,
        enrichedFragments,
        state.project.processAim,
        'CLARIFY',
        []
      );
    }
  }
}

// Singleton instance
export const serviceManager = new ServiceManager();

// Export types and instances
export { contextCollector, insightPrecomputer };
export type { FragmentFeature, PrecomputedInsights, EnrichedFragment };
