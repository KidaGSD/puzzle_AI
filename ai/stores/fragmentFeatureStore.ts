/**
 * Fragment Feature Store
 *
 * Caches extracted features per fragment to avoid repeated Gemini API calls.
 * Features are extracted once and reused until fragment changes or cache expires.
 */

import { Fragment, FragmentType } from "../../domain/models";
import { LLMClient } from "../adkClient";
import {
  TextFeatures,
  ImageFeatures,
  extractTextFeaturesWithGemini,
  extractImageFeaturesWithVision,
  extractTextFeaturesLocal,
  extractImageFeaturesFromMetadata,
} from "../agents/featureExtractionAgent";

// ========== Types ==========

export type AnalysisStatus = 'pending' | 'complete' | 'failed' | 'stale';

export interface StoredFeatures {
  fragmentId: string;
  fragmentType: FragmentType;
  textFeatures?: TextFeatures;
  imageFeatures?: ImageFeatures;
  combinedKeywords: string[];
  uniqueInsight: string;
  analysisStatus: AnalysisStatus;
  updatedAt: number;
  fragmentUpdatedAt?: number;  // Track when fragment itself was last modified
  usageCount: number;          // How many times used in pieces
}

export interface FeatureStoreStats {
  total: number;
  complete: number;
  pending: number;
  failed: number;
  stale: number;
}

// ========== Constants ==========

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours
const MAX_STORE_SIZE = 500;  // Limit memory usage

// ========== Feature Store Class ==========

export class FragmentFeatureStore {
  private store: Map<string, StoredFeatures> = new Map();
  private refreshQueue: Set<string> = new Set();
  private client: LLMClient | null = null;
  private imageClient: LLMClient | null = null;  // Separate client for image analysis

  constructor(client?: LLMClient, imageClient?: LLMClient) {
    this.client = client || null;
    this.imageClient = imageClient || null;
  }

  /**
   * Set the LLM clients (can be set after construction)
   * @param client - Client for text extraction (flash tier)
   * @param imageClient - Client for image analysis (image tier, optional)
   */
  setClient(client: LLMClient, imageClient?: LLMClient): void {
    this.client = client;
    if (imageClient) {
      this.imageClient = imageClient;
    }
  }

  /**
   * Get the appropriate client for a fragment type
   */
  private getClientForType(fragmentType: string): LLMClient | null {
    if (fragmentType === 'IMAGE' && this.imageClient) {
      return this.imageClient;
    }
    return this.client;
  }

  /**
   * Get features for a fragment (from cache or extract new)
   */
  async getFeatures(fragment: Fragment): Promise<StoredFeatures> {
    const cached = this.store.get(fragment.id);

    // Check if cache is valid
    if (cached && this.isCacheValid(cached, fragment)) {
      return cached;
    }

    // Extract new features
    return this.extractAndStore(fragment);
  }

  /**
   * Get features if cached, otherwise return null (non-blocking)
   */
  getCachedFeatures(fragmentId: string): StoredFeatures | null {
    return this.store.get(fragmentId) || null;
  }

  /**
   * Check if fragment has valid cached features
   */
  hasValidCache(fragment: Fragment): boolean {
    const cached = this.store.get(fragment.id);
    return cached ? this.isCacheValid(cached, fragment) : false;
  }

  /**
   * Force refresh features for a fragment
   */
  async refreshFeatures(fragment: Fragment): Promise<StoredFeatures> {
    return this.extractAndStore(fragment);
  }

  /**
   * Queue a fragment for background refresh
   */
  queueRefresh(fragmentId: string): void {
    this.refreshQueue.add(fragmentId);
  }

  /**
   * Process queued refreshes (call periodically)
   */
  async processRefreshQueue(fragments: Fragment[]): Promise<number> {
    let processed = 0;
    const fragmentMap = new Map(fragments.map(f => [f.id, f]));

    for (const fragmentId of this.refreshQueue) {
      const fragment = fragmentMap.get(fragmentId);
      if (fragment) {
        try {
          await this.extractAndStore(fragment);
          processed++;
        } catch (error) {
          console.warn(`[FeatureStore] Failed to refresh ${fragmentId}:`, error);
        }
      }
      this.refreshQueue.delete(fragmentId);
    }

    return processed;
  }

  /**
   * Mark a fragment's features as used (for novelty scoring)
   */
  incrementUsage(fragmentId: string): void {
    const cached = this.store.get(fragmentId);
    if (cached) {
      cached.usageCount++;
    }
  }

  /**
   * Get usage count for novelty scoring
   */
  getUsageCount(fragmentId: string): number {
    return this.store.get(fragmentId)?.usageCount || 0;
  }

  /**
   * Get all cached features
   */
  getAllFeatures(): StoredFeatures[] {
    return Array.from(this.store.values());
  }

  /**
   * Get features for multiple fragments (batch)
   */
  async getBatchFeatures(fragments: Fragment[]): Promise<StoredFeatures[]> {
    const results: StoredFeatures[] = [];

    for (const fragment of fragments) {
      const features = await this.getFeatures(fragment);
      results.push(features);
    }

    return results;
  }

  /**
   * Get store statistics
   */
  getStats(): FeatureStoreStats {
    const features = this.getAllFeatures();
    return {
      total: features.length,
      complete: features.filter(f => f.analysisStatus === 'complete').length,
      pending: features.filter(f => f.analysisStatus === 'pending').length,
      failed: features.filter(f => f.analysisStatus === 'failed').length,
      stale: features.filter(f => f.analysisStatus === 'stale').length,
    };
  }

  /**
   * Clear all cached features
   */
  clear(): void {
    this.store.clear();
    this.refreshQueue.clear();
  }

  /**
   * Remove features for a specific fragment
   */
  remove(fragmentId: string): void {
    this.store.delete(fragmentId);
    this.refreshQueue.delete(fragmentId);
  }

  // ========== Private Methods ==========

  private isCacheValid(cached: StoredFeatures, fragment: Fragment): boolean {
    const now = Date.now();
    const age = now - cached.updatedAt;

    // Expired by TTL
    if (age > CACHE_TTL_MS) {
      cached.analysisStatus = 'stale';
      this.queueRefresh(fragment.id);
      return false;
    }

    // Fragment was updated after cache
    const fragmentUpdated = fragment.updatedAt || fragment.createdAt || 0;
    if (cached.fragmentUpdatedAt && fragmentUpdated > cached.fragmentUpdatedAt) {
      cached.analysisStatus = 'stale';
      this.queueRefresh(fragment.id);
      return false;
    }

    // Failed status should be retried
    if (cached.analysisStatus === 'failed') {
      return false;
    }

    return cached.analysisStatus === 'complete';
  }

  private async extractAndStore(fragment: Fragment): Promise<StoredFeatures> {
    const isText = fragment.type === "TEXT" || fragment.type === "OTHER";
    const isImage = fragment.type === "IMAGE";

    // Create pending entry
    const pending: StoredFeatures = {
      fragmentId: fragment.id,
      fragmentType: fragment.type,
      combinedKeywords: [],
      uniqueInsight: "",
      analysisStatus: 'pending',
      updatedAt: Date.now(),
      fragmentUpdatedAt: fragment.updatedAt || fragment.createdAt,
      usageCount: this.store.get(fragment.id)?.usageCount || 0,  // Preserve usage count
    };

    this.store.set(fragment.id, pending);
    this.enforceMaxSize();

    try {
      let textFeatures: TextFeatures | undefined;
      let imageFeatures: ImageFeatures | undefined;
      let uniqueInsight = "";

      // Extract text features
      if (isText && fragment.content) {
        if (this.client && !this.client.isMock) {
          textFeatures = await extractTextFeaturesWithGemini(
            fragment.content,
            fragment.title || "Untitled",
            this.client
          );
        } else {
          textFeatures = extractTextFeaturesLocal(fragment.content);
        }
        uniqueInsight = textFeatures.uniqueInsight || "";
      }

      // Extract image features - use imageClient if available for better quality
      if (isImage && fragment.content) {
        const imgClient = this.imageClient || this.client;
        if (imgClient && !imgClient.isMock) {
          imageFeatures = await extractImageFeaturesWithVision(
            fragment.content,
            fragment.title || "Image",
            imgClient
          );
        } else {
          imageFeatures = extractImageFeaturesFromMetadata(
            fragment.title || "",
            fragment.summary
          );
        }
        uniqueInsight = imageFeatures.uniqueInsight || uniqueInsight;
      }

      // Combine keywords
      const combinedKeywords = [
        ...(textFeatures?.keywords || []),
        ...(textFeatures?.entities || []),
        ...(textFeatures?.themes || []),
        ...(imageFeatures?.colors || []),
        ...(imageFeatures?.objects || []),
      ];

      // Update with complete features
      const complete: StoredFeatures = {
        ...pending,
        textFeatures,
        imageFeatures,
        combinedKeywords: [...new Set(combinedKeywords)].slice(0, 20),
        uniqueInsight,
        analysisStatus: 'complete',
        updatedAt: Date.now(),
      };

      this.store.set(fragment.id, complete);
      console.log(`[FeatureStore] Extracted features for "${fragment.title || fragment.id}": ${complete.combinedKeywords.length} keywords`);

      return complete;

    } catch (error) {
      console.error(`[FeatureStore] Failed to extract features for ${fragment.id}:`, error);

      // Mark as failed but keep partial data
      const failed: StoredFeatures = {
        ...pending,
        analysisStatus: 'failed',
        updatedAt: Date.now(),
      };

      this.store.set(fragment.id, failed);
      return failed;
    }
  }

  private enforceMaxSize(): void {
    if (this.store.size <= MAX_STORE_SIZE) return;

    // Remove oldest entries first (by updatedAt)
    const entries = Array.from(this.store.entries())
      .sort((a, b) => a[1].updatedAt - b[1].updatedAt);

    const toRemove = entries.slice(0, this.store.size - MAX_STORE_SIZE);
    for (const [id] of toRemove) {
      this.store.delete(id);
    }

    console.log(`[FeatureStore] Evicted ${toRemove.length} entries to stay under limit`);
  }
}

// ========== Singleton Instance ==========

let globalStore: FragmentFeatureStore | null = null;

export const getFeatureStore = (): FragmentFeatureStore => {
  if (!globalStore) {
    globalStore = new FragmentFeatureStore();
  }
  return globalStore;
};

/**
 * Initialize the feature store with LLM clients
 * @param client - Client for text extraction (flash tier)
 * @param imageClient - Optional client for image analysis (image tier)
 */
export const initFeatureStore = (client: LLMClient, imageClient?: LLMClient): FragmentFeatureStore => {
  if (!globalStore) {
    globalStore = new FragmentFeatureStore(client, imageClient);
  } else {
    globalStore.setClient(client, imageClient);
  }
  return globalStore;
};
