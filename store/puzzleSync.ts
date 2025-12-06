/**
 * Puzzle Session Sync Adapter
 *
 * Bridges the visual layer (puzzleSessionStore/Zustand) with the domain layer (contextStore).
 * Emits events to the eventBus for orchestrator to handle.
 */

import { useGameStore, visualToDomainPiece } from './puzzleSessionStore';
import { ContextStore } from './contextStore';
import { EventBus } from './eventBus';
import { Piece } from '../types';
import { UUID, PieceStatus } from '../domain/models';

export interface PuzzleSyncConfig {
  contextStore: ContextStore;
  eventBus: EventBus;
}

let syncInstance: PuzzleSyncAdapter | null = null;

export class PuzzleSyncAdapter {
  private contextStore: ContextStore;
  private eventBus: EventBus;
  private previousPieces: Map<string, Piece> = new Map();
  private unsubscribe: (() => void) | null = null;

  constructor(config: PuzzleSyncConfig) {
    this.contextStore = config.contextStore;
    this.eventBus = config.eventBus;
  }

  /**
   * Start listening to puzzleSessionStore changes
   */
  attach(): () => void {
    // Subscribe to Zustand store changes
    this.unsubscribe = useGameStore.subscribe((state) => {
      this.syncPieces(state.pieces, state.currentPuzzleId);
    });

    console.log('[puzzleSync] Attached to puzzleSessionStore');
    return () => this.detach();
  }

  /**
   * Stop listening to changes
   */
  detach(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.previousPieces.clear();
    console.log('[puzzleSync] Detached from puzzleSessionStore');
  }

  /**
   * Sync visual pieces to domain layer and emit events
   */
  private syncPieces(pieces: Piece[], puzzleId: UUID | null): void {
    if (!puzzleId) {
      // No active puzzle, skip sync
      return;
    }

    const currentPieceMap = new Map(pieces.map((p) => [p.id, p]));

    // Detect added pieces
    for (const piece of pieces) {
      if (!this.previousPieces.has(piece.id)) {
        this.onPieceAdded(piece, puzzleId);
      } else {
        // Check for changes (position, label)
        const prev = this.previousPieces.get(piece.id)!;
        if (prev.label !== piece.label) {
          this.onPieceEdited(piece, puzzleId);
        } else if (prev.position.x !== piece.position.x || prev.position.y !== piece.position.y) {
          this.onPieceMoved(piece, puzzleId);
        }
      }
    }

    // Detect removed pieces
    for (const [id, piece] of this.previousPieces) {
      if (!currentPieceMap.has(id)) {
        this.onPieceRemoved(piece, puzzleId);
      }
    }

    // Update previous state
    this.previousPieces = currentPieceMap;
  }

  /**
   * Handle piece added to board
   */
  private onPieceAdded(piece: Piece, puzzleId: UUID): void {
    const domainPiece = visualToDomainPiece(piece, puzzleId, 'PLACED');

    // Add to contextStore
    this.contextStore.upsertPuzzlePiece(domainPiece);

    // Emit event for orchestrator
    this.eventBus.emit({
      type: 'PIECE_PLACED',
      payload: {
        pieceId: piece.id,
        puzzleId,
        mode: domainPiece.mode,
        category: domainPiece.category,
        text: domainPiece.text,
        source: domainPiece.source,
      },
      timestamp: Date.now(),
    });

    console.log(`[puzzleSync] Piece added: ${piece.id} (${piece.label})`);
  }

  /**
   * Handle piece label edited
   */
  private onPieceEdited(piece: Piece, puzzleId: UUID): void {
    const status: PieceStatus = piece.source === 'ai_edited' ? 'EDITED' : 'PLACED';
    const domainPiece = visualToDomainPiece(piece, puzzleId, status);

    // Update in contextStore
    this.contextStore.upsertPuzzlePiece(domainPiece);

    // Emit event
    this.eventBus.emit({
      type: 'PIECE_EDITED',
      payload: {
        pieceId: piece.id,
        puzzleId,
        newText: piece.label,
        source: domainPiece.source,
      },
      timestamp: Date.now(),
    });

    console.log(`[puzzleSync] Piece edited: ${piece.id} -> "${piece.label}"`);
  }

  /**
   * Handle piece moved (position change)
   * We don't store grid position in domain layer, but could emit event for analytics
   */
  private onPieceMoved(piece: Piece, puzzleId: UUID): void {
    // Position is visual-only, no domain update needed
    // Could emit event for analytics if desired
    console.log(`[puzzleSync] Piece moved: ${piece.id} to (${piece.position.x}, ${piece.position.y})`);
  }

  /**
   * Handle piece removed from board
   */
  private onPieceRemoved(piece: Piece, _puzzleId: UUID): void {
    // Update status in contextStore to DISCARDED
    this.contextStore.setPieceStatus(piece.id, 'DISCARDED');

    // Emit event
    this.eventBus.emit({
      type: 'PIECE_DELETED',
      payload: {
        pieceId: piece.id,
        mode: piece.quadrant.toUpperCase(),
        category: (piece.category || 'clarify').toUpperCase(),
      },
      timestamp: Date.now(),
    });

    console.log(`[puzzleSync] Piece removed: ${piece.id}`);
  }

  /**
   * Force sync all current pieces to domain layer
   * Useful when ending a puzzle session
   */
  syncAllToDomain(): void {
    const { pieces, currentPuzzleId } = useGameStore.getState();
    if (!currentPuzzleId) return;

    for (const piece of pieces) {
      const domainPiece = visualToDomainPiece(piece, currentPuzzleId, 'PLACED');
      this.contextStore.upsertPuzzlePiece(domainPiece);
    }

    console.log(`[puzzleSync] Force synced ${pieces.length} pieces to domain`);
  }

  /**
   * Get all placed piece IDs for the current puzzle
   */
  getPlacedPieceIds(): UUID[] {
    const { pieces } = useGameStore.getState();
    return pieces.map((p) => p.id);
  }
}

/**
 * Create and attach the sync adapter (singleton)
 */
export const createPuzzleSync = (config: PuzzleSyncConfig): PuzzleSyncAdapter => {
  if (syncInstance) {
    syncInstance.detach();
  }
  syncInstance = new PuzzleSyncAdapter(config);
  syncInstance.attach();
  return syncInstance;
};

/**
 * Get the current sync instance
 */
export const getPuzzleSync = (): PuzzleSyncAdapter | null => syncInstance;
