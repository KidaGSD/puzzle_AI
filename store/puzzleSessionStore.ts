
import { create } from 'zustand';
import { CENTER_CARD_HEIGHT, CENTER_CARD_WIDTH } from '../constants/puzzleGrid';
import { Piece, Position, QuadrantType, PieceCategoryType, PieceSourceType } from '../types';
import {
  PuzzlePiece,
  DesignMode,
  PuzzlePieceCategory,
  PuzzlePieceSource,
  PieceStatus,
  UUID,
} from '../domain/models';

// ====== Mapping Functions ======

/** Map visual QuadrantType to domain DesignMode */
export const quadrantToMode = (quadrant: QuadrantType): DesignMode => {
  return quadrant.toUpperCase() as DesignMode;
};

/** Map domain DesignMode to visual QuadrantType */
export const modeToQuadrant = (mode: DesignMode): QuadrantType => {
  return mode.toLowerCase() as QuadrantType;
};

/** Map visual PieceCategoryType to domain PuzzlePieceCategory */
export const categoryToDomain = (category?: PieceCategoryType): PuzzlePieceCategory => {
  if (!category) return 'CLARIFY'; // default
  return category.toUpperCase() as PuzzlePieceCategory;
};

/** Map domain PuzzlePieceCategory to visual PieceCategoryType */
export const categoryToVisual = (category: PuzzlePieceCategory): PieceCategoryType => {
  return category.toLowerCase() as PieceCategoryType;
};

/** Map visual PieceSourceType to domain PuzzlePieceSource */
export const sourceToDomain = (source?: PieceSourceType): PuzzlePieceSource => {
  if (!source || source === 'user') return 'USER';
  if (source === 'ai') return 'AI';
  return 'AI_SUGGESTED_USER_EDITED';
};

/** Map domain PuzzlePieceSource to visual PieceSourceType */
export const sourceToVisual = (source: PuzzlePieceSource): PieceSourceType => {
  if (source === 'USER') return 'user';
  if (source === 'AI') return 'ai';
  return 'ai_edited';
};

/** Convert a visual Piece to a domain PuzzlePiece */
export const visualToDomainPiece = (
  piece: Piece,
  puzzleId: UUID,
  status: PieceStatus = 'PLACED'
): PuzzlePiece => {
  return {
    id: piece.id,
    puzzleId,
    mode: quadrantToMode(piece.quadrant),
    category: categoryToDomain(piece.category),
    title: piece.title || piece.label || '',
    text: piece.content || piece.label || '',
    userAnnotation: undefined,
    anchorIds: [],
    fragmentLinks: [],
    source: sourceToDomain(piece.source),
    status,
  };
};

/** Convert a domain PuzzlePiece to a visual Piece (requires color lookup) */
export const domainToVisualPiece = (
  domainPiece: PuzzlePiece,
  position: Position,
  cells: Position[],
  color: string
): Piece => {
  return {
    id: domainPiece.id,
    quadrant: modeToQuadrant(domainPiece.mode),
    color,
    position,
    cells,
    text: domainPiece.text,
    title: domainPiece.title || domainPiece.text,
    content: domainPiece.text,
    category: domainPiece.category ? categoryToVisual(domainPiece.category) : undefined,
    source: sourceToVisual(domainPiece.source),
  };
};

// ====== Store Interface ======

interface GameState {
  pieces: Piece[];
  currentPuzzleId: UUID | null;
  // Track number of pieces attached per quadrant for sequential color/shape
  quadrantAttachmentCounts: Record<QuadrantType, number>;

  // Actions
  setCurrentPuzzleId: (puzzleId: UUID | null) => void;
  addPiece: (piece: Piece) => void;
  updatePiecePosition: (id: string, newPos: Position) => void;
  updatePieceLabel: (id: string, label: string) => void;
  updatePieceTitle: (id: string, title: string) => void;
  updatePieceText: (id: string, text: string) => void;
  updatePieceTitleAndContent: (id: string, title: string, content: string) => void;
  removePiece: (id: string) => void;
  clearPieces: () => void;

  // Quadrant attachment tracking
  getQuadrantAttachmentCount: (quadrant: QuadrantType) => number;
  incrementQuadrantAttachment: (quadrant: QuadrantType) => void;

  // Collision detection
  checkCollision: (pieceId: string | null, targetPos: Position, cells: Position[]) => boolean;
  checkConnection: (targetPos: Position, cells: Position[]) => boolean;
  isValidDrop: (targetPos: Position, cells: Position[], ignorePieceId?: string | null) => boolean;

  // Get pieces for sync
  getPiecesForSync: () => { piece: Piece; puzzleId: UUID | null }[];
}

// Helper to check if a cell is inside the center card
// Center card is WIDTH x HEIGHT cells centered at origin (both MUST be even)
// For 4x4: cells -2,-1,0,1 on both axes
const isInsideCenterCard = (x: number, y: number) => {
  const halfW = CENTER_CARD_WIDTH / 2;  // 2
  const halfH = CENTER_CARD_HEIGHT / 2; // 2

  // Card occupies cells from -half to half-1 on each axis
  return x >= -halfW && x <= halfW - 1 && y >= -halfH && y <= halfH - 1;
};

export const useGameStore = create<GameState>((set, get) => ({
  pieces: [],
  currentPuzzleId: null,
  quadrantAttachmentCounts: {
    form: 0,
    motion: 0,
    expression: 0,
    function: 0,
  },

  setCurrentPuzzleId: (puzzleId) => set({ currentPuzzleId: puzzleId }),

  addPiece: (piece) => {
    // Default source to 'user' if not specified
    // Use text as the main content field, with fallback to title/label
    const pieceWithDefaults: Piece = {
      ...piece,
      text: piece.text || piece.title || piece.label || '...',
      title: piece.title || piece.text || piece.label || '...',
      content: piece.content || '',
      source: piece.source || 'user',
    };
    console.log(`[puzzleSessionStore] addPiece: id=${piece.id}, title="${pieceWithDefaults.title}", text="${pieceWithDefaults.text}"`);
    set((state) => ({ pieces: [...state.pieces, pieceWithDefaults] }));
  },

  getQuadrantAttachmentCount: (quadrant) => {
    return get().quadrantAttachmentCounts[quadrant];
  },

  incrementQuadrantAttachment: (quadrant) => {
    set((state) => ({
      quadrantAttachmentCounts: {
        ...state.quadrantAttachmentCounts,
        [quadrant]: state.quadrantAttachmentCounts[quadrant] + 1,
      },
    }));
  },

  removePiece: (id) => set((state) => ({ pieces: state.pieces.filter((p) => p.id !== id) })),

  updatePiecePosition: (id, newPos) =>
    set((state) => ({
      pieces: state.pieces.map((p) => (p.id === id ? { ...p, position: newPos } : p)),
    })),

  updatePieceLabel: (id, label) =>
    set((state) => ({
      pieces: state.pieces.map((p) => {
        if (p.id !== id) return p;
        // Mark AI pieces as edited when user changes label
        const newSource: PieceSourceType = p.source === 'ai' ? 'ai_edited' : p.source || 'user';
        return { ...p, label, title: label, source: newSource };
      }),
    })),

  updatePieceTitle: (id, title) =>
    set((state) => ({
      pieces: state.pieces.map((p) => {
        if (p.id !== id) return p;
        // Mark AI pieces as edited when user changes title
        const newSource: PieceSourceType = p.source === 'ai' ? 'ai_edited' : p.source || 'user';
        return { ...p, title, text: title, source: newSource };
      }),
    })),

  updatePieceText: (id, text) =>
    set((state) => {
      console.log(`[puzzleSessionStore] updatePieceText called: id=${id}, text="${text.substring(0, 50)}..."`);
      const pieceExists = state.pieces.some(p => p.id === id);
      console.log(`[puzzleSessionStore] Piece exists: ${pieceExists}, total pieces: ${state.pieces.length}`);
      if (!pieceExists) {
        console.warn(`[puzzleSessionStore] PIECE NOT FOUND: ${id}`);
      }
      return {
        pieces: state.pieces.map((p) => {
          if (p.id !== id) return p;
          // Keep source as 'ai' - this is called by orchestrator with AI content
          console.log(`[puzzleSessionStore] Updating piece ${id}: old title="${p.title}", new text="${text.substring(0, 50)}..."`);
          return { ...p, text, title: text };
        }),
      };
    }),

  updatePieceTitleAndContent: (id, title, content) =>
    set((state) => ({
      pieces: state.pieces.map((p) => {
        if (p.id !== id) return p;
        // This is typically called by AI, so keep the source as is
        // Also update text field for consistency
        return { ...p, title, text: title, content };
      }),
    })),

  clearPieces: () => set({
    pieces: [],
    quadrantAttachmentCounts: {
      form: 0,
      motion: 0,
      expression: 0,
      function: 0,
    },
  }),

  getPiecesForSync: () => {
    const { pieces, currentPuzzleId } = get();
    return pieces.map((piece) => ({ piece, puzzleId: currentPuzzleId }));
  },

  checkCollision: (pieceId, targetPos, cells) => {
    const { pieces } = get();

    // Check against center card
    for (const cell of cells) {
      const absX = targetPos.x + cell.x;
      const absY = targetPos.y + cell.y;
      if (isInsideCenterCard(absX, absY)) return true;
    }

    // Check against other pieces
    for (const other of pieces) {
      if (other.id === pieceId) continue;

      for (const otherCell of other.cells) {
        const otherAbsX = other.position.x + otherCell.x;
        const otherAbsY = other.position.y + otherCell.y;

        for (const myCell of cells) {
          const myAbsX = targetPos.x + myCell.x;
          const myAbsY = targetPos.y + myCell.y;
          if (myAbsX === otherAbsX && myAbsY === otherAbsY) return true;
        }
      }
    }

    return false;
  },

  checkConnection: (targetPos, cells) => {
    const { pieces } = get();
    const halfW = CENTER_CARD_WIDTH / 2;
    const halfH = CENTER_CARD_HEIGHT / 2;

    // Card bounds (for 4x4: -2 to 1 on both axes)
    const cardMinX = -halfW;
    const cardMaxX = halfW - 1;
    const cardMinY = -halfH;
    const cardMaxY = halfH - 1;

    // Check if cell is adjacent to the center card (touching its edge)
    const isAdjacentToCenterCard = (x: number, y: number) => {
      const adjacentLeft = (x === cardMinX - 1) && (y >= cardMinY && y <= cardMaxY);
      const adjacentRight = (x === cardMaxX + 1) && (y >= cardMinY && y <= cardMaxY);
      const adjacentTop = (y === cardMinY - 1) && (x >= cardMinX && x <= cardMaxX);
      const adjacentBottom = (y === cardMaxY + 1) && (x >= cardMinX && x <= cardMaxX);
      return adjacentLeft || adjacentRight || adjacentTop || adjacentBottom;
    };

    const directions = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

    for (const cell of cells) {
      const absX = targetPos.x + cell.x;
      const absY = targetPos.y + cell.y;

      if (isAdjacentToCenterCard(absX, absY)) return true;

      for (const dir of directions) {
        const nx = absX + dir.x;
        const ny = absY + dir.y;
        for (const other of pieces) {
          for (const oc of other.cells) {
            if (other.position.x + oc.x === nx && other.position.y + oc.y === ny) {
              return true;
            }
          }
        }
      }
    }
    return false;
  },

  isValidDrop: (targetPos, cells, ignorePieceId = null) => {
    const state = get();
    // 1. Must not collide with center card or other pieces
    const hasCollision = state.checkCollision(ignorePieceId, targetPos, cells);
    if (hasCollision) {
      console.log('[isValidDrop] Collision detected, rejecting');
      return false;
    }

    // 2. Must connect to center card edge or existing piece
    const halfW = CENTER_CARD_WIDTH / 2;
    const halfH = CENTER_CARD_HEIGHT / 2;
    const cardMinX = -halfW;
    const cardMaxX = halfW - 1;
    const cardMinY = -halfH;
    const cardMaxY = halfH - 1;

    console.log('[isValidDrop] Center card bounds:', { cardMinX, cardMaxX, cardMinY, cardMaxY });

    const isAdjacentToCenterCard = (x: number, y: number) => {
      const adjacentLeft = (x === cardMinX - 1) && (y >= cardMinY && y <= cardMaxY);
      const adjacentRight = (x === cardMaxX + 1) && (y >= cardMinY && y <= cardMaxY);
      const adjacentTop = (y === cardMinY - 1) && (x >= cardMinX && x <= cardMaxX);
      const adjacentBottom = (y === cardMaxY + 1) && (x >= cardMinX && x <= cardMaxX);
      return adjacentLeft || adjacentRight || adjacentTop || adjacentBottom;
    };

    const directions = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];

    for (const cell of cells) {
      const absX = targetPos.x + cell.x;
      const absY = targetPos.y + cell.y;

      const adjacent = isAdjacentToCenterCard(absX, absY);
      console.log(`[isValidDrop] Cell at (${absX}, ${absY}) adjacent to center: ${adjacent}`);

      if (adjacent) return true;

      for (const dir of directions) {
        const nx = absX + dir.x;
        const ny = absY + dir.y;
        for (const other of state.pieces) {
          if (other.id === ignorePieceId) continue;
          for (const oc of other.cells) {
            if (other.position.x + oc.x === nx && other.position.y + oc.y === ny) {
              console.log(`[isValidDrop] Adjacent to existing piece at (${nx}, ${ny})`);
              return true;
            }
          }
        }
      }
    }
    console.log('[isValidDrop] No valid connection found, rejecting');
    return false;
  }
}));
