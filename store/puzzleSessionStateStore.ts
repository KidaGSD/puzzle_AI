/**
 * Puzzle Session State Store
 *
 * Holds pre-generated pieces from the multi-agent system.
 * QuadrantSpawner pulls pieces from this pool instead of generating on-demand.
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

  // Actions
  setSessionState: (state: PuzzleSessionState) => void;
  setGenerating: (generating: boolean) => void;

  // Anchor management
  updateAnchor: (type: AnchorType, text: string) => void;
  getAnchor: (type: AnchorType) => Anchor | null;
  getAnchors: () => Anchor[];

  // Get next available piece for a quadrant
  getNextPiece: (quadrant: QuadrantType) => PreGeneratedPiece | null;

  // Mark piece as used
  markPieceUsed: (quadrant: QuadrantType, text: string) => void;

  // Reset session
  clearSession: () => void;

  // Get all pieces for a quadrant
  getPiecesForQuadrant: (quadrant: QuadrantType) => PreGeneratedPiece[];
}

const modeToQuadrant = (mode: DesignMode): QuadrantType => {
  return mode.toLowerCase() as QuadrantType;
};

const quadrantToMode = (quadrant: QuadrantType): DesignMode => {
  return quadrant.toUpperCase() as DesignMode;
};

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
    const { preGeneratedPieces } = get();
    const pieces = preGeneratedPieces[quadrant];

    // Find first unused piece
    const availablePiece = pieces.find(p => !p.used);

    if (availablePiece) {
      console.log(`[puzzleSessionStateStore] Found piece for ${quadrant}: "${availablePiece.text}" (priority: ${availablePiece.priority})`);
    } else {
      console.log(`[puzzleSessionStateStore] No more pre-generated pieces for ${quadrant}`);
    }

    return availablePiece || null;
  },

  markPieceUsed: (quadrant, text) => {
    set((state) => {
      const pieces = state.preGeneratedPieces[quadrant];
      const index = pieces.findIndex(p => p.text === text && !p.used);

      if (index >= 0) {
        const updatedPieces = [...pieces];
        updatedPieces[index] = { ...updatedPieces[index], used: true };

        console.log(`[puzzleSessionStateStore] Marked piece as used: "${text}" in ${quadrant}`);

        return {
          preGeneratedPieces: {
            ...state.preGeneratedPieces,
            [quadrant]: updatedPieces,
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
    });
  },

  getPiecesForQuadrant: (quadrant) => {
    return get().preGeneratedPieces[quadrant];
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
