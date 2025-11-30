
import { create } from 'zustand';
import { CENTER_CARD_HEIGHT, CENTER_CARD_WIDTH } from './constants';
import { Piece, Position } from './types';

interface GameState {
  pieces: Piece[];
  addPiece: (piece: Piece) => void;
  updatePiecePosition: (id: string, newPos: Position) => void;
  removePiece: (id: string) => void;
  checkCollision: (pieceId: string | null, targetPos: Position, cells: Position[]) => boolean;
  checkConnection: (targetPos: Position, cells: Position[]) => boolean;
  isValidDrop: (targetPos: Position, cells: Position[], ignorePieceId?: string | null) => boolean;
}

// Helper to check if a cell is inside the center card
const isInsideCenterCard = (x: number, y: number) => {
  const halfW = CENTER_CARD_WIDTH / 2;
  const halfH = CENTER_CARD_HEIGHT / 2;
  
  // Grid coordinates are indices. 
  // For width 2 (half 1): columns -1, 0 are occupied.
  // Range is [-halfW, halfW).
  
  return x >= -halfW && x < halfW && y >= -halfH && y < halfH;
};

export const useGameStore = create<GameState>((set, get) => ({
  pieces: [],

  addPiece: (piece) => set((state) => ({ pieces: [...state.pieces, piece] })),

  removePiece: (id) => set((state) => ({ pieces: state.pieces.filter((p) => p.id !== id) })),

  updatePiecePosition: (id, newPos) =>
    set((state) => ({
      pieces: state.pieces.map((p) => (p.id === id ? { ...p, position: newPos } : p)),
    })),

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
    
    // Directions to check: Up, Down, Left, Right
    const directions = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 }
    ];

    for (const cell of cells) {
      const myAbsX = targetPos.x + cell.x;
      const myAbsY = targetPos.y + cell.y;

      for (const dir of directions) {
        const neighborX = myAbsX + dir.x;
        const neighborY = myAbsY + dir.y;

        // 1. Is neighbor the center card?
        if (isInsideCenterCard(neighborX, neighborY)) return true;

        // 2. Is neighbor another piece?
        for (const other of pieces) {
          // If checking self (in case of move), skip self is handled by caller logic usually,
          // but here we check connection to OTHERS.
          // However, we don't pass ID here. For a move, we should pass ID to ignore self.
          // But effectively, 'pieces' in store contains 'self' with OLD position.
          // We need to be careful not to connect to 'self's old position' if we are moving.
          // For now, simpler approach: The loop below checks collision against specific cells.
          // We need to verify if neighbor cell belongs to another piece.
          
           for (const otherCell of other.cells) {
             const otherAbsX = other.position.x + otherCell.x;
             const otherAbsY = other.position.y + otherCell.y;
             if (otherAbsX === neighborX && otherAbsY === neighborY) {
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
    // 1. Must not collide
    if (state.checkCollision(ignorePieceId, targetPos, cells)) return false;

    // 2. Must connect to center or existing piece
    // When checking connection for a piece being moved (ignorePieceId exists), 
    // we must ensure we don't count the piece itself at its old position as a valid connection point.
    // However, `checkConnection` iterates over `state.pieces`.
    // We should filter out `ignorePieceId` inside `checkConnection` ideally, but for now let's patch it:
    
    // Specialized connection check ignoring self
    const isConnected = (() => {
        const directions = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
        for (const cell of cells) {
            const myAbsX = targetPos.x + cell.x;
            const myAbsY = targetPos.y + cell.y;
            for (const dir of directions) {
                const nx = myAbsX + dir.x;
                const ny = myAbsY + dir.y;
                if (isInsideCenterCard(nx, ny)) return true;
                
                for (const other of state.pieces) {
                    if (other.id === ignorePieceId) continue;
                    for (const oc of other.cells) {
                        const ox = other.position.x + oc.x;
                        const oy = other.position.y + oc.y;
                        if (ox === nx && oy === ny) return true;
                    }
                }
            }
        }
        return false;
    })();

    return isConnected;
  }
}));
