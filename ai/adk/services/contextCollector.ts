/**
 * ContextCollector - Background service for fragment analysis
 *
 * Responsibilities:
 * - Watch for fragment changes (debounced)
 * - Extract features using Flash model
 * - Build mode relevance index
 * - Cache results for instant access
 *
 * This runs in the background and never blocks UI.
 */

import { Fragment, DesignMode } from "../../../domain/models";
import { LLMClient, createFlashClient, JsonSchema } from "../../adkClient";

// ========== Types ==========

export interface FragmentFeature {
  fragmentId: string;
  type: 'TEXT' | 'IMAGE';
  keywords: string[];
  themes: string[];
  mood?: string;
  palette?: string[];
  objects?: string[];
  uniqueInsight?: string;
  modeScores: Record<DesignMode, number>;
  extractedAt: number;
}

export interface ContextCache {
  fragmentFeatures: Map<string, FragmentFeature>;
  modeRelevance: Record<DesignMode, string[]>;  // fragmentIds per mode, sorted by relevance
  themes: Map<string, string[]>;  // theme -> fragmentIds
  lastUpdated: number;
  isReady: boolean;
  fragmentCount: number;
}

// ========== Mode Keywords for Scoring ==========

const MODE_KEYWORDS: Record<DesignMode, { primary: string[]; secondary: string[] }> = {
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

// ========== Feature Extraction Schema ==========

const TEXT_FEATURE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key nouns and concepts from the text (5-10)'
    },
    themes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Design themes (e.g., minimalist, organic, traditional)'
    },
    mood: {
      type: 'string',
      description: 'Overall emotional tone'
    },
    uniqueInsight: {
      type: 'string',
      description: 'One unique design insight from this fragment'
    }
  },
  required: ['keywords', 'themes']
};

const IMAGE_FEATURE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key visual elements and concepts'
    },
    themes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Visual/design themes'
    },
    mood: {
      type: 'string',
      description: 'Emotional tone of the image'
    },
    palette: {
      type: 'array',
      items: { type: 'string' },
      description: 'Dominant colors (e.g., warm brass, deep green)'
    },
    objects: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key objects/subjects in the image'
    },
    uniqueInsight: {
      type: 'string',
      description: 'One unique design insight from this image'
    }
  },
  required: ['keywords', 'themes']
};

// ========== ContextCollector Class ==========

// Event callback type for notifying when context is ready
type ContextReadyCallback = () => void;

export class ContextCollector {
  private cache: ContextCache;
  private flashClient: LLMClient;
  private processing: boolean = false;
  private pendingFragmentIds: Set<string> = new Set();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly DEBOUNCE_MS = 500;
  private onReadyCallbacks: ContextReadyCallback[] = [];

  constructor() {
    this.cache = {
      fragmentFeatures: new Map(),
      modeRelevance: { FORM: [], MOTION: [], EXPRESSION: [], FUNCTION: [] },
      themes: new Map(),
      lastUpdated: 0,
      isReady: false,
      fragmentCount: 0
    };
    this.flashClient = createFlashClient();
    console.log('[ContextCollector] Initialized with Flash model');
  }

  // ========== Public API ==========

  /**
   * Called when fragments change - debounces and batch processes
   */
  onFragmentChange(fragments: Fragment[]): void {
    fragments.forEach(f => this.pendingFragmentIds.add(f.id));

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processFragments(fragments);
    }, this.DEBOUNCE_MS);
  }

  /**
   * Force immediate processing (for initial load)
   */
  async processImmediately(fragments: Fragment[]): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    await this.processFragments(fragments);
  }

  /**
   * Get cached features for a fragment
   */
  getFeatures(fragmentId: string): FragmentFeature | undefined {
    return this.cache.fragmentFeatures.get(fragmentId);
  }

  /**
   * Get all cached features
   */
  getAllFeatures(): Map<string, FragmentFeature> {
    return this.cache.fragmentFeatures;
  }

  /**
   * Get fragments sorted by relevance for a mode
   */
  getFragmentsForMode(mode: DesignMode): string[] {
    return this.cache.modeRelevance[mode];
  }

  /**
   * Get fragments by theme
   */
  getFragmentsByTheme(theme: string): string[] {
    return this.cache.themes.get(theme) || [];
  }

  /**
   * Check if collector is ready
   */
  get isReady(): boolean {
    return this.cache.isReady;
  }

  /**
   * Get cache status
   */
  getStatus(): { isReady: boolean; fragmentCount: number; lastUpdated: number } {
    return {
      isReady: this.cache.isReady,
      fragmentCount: this.cache.fragmentCount,
      lastUpdated: this.cache.lastUpdated
    };
  }

  /**
   * Register callback to be notified when context becomes ready
   * This enables event-driven precomputation instead of polling
   */
  onReady(callback: ContextReadyCallback): () => void {
    this.onReadyCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      const index = this.onReadyCallbacks.indexOf(callback);
      if (index > -1) {
        this.onReadyCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all registered callbacks that context is ready
   */
  private notifyReady(): void {
    console.log(`[ContextCollector] Notifying ${this.onReadyCallbacks.length} callbacks that context is ready`);
    for (const callback of this.onReadyCallbacks) {
      try {
        callback();
      } catch (err) {
        console.warn('[ContextCollector] Callback error:', err);
      }
    }
  }

  // ========== Internal Processing ==========

  private async processFragments(fragments: Fragment[]): Promise<void> {
    if (this.processing) {
      console.log('[ContextCollector] Already processing, skipping');
      return;
    }

    this.processing = true;
    const startTime = Date.now();
    console.log(`[ContextCollector] Processing ${fragments.length} fragments...`);

    try {
      // Process fragments in parallel batches (max 4 concurrent)
      const BATCH_SIZE = 4;
      for (let i = 0; i < fragments.length; i += BATCH_SIZE) {
        const batch = fragments.slice(i, i + BATCH_SIZE);
        const promises = batch.map(f => this.extractFeatures(f));
        const results = await Promise.allSettled(promises);

        results.forEach((result, idx) => {
          if (result.status === 'fulfilled' && result.value) {
            this.cache.fragmentFeatures.set(batch[idx].id, result.value);
          } else if (result.status === 'rejected') {
            console.warn(`[ContextCollector] Failed to extract features for ${batch[idx].id}:`, result.reason);
          }
        });
      }

      // Rebuild indexes
      this.buildModeIndex();
      this.buildThemeIndex();

      // Update cache metadata
      this.cache.lastUpdated = Date.now();
      this.cache.fragmentCount = this.cache.fragmentFeatures.size;
      const wasReady = this.cache.isReady;
      this.cache.isReady = this.cache.fragmentCount > 0;

      const duration = Date.now() - startTime;
      console.log(`[ContextCollector] Processed ${fragments.length} fragments in ${duration}ms`);

      // Notify listeners when context becomes ready (or is updated)
      if (this.cache.isReady) {
        this.notifyReady();
      }

    } catch (error) {
      console.error('[ContextCollector] Processing error:', error);
    } finally {
      this.processing = false;
      this.pendingFragmentIds.clear();
    }
  }

  /**
   * Extract features for a single fragment
   */
  private async extractFeatures(fragment: Fragment): Promise<FragmentFeature | null> {
    try {
      const isImage = fragment.type === 'IMAGE';

      if (isImage) {
        return await this.extractImageFeatures(fragment);
      } else {
        return await this.extractTextFeatures(fragment);
      }
    } catch (error) {
      console.warn(`[ContextCollector] Feature extraction failed for ${fragment.id}:`, error);
      // Return basic features from local analysis
      return this.extractLocalFeatures(fragment);
    }
  }

  /**
   * Extract features from text fragment using LLM
   */
  private async extractTextFeatures(fragment: Fragment): Promise<FragmentFeature> {
    const content = fragment.content || fragment.summary || '';

    if (content.length < 10) {
      return this.extractLocalFeatures(fragment);
    }

    const prompt = `Analyze this design fragment and extract key features.

Fragment:
"""
${content.slice(0, 500)}
"""

Extract:
1. Keywords: Concrete nouns and concepts (5-10)
2. Themes: Design themes (e.g., minimalist, organic)
3. Mood: Overall emotional tone
4. Unique Insight: One design insight`;

    const result = await this.flashClient.generateStructured<{
      keywords: string[];
      themes: string[];
      mood?: string;
      uniqueInsight?: string;
    }>(prompt, TEXT_FEATURE_SCHEMA, 0.3);

    const modeScores = this.calculateModeScores(result.keywords, result.themes, fragment.type);

    return {
      fragmentId: fragment.id,
      type: 'TEXT',
      keywords: result.keywords || [],
      themes: result.themes || [],
      mood: result.mood,
      uniqueInsight: result.uniqueInsight,
      modeScores,
      extractedAt: Date.now()
    };
  }

  /**
   * Extract features from image fragment using Vision
   */
  private async extractImageFeatures(fragment: Fragment): Promise<FragmentFeature> {
    // For images, use local fallback if no URL
    if (!fragment.content || !fragment.content.startsWith('http')) {
      return this.extractLocalFeatures(fragment);
    }

    try {
      const prompt = `Analyze this design image and extract visual features for a design project.

Extract:
1. Keywords: Visual elements and concepts
2. Themes: Visual/design themes
3. Mood: Emotional tone
4. Palette: Dominant colors (descriptive, e.g., "warm brass", "deep green")
5. Objects: Key subjects in the image
6. Unique Insight: One design insight`;

      const result = await this.flashClient.generateStructuredWithImages<{
        keywords: string[];
        themes: string[];
        mood?: string;
        palette?: string[];
        objects?: string[];
        uniqueInsight?: string;
      }>(
        prompt,
        [{ url: fragment.content, mimeType: 'image/jpeg' }],
        IMAGE_FEATURE_SCHEMA,
        0.3
      );

      const modeScores = this.calculateModeScores(
        [...(result.keywords || []), ...(result.objects || [])],
        result.themes || [],
        'IMAGE'
      );

      return {
        fragmentId: fragment.id,
        type: 'IMAGE',
        keywords: result.keywords || [],
        themes: result.themes || [],
        mood: result.mood,
        palette: result.palette,
        objects: result.objects,
        uniqueInsight: result.uniqueInsight,
        modeScores,
        extractedAt: Date.now()
      };
    } catch (error) {
      console.warn(`[ContextCollector] Vision analysis failed for ${fragment.id}, using fallback`);
      return this.extractLocalFeatures(fragment);
    }
  }

  /**
   * Local feature extraction (no LLM, fast fallback)
   */
  private extractLocalFeatures(fragment: Fragment): FragmentFeature {
    const content = (fragment.content || fragment.summary || '').toLowerCase();
    const tags = fragment.tags || [];

    // Extract keywords from content
    const words = content.split(/\s+/).filter(w => w.length > 3);
    const keywords = [...new Set([...tags, ...words.slice(0, 10)])];

    // Calculate mode scores from keywords
    const modeScores = this.calculateModeScores(keywords, tags, fragment.type);

    return {
      fragmentId: fragment.id,
      type: fragment.type === 'IMAGE' ? 'IMAGE' : 'TEXT',
      keywords,
      themes: tags,
      modeScores,
      extractedAt: Date.now()
    };
  }

  /**
   * Calculate relevance scores for each mode
   */
  private calculateModeScores(
    keywords: string[],
    themes: string[],
    type: string
  ): Record<DesignMode, number> {
    const allContent = [...keywords, ...themes].join(' ').toLowerCase();
    const scores: Record<DesignMode, number> = {
      FORM: 0,
      MOTION: 0,
      EXPRESSION: 0,
      FUNCTION: 0
    };

    const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];

    for (const mode of modes) {
      const modeKeys = MODE_KEYWORDS[mode];

      // Primary keywords: +3 each
      for (const kw of modeKeys.primary) {
        if (allContent.includes(kw)) {
          scores[mode] += 3;
        }
      }

      // Secondary keywords: +1 each
      for (const kw of modeKeys.secondary) {
        if (allContent.includes(kw)) {
          scores[mode] += 1;
        }
      }
    }

    // Image bonus for FORM and EXPRESSION
    if (type === 'IMAGE') {
      scores.FORM += 2;
      scores.EXPRESSION += 2;
    }

    return scores;
  }

  /**
   * Build mode relevance index (fragments sorted by relevance per mode)
   */
  private buildModeIndex(): void {
    const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];

    for (const mode of modes) {
      const scored: Array<{ id: string; score: number }> = [];

      this.cache.fragmentFeatures.forEach((features, id) => {
        scored.push({ id, score: features.modeScores[mode] });
      });

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // Store top fragments for this mode
      this.cache.modeRelevance[mode] = scored
        .filter(s => s.score > 0)
        .map(s => s.id);
    }

    console.log(`[ContextCollector] Mode index built: FORM=${this.cache.modeRelevance.FORM.length}, MOTION=${this.cache.modeRelevance.MOTION.length}, EXPRESSION=${this.cache.modeRelevance.EXPRESSION.length}, FUNCTION=${this.cache.modeRelevance.FUNCTION.length}`);
  }

  /**
   * Build theme index (fragments grouped by theme)
   */
  private buildThemeIndex(): void {
    this.cache.themes.clear();

    this.cache.fragmentFeatures.forEach((features, id) => {
      for (const theme of features.themes) {
        const normalizedTheme = theme.toLowerCase();
        if (!this.cache.themes.has(normalizedTheme)) {
          this.cache.themes.set(normalizedTheme, []);
        }
        this.cache.themes.get(normalizedTheme)!.push(id);
      }
    });

    console.log(`[ContextCollector] Theme index built: ${this.cache.themes.size} themes`);
  }
}

// Singleton instance
export const contextCollector = new ContextCollector();
