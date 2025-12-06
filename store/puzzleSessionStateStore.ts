/**
 * Puzzle Session State Store
 *
 * Holds pre-generated pieces from the multi-agent system.
 * QuadrantSpawner pulls pieces from this pool instead of generating on-demand.
 *
 * Includes session-level tracking for diversity:
 * - usedTexts: prevents repeat phrases across quadrants
 * - usedFragmentCounts: enforces per-fragment quotas
 * - usedThemes: enforces per-theme quotas
 */

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import {
  PuzzleSessionState,
  QuadrantAgentPiece,
  DesignMode,
  PuzzleType,
  Anchor,
  AnchorType,
} from '../domain/models';
import { QuadrantType, PiecePriority } from '../types';
import { getPreferenceStore, PieceOutcome } from '../ai/stores/preferenceProfileStore';

// ========== Diversity Tracking ==========

export interface DiversityTracking {
  usedTexts: Set<string>;                    // Normalized piece texts used
  usedFragmentCounts: Map<string, number>;   // Per-fragment usage count
  usedThemes: Map<string, number>;           // Per-theme usage count
}

const MAX_FRAGMENT_USES = 2;  // Max pieces per fragment
const MAX_THEME_USES = 3;     // Max pieces per theme keyword

/**
 * Normalize text for comparison
 */
const normalizeForTracking = (text: string): string => {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
};

/**
 * Extract theme keywords from text
 */
const extractThemeKeywords = (text: string): string[] => {
  return normalizeForTracking(text).split(' ').filter(w => w.length > 3);
};

interface PreGeneratedPiece extends QuadrantAgentPiece {
  mode: DesignMode;
  used: boolean; // Track if piece has been placed
}

interface PuzzleSessionStateStore {
  // Session state from multi-agent system
  sessionState: PuzzleSessionState | null;
  isGenerating: boolean;

  // Anchors (STARTING/WHY and SOLUTION/WHAT)
  anchors: {
    starting: Anchor | null;
    solution: Anchor | null;
  };

  // Pre-generated pieces pool per quadrant
  preGeneratedPieces: {
    form: PreGeneratedPiece[];
    motion: PreGeneratedPiece[];
    expression: PreGeneratedPiece[];
    function: PreGeneratedPiece[];
  };

  // Diversity tracking across session
  diversityTracking: DiversityTracking;

  // Actions
  setSessionState: (state: PuzzleSessionState) => void;
  setGenerating: (generating: boolean) => void;

  // Anchor management
  updateAnchor: (type: AnchorType, text: string) => void;
  getAnchor: (type: AnchorType) => Anchor | null;
  getAnchors: () => Anchor[];

  // Get next available piece for a quadrant (with diversity checks)
  getNextPiece: (quadrant: QuadrantType) => PreGeneratedPiece | null;

  // Mark piece as used (updates diversity tracking)
  markPieceUsed: (quadrant: QuadrantType, text: string) => void;

  // Reset session
  clearSession: () => void;

  // Get all pieces for a quadrant
  getPiecesForQuadrant: (quadrant: QuadrantType) => PreGeneratedPiece[];

  // Diversity helpers
  getDiversityTracking: () => DiversityTracking;
  isTextUsed: (text: string) => boolean;
  isFragmentOverQuota: (fragmentId: string) => boolean;
  getFragmentUsageCount: (fragmentId: string) => number;

  // Phase 6: Preference feedback
  recordPieceOutcome: (
    quadrant: QuadrantType,
    pieceId: string,
    text: string,
    fragmentId: string,
    outcome: PieceOutcome,
    themes?: string[]
  ) => void;
}

const modeToQuadrant = (mode: DesignMode): QuadrantType => {
  return mode.toLowerCase() as QuadrantType;
};

const quadrantToMode = (quadrant: QuadrantType): DesignMode => {
  return quadrant.toUpperCase() as DesignMode;
};

const createEmptyDiversityTracking = (): DiversityTracking => ({
  usedTexts: new Set(),
  usedFragmentCounts: new Map(),
  usedThemes: new Map(),
});

export const usePuzzleSessionStateStore = create<PuzzleSessionStateStore>((set, get) => ({
  sessionState: null,
  isGenerating: false,

  anchors: {
    starting: null,
    solution: null,
  },

  preGeneratedPieces: {
    form: [],
    motion: [],
    expression: [],
    function: [],
  },

  diversityTracking: createEmptyDiversityTracking(),

  setSessionState: (state) => {
    // Convert session pieces to pre-generated pieces pool
    const formPieces: PreGeneratedPiece[] = state.form_pieces.map(p => ({
      ...p,
      mode: 'FORM' as DesignMode,
      used: false,
    }));

    const motionPieces: PreGeneratedPiece[] = state.motion_pieces.map(p => ({
      ...p,
      mode: 'MOTION' as DesignMode,
      used: false,
    }));

    const expressionPieces: PreGeneratedPiece[] = state.expression_pieces.map(p => ({
      ...p,
      mode: 'EXPRESSION' as DesignMode,
      used: false,
    }));

    const functionPieces: PreGeneratedPiece[] = state.function_pieces.map(p => ({
      ...p,
      mode: 'FUNCTION' as DesignMode,
      used: false,
    }));

    console.log(`[puzzleSessionStateStore] Session loaded: ${formPieces.length} form, ${motionPieces.length} motion, ${expressionPieces.length} expression, ${functionPieces.length} function pieces`);

    set({
      sessionState: state,
      isGenerating: false,
      preGeneratedPieces: {
        form: formPieces,
        motion: motionPieces,
        expression: expressionPieces,
        function: functionPieces,
      },
    });
  },

  setGenerating: (generating) => set({ isGenerating: generating }),

  // Anchor management
  updateAnchor: (type, text) => {
    const { sessionState, anchors } = get();
    const puzzleId = sessionState?.session_id || '';
    const key = type === 'STARTING' ? 'starting' : 'solution';
    const existingAnchor = anchors[key];

    if (existingAnchor) {
      // Update existing anchor text
      set({
        anchors: {
          ...anchors,
          [key]: { ...existingAnchor, text },
        },
      });
    } else {
      // Create new anchor
      const newAnchor: Anchor = {
        id: uuidv4(),
        puzzleId,
        type,
        text,
      };
      set({
        anchors: {
          ...anchors,
          [key]: newAnchor,
        },
      });
    }
    console.log(`[puzzleSessionStateStore] Updated ${type} anchor: "${text.slice(0, 30)}..."`);
  },

  getAnchor: (type) => {
    const { anchors } = get();
    return type === 'STARTING' ? anchors.starting : anchors.solution;
  },

  getAnchors: () => {
    const { anchors } = get();
    const result: Anchor[] = [];
    if (anchors.starting) result.push(anchors.starting);
    if (anchors.solution) result.push(anchors.solution);
    return result;
  },

  getNextPiece: (quadrant) => {
    const { preGeneratedPieces, diversityTracking } = get();
    const pieces = preGeneratedPieces[quadrant];

    // Find first unused piece that passes diversity checks
    const availablePiece = pieces.find(p => {
      if (p.used) return false;

      // Check if text already used
      const normalizedText = normalizeForTracking(p.text || '');
      if (diversityTracking.usedTexts.has(normalizedText)) {
        console.log(`[puzzleSessionStateStore] Skipping "${p.text}" - text already used`);
        return false;
      }

      // Check if fragment is over quota
      const fragmentId = p.fragment_id;
      if (fragmentId) {
        const fragmentCount = diversityTracking.usedFragmentCounts.get(fragmentId) || 0;
        if (fragmentCount >= MAX_FRAGMENT_USES) {
          console.log(`[puzzleSessionStateStore] Skipping "${p.text}" - fragment over quota (${fragmentCount}/${MAX_FRAGMENT_USES})`);
          return false;
        }
      }

      return true;
    });

    if (availablePiece) {
      console.log(`[puzzleSessionStateStore] Found piece for ${quadrant}: "${availablePiece.text}" (priority: ${availablePiece.priority})`);
    } else {
      console.log(`[puzzleSessionStateStore] No more pre-generated pieces for ${quadrant}`);
    }

    return availablePiece || null;
  },

  markPieceUsed: (quadrant, text) => {
    const { sessionState } = get();

    set((state) => {
      const pieces = state.preGeneratedPieces[quadrant];
      const index = pieces.findIndex(p => p.text === text && !p.used);

      if (index >= 0) {
        const piece = pieces[index];
        const updatedPieces = [...pieces];
        updatedPieces[index] = { ...piece, used: true };

        // Update diversity tracking
        const normalizedText = normalizeForTracking(text);
        const newUsedTexts = new Set(state.diversityTracking.usedTexts);
        newUsedTexts.add(normalizedText);

        const newFragmentCounts = new Map(state.diversityTracking.usedFragmentCounts);
        if (piece.fragment_id) {
          const currentCount = newFragmentCounts.get(piece.fragment_id) || 0;
          newFragmentCounts.set(piece.fragment_id, currentCount + 1);
        }

        const newThemeCounts = new Map(state.diversityTracking.usedThemes);
        const themeKeywords = extractThemeKeywords(text);
        for (const keyword of themeKeywords) {
          const currentCount = newThemeCounts.get(keyword) || 0;
          newThemeCounts.set(keyword, currentCount + 1);
        }

        // Phase 6: Record "placed" outcome for preference learning
        if (sessionState?.session_id && piece.fragment_id) {
          const preferenceStore = getPreferenceStore();
          const mode = quadrantToMode(quadrant);
          const pieceId = `${quadrant}-${piece.fragment_id}-${index}`;
          preferenceStore.recordOutcome(
            sessionState.session_id,
            pieceId,
            text,
            piece.fragment_id,
            mode,
            'placed',
            themeKeywords
          );
        }

        console.log(`[puzzleSessionStateStore] Marked piece as used: "${text}" in ${quadrant}`);
        console.log(`[puzzleSessionStateStore] Diversity: ${newUsedTexts.size} texts, ${newFragmentCounts.size} fragments tracked`);

        return {
          preGeneratedPieces: {
            ...state.preGeneratedPieces,
            [quadrant]: updatedPieces,
          },
          diversityTracking: {
            usedTexts: newUsedTexts,
            usedFragmentCounts: newFragmentCounts,
            usedThemes: newThemeCounts,
          },
        };
      }

      return state;
    });
  },

  clearSession: () => {
    console.log('[puzzleSessionStateStore] Clearing session');
    set({
      sessionState: null,
      isGenerating: false,
      anchors: {
        starting: null,
        solution: null,
      },
      preGeneratedPieces: {
        form: [],
        motion: [],
        expression: [],
        function: [],
      },
      diversityTracking: createEmptyDiversityTracking(),
    });
  },

  getPiecesForQuadrant: (quadrant) => {
    return get().preGeneratedPieces[quadrant];
  },

  // Diversity helpers
  getDiversityTracking: () => {
    return get().diversityTracking;
  },

  isTextUsed: (text) => {
    const normalized = normalizeForTracking(text);
    return get().diversityTracking.usedTexts.has(normalized);
  },

  isFragmentOverQuota: (fragmentId) => {
    const count = get().diversityTracking.usedFragmentCounts.get(fragmentId) || 0;
    return count >= MAX_FRAGMENT_USES;
  },

  getFragmentUsageCount: (fragmentId) => {
    return get().diversityTracking.usedFragmentCounts.get(fragmentId) || 0;
  },

  // Phase 6: Record piece outcome for preference learning
  recordPieceOutcome: (quadrant, pieceId, text, fragmentId, outcome, themes = []) => {
    const { sessionState } = get();
    const sessionId = sessionState?.session_id;

    if (!sessionId) {
      console.log('[puzzleSessionStateStore] Cannot record outcome - no active session');
      return;
    }

    const preferenceStore = getPreferenceStore();
    const mode = quadrantToMode(quadrant);

    preferenceStore.recordOutcome(
      sessionId,
      pieceId,
      text,
      fragmentId,
      mode,
      outcome,
      themes
    );

    console.log(`[puzzleSessionStateStore] Recorded ${outcome} for piece "${text.slice(0, 30)}..." in ${quadrant}`);
  },
}));

// Helper to get priority color class (for CSS styling)
export const getPriorityColorClass = (priority: PiecePriority): string => {
  switch (priority) {
    case 1:
    case 2:
      return 'priority-high'; // High saturation
    case 3:
    case 4:
      return 'priority-medium'; // Medium saturation
    case 5:
    case 6:
    default:
      return 'priority-low'; // Low saturation
  }
};
