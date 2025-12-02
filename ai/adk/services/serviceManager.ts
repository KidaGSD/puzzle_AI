/**
 * ServiceManager - Lifecycle management for background AI services
 *
 * Started on app mount, stopped on unmount.
 * Coordinates ContextCollector and InsightPrecomputer.
 * Exposes ready state for UI indicators.
 */

import { Fragment } from "../../../domain/models";
import { EventBus } from "../../../store/eventBus";
import { ContextStore } from "../../../store/contextStore";
import { contextCollector, FragmentFeature } from "./contextCollector";
import { insightPrecomputer, PrecomputedInsights, EnrichedFragment } from "./insightPrecomputer";

// ========== Types ==========

export interface ServiceStatus {
  isReady: boolean;
  contextReady: boolean;
  insightsReady: boolean;
  fragmentCount: number;
  lastUpdated: number;
}

// ========== ServiceManager Class ==========

export class ServiceManager {
  private started: boolean = false;
  private eventUnsubscribe: (() => void) | null = null;
  private storeUnsubscribe: (() => void) | null = null;
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

    console.log('[ServiceManager] Background services started');
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
    return {
      isReady: contextCollector.isReady,
      contextReady: contextCollector.isReady,
      insightsReady: insightPrecomputer.isReady,
      fragmentCount: contextStatus.fragmentCount,
      lastUpdated: contextStatus.lastUpdated
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
   * Force immediate recomputation of insights
   */
  async forceRecompute(): Promise<void> {
    if (!this.store) return;

    const state = this.store.getState();
    await contextCollector.processImmediately(state.fragments);
    await insightPrecomputer.recompute(state.fragments, state.project.processAim);
  }
}

// Singleton instance
export const serviceManager = new ServiceManager();

// Export types and instances
export { contextCollector, insightPrecomputer };
export type { FragmentFeature, PrecomputedInsights, EnrichedFragment };
