/**
 * Fragment Ranker - Retrieval + Ranking Layer
 *
 * Replaces fixed 6/4 sampling with intelligent, diverse fragment selection.
 * Scores fragments by relevance, diversity, and novelty.
 */

import { Fragment, FragmentType, DesignMode } from "../../domain/models";
import { StoredFeatures, getFeatureStore } from "../stores/fragmentFeatureStore";
import { RankingPreferenceHints, toRankingHints } from "../stores/preferenceProfileStore";

// ========== Types ==========

export interface RankedFragment {
  fragment: Fragment;
  features: StoredFeatures;
  score: number;
  relevanceScore: number;
  diversityPenalty: number;
  noveltyBonus: number;
}

export interface SelectionBudget {
  totalTarget: number;       // Target total fragments
  perQuadrant: number;       // Target per quadrant
  maxTextPerQuadrant: number;
  maxImagePerQuadrant: number;
  maxPerTag: number;         // Hard cap per tag/theme
  maxPerFragment: number;    // Max pieces per fragment in session
}

export interface SelectionContext {
  processAim: string;
  centralQuestion?: string;
  selectedTags: Set<string>;
  selectedThemes: Set<string>;
  selectedFragmentIds: Set<string>;
  usedFragmentCounts: Map<string, number>;
  preferenceHints?: RankingPreferenceHints;  // Phase 6: Preference feedback
}

export interface QuadrantSelection {
  mode: DesignMode;
  fragments: RankedFragment[];
  globalContext: RankedFragment[];  // Top relevance shared across quadrants
}

// ========== Constants ==========

const DEFAULT_BUDGET: SelectionBudget = {
  totalTarget: 24,
  perQuadrant: 6,
  maxTextPerQuadrant: 4,
  maxImagePerQuadrant: 2,
  maxPerTag: 2,
  maxPerFragment: 2,
};

// Mode-specific aspect weights for relevance scoring
const MODE_ASPECTS: Record<DesignMode, string[]> = {
  FORM: ["visual", "shape", "structure", "composition", "layout", "geometric", "organic", "texture", "color", "pattern"],
  MOTION: ["movement", "animation", "transition", "timing", "rhythm", "flow", "speed", "easing", "dynamic", "pace"],
  EXPRESSION: ["emotion", "tone", "personality", "mood", "feeling", "voice", "warmth", "energy", "calm", "playful"],
  FUNCTION: ["purpose", "utility", "user", "audience", "platform", "accessibility", "interaction", "workflow", "task", "goal"],
};

// ========== Scoring Functions ==========

/**
 * Calculate keyword overlap between two sets
 */
const calculateKeywordOverlap = (keywords1: string[], keywords2: string[]): number => {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1.map(k => k.toLowerCase()));
  const set2 = new Set(keywords2.map(k => k.toLowerCase()));

  let overlap = 0;
  for (const k of set1) {
    if (set2.has(k)) overlap++;
  }

  // Jaccard-like score
  return overlap / Math.max(set1.size, set2.size);
};

/**
 * Extract keywords from text (simple tokenization)
 */
const extractKeywords = (text: string): string[] => {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 3);
};

/**
 * Calculate relevance score based on feature overlap with context
 */
const calculateRelevanceScore = (
  features: StoredFeatures,
  processAim: string,
  centralQuestion?: string,
  mode?: DesignMode
): number => {
  const contextKeywords = [
    ...extractKeywords(processAim),
    ...(centralQuestion ? extractKeywords(centralQuestion) : []),
  ];

  // Base relevance from keyword overlap
  let relevance = calculateKeywordOverlap(features.combinedKeywords, contextKeywords);

  // Boost for theme match
  const themes = features.textFeatures?.themes || [];
  const themeOverlap = calculateKeywordOverlap(themes, contextKeywords);
  relevance += themeOverlap * 0.3;

  // Mode-specific boost
  if (mode) {
    const modeAspects = MODE_ASPECTS[mode];
    const modeOverlap = calculateKeywordOverlap(features.combinedKeywords, modeAspects);
    relevance += modeOverlap * 0.2;
  }

  // Unique insight presence bonus
  if (features.uniqueInsight && features.uniqueInsight.length > 20) {
    relevance += 0.1;
  }

  return Math.min(1.0, relevance);
};

/**
 * Calculate diversity penalty based on already-selected items
 */
const calculateDiversityPenalty = (
  features: StoredFeatures,
  context: SelectionContext
): number => {
  let penalty = 0;

  // Penalty for repeated tags
  const tags = features.textFeatures?.themes || [];
  for (const tag of tags) {
    if (context.selectedTags.has(tag.toLowerCase())) {
      penalty += 0.15;
    }
  }

  // Penalty for same fragment already selected
  if (context.selectedFragmentIds.has(features.fragmentId)) {
    penalty += 0.5;
  }

  // Penalty for over-used fragments
  const usageCount = context.usedFragmentCounts.get(features.fragmentId) || 0;
  if (usageCount >= 2) {
    penalty += 0.3 * (usageCount - 1);
  }

  // Penalty for repeated themes
  const themes = features.textFeatures?.themes || [];
  for (const theme of themes) {
    if (context.selectedThemes.has(theme.toLowerCase())) {
      penalty += 0.1;
    }
  }

  return Math.min(1.0, penalty);
};

/**
 * Calculate novelty bonus for underused fragments
 */
const calculateNoveltyBonus = (
  features: StoredFeatures,
  preferenceHints?: RankingPreferenceHints
): number => {
  // Low usage = high novelty
  const usageCount = features.usageCount || 0;
  let bonus = 0;
  if (usageCount === 0) bonus = 0.2;
  else if (usageCount === 1) bonus = 0.1;
  else if (usageCount === 2) bonus = 0.05;

  // Apply preference-based novelty boost
  if (preferenceHints && preferenceHints.noveltyBonus > 0) {
    bonus += preferenceHints.noveltyBonus;
  }

  return bonus;
};

/**
 * Calculate preference-based theme adjustment
 */
const calculatePreferenceAdjustment = (
  features: StoredFeatures,
  preferenceHints?: RankingPreferenceHints
): number => {
  if (!preferenceHints) return 0;

  let adjustment = 0;
  const themes = features.textFeatures?.themes || [];

  for (const theme of themes) {
    const themeLower = theme.toLowerCase();

    // Bonus for preferred themes
    if (preferenceHints.preferredThemes.has(themeLower)) {
      adjustment += preferenceHints.preferredThemeBonus;
    }

    // Penalty for avoided themes
    if (preferenceHints.avoidThemes.has(themeLower)) {
      adjustment -= preferenceHints.avoidThemePenalty;
    }
  }

  return adjustment;
};

// ========== Main Ranker Class ==========

export class FragmentRanker {
  private budget: SelectionBudget;

  constructor(budget?: Partial<SelectionBudget>) {
    this.budget = { ...DEFAULT_BUDGET, ...budget };
  }

  /**
   * Rank all fragments and select for a puzzle session
   */
  async rankAndSelect(
    fragments: Fragment[],
    processAim: string,
    centralQuestion?: string,
    sessionId?: string  // Phase 6: For preference feedback
  ): Promise<{
    global: RankedFragment[];
    perMode: Map<DesignMode, RankedFragment[]>;
  }> {
    const store = getFeatureStore();

    // Get preference hints if session ID provided
    const preferenceHints = sessionId ? toRankingHints(sessionId) : undefined;

    // Get features for all fragments
    const featuresMap = new Map<string, StoredFeatures>();
    for (const fragment of fragments) {
      const features = await store.getFeatures(fragment);
      featuresMap.set(fragment.id, features);
    }

    // Initial context
    const context: SelectionContext = {
      processAim,
      centralQuestion,
      selectedTags: new Set(),
      selectedThemes: new Set(),
      selectedFragmentIds: new Set(),
      usedFragmentCounts: new Map(),
      preferenceHints,
    };

    // Score all fragments for global relevance
    const scored: RankedFragment[] = fragments.map(fragment => {
      const features = featuresMap.get(fragment.id)!;
      const relevanceScore = calculateRelevanceScore(features, processAim, centralQuestion);
      const noveltyBonus = calculateNoveltyBonus(features, preferenceHints);
      const preferenceAdjustment = calculatePreferenceAdjustment(features, preferenceHints);

      return {
        fragment,
        features,
        relevanceScore,
        diversityPenalty: 0,  // Will be calculated during selection
        noveltyBonus,
        score: relevanceScore + noveltyBonus + preferenceAdjustment,
      };
    });

    // Sort by initial score
    scored.sort((a, b) => b.score - a.score);

    // Select global context (top N by pure relevance)
    const globalCount = Math.ceil(this.budget.totalTarget / 4);
    const global = this.selectDiverse(scored, globalCount, context);

    // Select per-mode fragments
    const perMode = new Map<DesignMode, RankedFragment[]>();
    const modes: DesignMode[] = ["FORM", "MOTION", "EXPRESSION", "FUNCTION"];

    for (const mode of modes) {
      // Re-score with mode-specific relevance
      const modeScored = scored.map(r => ({
        ...r,
        relevanceScore: calculateRelevanceScore(
          r.features,
          processAim,
          centralQuestion,
          mode
        ),
      }));

      // Recalculate total score
      modeScored.forEach(r => {
        r.diversityPenalty = calculateDiversityPenalty(r.features, context);
        r.score = r.relevanceScore + r.noveltyBonus - r.diversityPenalty;
      });

      // Sort by mode-specific score
      modeScored.sort((a, b) => b.score - a.score);

      // Select for this mode
      const modeFragments = this.selectForMode(modeScored, mode, context);
      perMode.set(mode, modeFragments);
    }

    return { global, perMode };
  }

  /**
   * Select diverse fragments, updating context as we go
   */
  private selectDiverse(
    candidates: RankedFragment[],
    count: number,
    context: SelectionContext
  ): RankedFragment[] {
    const selected: RankedFragment[] = [];

    for (const candidate of candidates) {
      if (selected.length >= count) break;

      // Recalculate diversity penalty with current context
      const penalty = calculateDiversityPenalty(candidate.features, context);
      if (penalty > 0.5) continue;  // Skip highly redundant

      // Check tag quota
      const tags = candidate.features.textFeatures?.themes || [];
      const tagOverQuota = tags.some(tag => {
        const count = Array.from(context.selectedTags).filter(t => t === tag.toLowerCase()).length;
        return count >= this.budget.maxPerTag;
      });
      if (tagOverQuota) continue;

      // Add to selection
      selected.push({
        ...candidate,
        diversityPenalty: penalty,
        score: candidate.relevanceScore + candidate.noveltyBonus - penalty,
      });

      // Update context
      context.selectedFragmentIds.add(candidate.fragment.id);
      for (const tag of tags) {
        context.selectedTags.add(tag.toLowerCase());
      }
      const themes = candidate.features.textFeatures?.themes || [];
      for (const theme of themes) {
        context.selectedThemes.add(theme.toLowerCase());
      }
    }

    return selected;
  }

  /**
   * Select fragments for a specific mode with type balancing
   */
  private selectForMode(
    candidates: RankedFragment[],
    mode: DesignMode,
    context: SelectionContext
  ): RankedFragment[] {
    const selected: RankedFragment[] = [];
    let textCount = 0;
    let imageCount = 0;

    for (const candidate of candidates) {
      if (selected.length >= this.budget.perQuadrant) break;

      const isImage = candidate.fragment.type === "IMAGE";
      const isText = !isImage;

      // Check type quotas
      if (isText && textCount >= this.budget.maxTextPerQuadrant) continue;
      if (isImage && imageCount >= this.budget.maxImagePerQuadrant) continue;

      // Recalculate diversity penalty
      const penalty = calculateDiversityPenalty(candidate.features, context);
      if (penalty > 0.6) continue;

      // Check tag quota
      const tags = candidate.features.textFeatures?.themes || [];
      const tagOverQuota = tags.some(tag => {
        const currentCount = Array.from(context.selectedTags)
          .filter(t => t === tag.toLowerCase()).length;
        return currentCount >= this.budget.maxPerTag;
      });
      if (tagOverQuota) continue;

      // Add to selection
      selected.push({
        ...candidate,
        diversityPenalty: penalty,
        score: candidate.relevanceScore + candidate.noveltyBonus - penalty,
      });

      // Update counts
      if (isText) textCount++;
      if (isImage) imageCount++;

      // Update context
      context.selectedFragmentIds.add(candidate.fragment.id);
      for (const tag of tags) {
        context.selectedTags.add(tag.toLowerCase());
      }
    }

    return selected;
  }

  /**
   * Get selection for a specific quadrant
   */
  async selectForQuadrant(
    fragments: Fragment[],
    mode: DesignMode,
    processAim: string,
    centralQuestion: string,
    existingContext: SelectionContext
  ): Promise<QuadrantSelection> {
    const store = getFeatureStore();
    const preferenceHints = existingContext.preferenceHints;

    // Get features
    const scored: RankedFragment[] = [];
    for (const fragment of fragments) {
      const features = await store.getFeatures(fragment);
      const relevanceScore = calculateRelevanceScore(features, processAim, centralQuestion, mode);
      const noveltyBonus = calculateNoveltyBonus(features, preferenceHints);
      const diversityPenalty = calculateDiversityPenalty(features, existingContext);
      const preferenceAdjustment = calculatePreferenceAdjustment(features, preferenceHints);

      scored.push({
        fragment,
        features,
        relevanceScore,
        noveltyBonus,
        diversityPenalty,
        score: relevanceScore + noveltyBonus - diversityPenalty + preferenceAdjustment,
      });
    }

    // Sort and select
    scored.sort((a, b) => b.score - a.score);
    const selected = this.selectForMode(scored, mode, existingContext);

    // Top global context
    const global = scored
      .filter(r => r.diversityPenalty < 0.3)
      .slice(0, Math.ceil(this.budget.perQuadrant / 2));

    return {
      mode,
      fragments: selected,
      globalContext: global,
    };
  }
}

// ========== Utility Functions ==========

/**
 * Convert ranked fragments to FragmentSummary format for agents
 */
export const toFragmentSummaries = (ranked: RankedFragment[]): Array<{
  id: string;
  type: FragmentType;
  title: string;
  summary: string;
  tags?: string[];
  imageUrl?: string;
}> => {
  return ranked.map(r => {
    const imageUrl = r.fragment.type === "IMAGE" ? r.fragment.content : undefined;
    if (r.fragment.type === "IMAGE") {
      console.log(`[FragmentRanker] IMAGE fragment ${r.fragment.id}: content=${r.fragment.content?.slice(0, 50)}, imageUrl=${imageUrl?.slice(0, 50)}`);
    }
    return {
      id: r.fragment.id,
      type: r.fragment.type,
      title: r.fragment.title || "Untitled",
      summary: r.features.uniqueInsight || r.fragment.summary || "",
      tags: r.features.textFeatures?.themes,
      imageUrl,
    };
  });
};

/**
 * Create empty selection context
 */
export const createSelectionContext = (
  processAim: string,
  centralQuestion?: string
): SelectionContext => ({
  processAim,
  centralQuestion,
  selectedTags: new Set(),
  selectedThemes: new Set(),
  selectedFragmentIds: new Set(),
  usedFragmentCounts: new Map(),
});

// ========== Singleton ==========

let globalRanker: FragmentRanker | null = null;

export const getFragmentRanker = (budget?: Partial<SelectionBudget>): FragmentRanker => {
  if (!globalRanker) {
    globalRanker = new FragmentRanker(budget);
  }
  return globalRanker;
};
