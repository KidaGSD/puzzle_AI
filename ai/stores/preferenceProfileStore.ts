/**
 * Preference Profile Store
 *
 * Phase 6: Preference Feedback Loop
 * Tracks per-piece outcomes and adapts sampling preferences based on user behavior.
 *
 * Outcomes tracked:
 * - placed: Piece was placed on canvas without editing
 * - edited: Piece was edited before/after placement
 * - discarded: Piece was explicitly discarded
 * - connected: Piece was connected to other pieces
 */

import { DesignMode } from "../../domain/models";

// ========== Types ==========

export type PieceOutcome = "placed" | "edited" | "discarded" | "connected";

export interface PieceOutcomeRecord {
  pieceId: string;
  pieceText: string;
  fragmentId: string;
  quadrant: DesignMode;
  outcome: PieceOutcome;
  themes: string[];
  timestamp: number;
}

export interface OutcomeStats {
  placed: number;
  edited: number;
  discarded: number;
  connected: number;
  total: number;
}

export interface ThemePreference {
  theme: string;
  acceptRate: number;     // (placed + connected) / total
  editRate: number;       // edited / total
  discardRate: number;    // discarded / total
  sampleCount: number;
}

export interface PreferenceProfile {
  // Aggregate stats
  overallStats: OutcomeStats;

  // Per-quadrant stats
  quadrantStats: Record<DesignMode, OutcomeStats>;

  // Theme-level preferences
  themePreferences: Map<string, ThemePreference>;

  // Adaptive weights (derived from stats)
  diversityWeight: number;    // Higher if high discard rate
  noveltyWeight: number;      // Higher if high discard rate
  openEndedWeight: number;    // Higher if high edit rate
  themeReinforceWeight: number; // Higher if high accept rate

  // Session info
  sessionId: string;
  updatedAt: number;
}

// ========== Constants ==========

const DEFAULT_WEIGHTS = {
  diversity: 0.3,
  novelty: 0.2,
  openEnded: 0.2,
  themeReinforce: 0.3,
};

const WEIGHT_ADJUSTMENT = {
  highDiscard: {
    diversityBoost: 0.15,
    noveltyBoost: 0.1,
  },
  highEdit: {
    openEndedBoost: 0.2,
  },
  highAccept: {
    themeReinforceBoost: 0.15,
  },
};

// Thresholds for behavior adaptation
const DISCARD_THRESHOLD = 0.3;  // >30% discard = boost diversity
const EDIT_THRESHOLD = 0.4;     // >40% edit = boost open-ended
const ACCEPT_THRESHOLD = 0.6;   // >60% accept = reinforce themes

// ========== Helper Functions ==========

const createEmptyStats = (): OutcomeStats => ({
  placed: 0,
  edited: 0,
  discarded: 0,
  connected: 0,
  total: 0,
});

const createEmptyProfile = (sessionId: string): PreferenceProfile => ({
  overallStats: createEmptyStats(),
  quadrantStats: {
    FORM: createEmptyStats(),
    MOTION: createEmptyStats(),
    EXPRESSION: createEmptyStats(),
    FUNCTION: createEmptyStats(),
  },
  themePreferences: new Map(),
  diversityWeight: DEFAULT_WEIGHTS.diversity,
  noveltyWeight: DEFAULT_WEIGHTS.novelty,
  openEndedWeight: DEFAULT_WEIGHTS.openEnded,
  themeReinforceWeight: DEFAULT_WEIGHTS.themeReinforce,
  sessionId,
  updatedAt: Date.now(),
});

const updateStats = (stats: OutcomeStats, outcome: PieceOutcome): OutcomeStats => {
  const updated = { ...stats };
  updated[outcome]++;
  updated.total++;
  return updated;
};

const calculateRates = (stats: OutcomeStats): { acceptRate: number; editRate: number; discardRate: number } => {
  if (stats.total === 0) {
    return { acceptRate: 0, editRate: 0, discardRate: 0 };
  }
  return {
    acceptRate: (stats.placed + stats.connected) / stats.total,
    editRate: stats.edited / stats.total,
    discardRate: stats.discarded / stats.total,
  };
};

// ========== Main Store Class ==========

export class PreferenceProfileStore {
  private profiles: Map<string, PreferenceProfile> = new Map();
  private outcomeHistory: Map<string, PieceOutcomeRecord[]> = new Map();

  /**
   * Get or create preference profile for a session
   */
  getProfile(sessionId: string): PreferenceProfile {
    let profile = this.profiles.get(sessionId);
    if (!profile) {
      profile = createEmptyProfile(sessionId);
      this.profiles.set(sessionId, profile);
    }
    return profile;
  }

  /**
   * Record a piece outcome and update preferences
   */
  recordOutcome(
    sessionId: string,
    pieceId: string,
    pieceText: string,
    fragmentId: string,
    quadrant: DesignMode,
    outcome: PieceOutcome,
    themes: string[] = []
  ): void {
    // Create outcome record
    const record: PieceOutcomeRecord = {
      pieceId,
      pieceText,
      fragmentId,
      quadrant,
      outcome,
      themes,
      timestamp: Date.now(),
    };

    // Add to history
    const history = this.outcomeHistory.get(sessionId) || [];
    history.push(record);
    this.outcomeHistory.set(sessionId, history);

    // Update profile
    const profile = this.getProfile(sessionId);

    // Update overall stats
    profile.overallStats = updateStats(profile.overallStats, outcome);

    // Update quadrant stats
    profile.quadrantStats[quadrant] = updateStats(profile.quadrantStats[quadrant], outcome);

    // Update theme preferences
    for (const theme of themes) {
      const themeLower = theme.toLowerCase();
      const existing = profile.themePreferences.get(themeLower) || {
        theme: themeLower,
        acceptRate: 0,
        editRate: 0,
        discardRate: 0,
        sampleCount: 0,
      };

      existing.sampleCount++;

      // Recalculate rates
      const themeHistory = history.filter(r =>
        r.themes.some(t => t.toLowerCase() === themeLower)
      );
      const themeStats = themeHistory.reduce((acc, r) => {
        acc[r.outcome]++;
        acc.total++;
        return acc;
      }, createEmptyStats());

      const rates = calculateRates(themeStats);
      existing.acceptRate = rates.acceptRate;
      existing.editRate = rates.editRate;
      existing.discardRate = rates.discardRate;

      profile.themePreferences.set(themeLower, existing);
    }

    // Recalculate adaptive weights
    this.recalculateWeights(profile);

    profile.updatedAt = Date.now();
    this.profiles.set(sessionId, profile);

    console.log(`[PreferenceProfile] Recorded ${outcome} for piece in ${quadrant}`);
    console.log(`[PreferenceProfile] Overall: ${profile.overallStats.total} outcomes, weights: diversity=${profile.diversityWeight.toFixed(2)}, novelty=${profile.noveltyWeight.toFixed(2)}`);
  }

  /**
   * Recalculate adaptive weights based on outcome patterns
   */
  private recalculateWeights(profile: PreferenceProfile): void {
    const rates = calculateRates(profile.overallStats);

    // Start with defaults
    let diversity = DEFAULT_WEIGHTS.diversity;
    let novelty = DEFAULT_WEIGHTS.novelty;
    let openEnded = DEFAULT_WEIGHTS.openEnded;
    let themeReinforce = DEFAULT_WEIGHTS.themeReinforce;

    // High discard rate → boost diversity and novelty
    if (rates.discardRate > DISCARD_THRESHOLD) {
      diversity += WEIGHT_ADJUSTMENT.highDiscard.diversityBoost;
      novelty += WEIGHT_ADJUSTMENT.highDiscard.noveltyBoost;
      console.log(`[PreferenceProfile] High discard rate (${(rates.discardRate * 100).toFixed(0)}%), boosting diversity/novelty`);
    }

    // High edit rate → boost open-ended phrasing
    if (rates.editRate > EDIT_THRESHOLD) {
      openEnded += WEIGHT_ADJUSTMENT.highEdit.openEndedBoost;
      console.log(`[PreferenceProfile] High edit rate (${(rates.editRate * 100).toFixed(0)}%), boosting open-ended`);
    }

    // High accept rate → reinforce similar themes
    if (rates.acceptRate > ACCEPT_THRESHOLD) {
      themeReinforce += WEIGHT_ADJUSTMENT.highAccept.themeReinforceBoost;
      console.log(`[PreferenceProfile] High accept rate (${(rates.acceptRate * 100).toFixed(0)}%), reinforcing themes`);
    }

    // Normalize weights to sum to 1.0
    const sum = diversity + novelty + openEnded + themeReinforce;
    profile.diversityWeight = diversity / sum;
    profile.noveltyWeight = novelty / sum;
    profile.openEndedWeight = openEnded / sum;
    profile.themeReinforceWeight = themeReinforce / sum;
  }

  /**
   * Get preference hints for the ranking layer
   */
  getPreferenceHints(sessionId: string): {
    diversityBoost: number;
    noveltyBoost: number;
    preferredThemes: string[];
    avoidThemes: string[];
    preferredQuadrants: DesignMode[];
  } {
    const profile = this.getProfile(sessionId);

    // Find themes with high accept rate
    const preferredThemes: string[] = [];
    const avoidThemes: string[] = [];

    for (const [theme, pref] of profile.themePreferences) {
      if (pref.sampleCount >= 2) {  // Need enough data
        if (pref.acceptRate > 0.6) {
          preferredThemes.push(theme);
        }
        if (pref.discardRate > 0.5) {
          avoidThemes.push(theme);
        }
      }
    }

    // Find quadrants with high engagement
    const preferredQuadrants: DesignMode[] = [];
    const modes: DesignMode[] = ["FORM", "MOTION", "EXPRESSION", "FUNCTION"];

    for (const mode of modes) {
      const stats = profile.quadrantStats[mode];
      const rates = calculateRates(stats);
      if (stats.total >= 2 && rates.acceptRate > 0.5) {
        preferredQuadrants.push(mode);
      }
    }

    return {
      diversityBoost: profile.diversityWeight - DEFAULT_WEIGHTS.diversity,
      noveltyBoost: profile.noveltyWeight - DEFAULT_WEIGHTS.novelty,
      preferredThemes,
      avoidThemes,
      preferredQuadrants,
    };
  }

  /**
   * Get outcome history for a session
   */
  getHistory(sessionId: string): PieceOutcomeRecord[] {
    return this.outcomeHistory.get(sessionId) || [];
  }

  /**
   * Get stats summary for debugging
   */
  getStatsSummary(sessionId: string): {
    overall: OutcomeStats;
    rates: { acceptRate: number; editRate: number; discardRate: number };
    weights: { diversity: number; novelty: number; openEnded: number; themeReinforce: number };
    topThemes: Array<{ theme: string; acceptRate: number }>;
  } {
    const profile = this.getProfile(sessionId);
    const rates = calculateRates(profile.overallStats);

    // Get top themes by accept rate
    const topThemes = Array.from(profile.themePreferences.values())
      .filter(t => t.sampleCount >= 2)
      .sort((a, b) => b.acceptRate - a.acceptRate)
      .slice(0, 5)
      .map(t => ({ theme: t.theme, acceptRate: t.acceptRate }));

    return {
      overall: profile.overallStats,
      rates,
      weights: {
        diversity: profile.diversityWeight,
        novelty: profile.noveltyWeight,
        openEnded: profile.openEndedWeight,
        themeReinforce: profile.themeReinforceWeight,
      },
      topThemes,
    };
  }

  /**
   * Clear session data
   */
  clearSession(sessionId: string): void {
    this.profiles.delete(sessionId);
    this.outcomeHistory.delete(sessionId);
    console.log(`[PreferenceProfile] Cleared session ${sessionId}`);
  }
}

// ========== Singleton ==========

let globalStore: PreferenceProfileStore | null = null;

export const getPreferenceStore = (): PreferenceProfileStore => {
  if (!globalStore) {
    globalStore = new PreferenceProfileStore();
  }
  return globalStore;
};

// ========== Integration Types ==========

/**
 * Hints to inject into fragment ranking
 */
export interface RankingPreferenceHints {
  // Additive bonuses/penalties
  diversityBonus: number;     // Add to diversity scoring
  noveltyBonus: number;       // Add to novelty scoring

  // Theme-based adjustments
  preferredThemeBonus: number;  // Bonus for preferred themes
  avoidThemePenalty: number;    // Penalty for avoided themes
  preferredThemes: Set<string>;
  avoidThemes: Set<string>;
}

/**
 * Convert preference hints to ranking format
 */
export const toRankingHints = (sessionId: string): RankingPreferenceHints => {
  const store = getPreferenceStore();
  const hints = store.getPreferenceHints(sessionId);

  return {
    diversityBonus: hints.diversityBoost * 0.5,  // Scale to reasonable range
    noveltyBonus: hints.noveltyBoost * 0.5,
    preferredThemeBonus: 0.15,
    avoidThemePenalty: 0.2,
    preferredThemes: new Set(hints.preferredThemes),
    avoidThemes: new Set(hints.avoidThemes),
  };
};
