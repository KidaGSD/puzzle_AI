/**
 * PuzzleSessionView
 * Wrapper view that integrates puzzle_session components with main app
 * Handles passing puzzle data and exit callback
 */

import React, { useEffect, useState, useRef } from 'react';
import { Board } from '../components/puzzle/Board';
import { contextStore, ensurePuzzleSync, getPuzzleSyncInstance, ensurePuzzleSessionStateSync, startPuzzleSession, ensureOrchestrator, eventBus, setMascotProposalListener } from '../store/runtime';
import { useGameStore } from '../store/puzzleSessionStore';
import { usePuzzleSessionStateStore } from '../store/puzzleSessionStateStore';
import { Puzzle as DomainPuzzle, PuzzleType } from '../domain/models';
import { MascotButton } from '../components/mascot/MascotButton';
import { MascotPanel } from '../components/mascot/MascotPanel';
import { MascotProposal } from '../ai/agents/mascotAgent';

interface PuzzleSessionViewProps {
  puzzleId: string;
  onExit: () => void;
}

export const PuzzleSessionView: React.FC<PuzzleSessionViewProps> = ({
  puzzleId,
  onExit,
}) => {
  console.log('[PuzzleSessionView] ⚡⚡⚡ RENDER - puzzleId:', puzzleId);

  const [puzzle, setPuzzle] = useState<DomainPuzzle | null>(null);
  const [processAim, setProcessAim] = useState('');
  const setCurrentPuzzleId = useGameStore((state) => state.setCurrentPuzzleId);
  const clearPieces = useGameStore((state) => state.clearPieces);
  const { isGenerating, sessionState, clearSession } = usePuzzleSessionStateStore();

  // Mascot state
  const [isMascotOpen, setIsMascotOpen] = useState(false);
  const [mascotProposal, setMascotProposal] = useState<MascotProposal | null>(null);

  // Track if session has been started for this puzzleId
  const sessionStartedRef = useRef<string | null>(null);

  // Initialize puzzle sync, orchestrator, and trigger pre-generation
  useEffect(() => {
    console.log('[PuzzleSessionView] ⚡⚡⚡ useEffect RUNNING - puzzleId:', puzzleId);
    console.log('[PuzzleSessionView] ⚡⚡⚡ sessionStartedRef.current:', sessionStartedRef.current);

    // Ensure sync adapter is attached
    ensurePuzzleSync();

    // Ensure orchestrator is attached (handles AI events)
    ensureOrchestrator();

    // Ensure session state sync is listening for PUZZLE_SESSION_GENERATED
    ensurePuzzleSessionStateSync();

    // Set the current puzzle ID for the session
    setCurrentPuzzleId(puzzleId);
    console.log(`[PuzzleSessionView] ⚡⚡⚡ Set currentPuzzleId: ${puzzleId}`);

    // Only start session if we haven't already for this puzzleId
    if (sessionStartedRef.current !== puzzleId) {
      // Get puzzle type from store and trigger pre-generation
      const state = contextStore.getState();
      const foundPuzzle = state.puzzles.find(p => p.id === puzzleId);
      const puzzleType: PuzzleType = foundPuzzle?.type || 'CLARIFY';

      console.log(`[PuzzleSessionView] ⚡⚡⚡ Starting puzzle session with type: ${puzzleType}, puzzleId: ${puzzleId}`);
      console.log(`[PuzzleSessionView] ⚡⚡⚡ Found puzzle: ${foundPuzzle ? foundPuzzle.centralQuestion : 'NOT FOUND'}`);

      sessionStartedRef.current = puzzleId;
      // Pass existing puzzleId and centralQuestion to prevent duplicate card creation
      startPuzzleSession(puzzleType, puzzleId, foundPuzzle?.centralQuestion);
    } else {
      console.log(`[PuzzleSessionView] ⚡⚡⚡ Session already started for puzzleId: ${puzzleId}, skipping`);
    }

    // Cleanup on unmount
    return () => {
      // Sync any remaining pieces before leaving
      const syncInstance = getPuzzleSyncInstance();
      if (syncInstance) {
        syncInstance.syncAllToDomain();
      }
      // Clear visual pieces, puzzle ID, and session state
      clearPieces();
      setCurrentPuzzleId(null);
      clearSession();
      // Reset the ref so next time we enter this puzzle, we start fresh
      sessionStartedRef.current = null;
      console.log('[PuzzleSessionView] Cleaned up puzzle session');
    };
  }, [puzzleId, setCurrentPuzzleId, clearPieces, clearSession]);

  // Load puzzle data and subscribe to store updates
  useEffect(() => {
    // Initial load
    const loadFromStore = () => {
      const state = contextStore.getState();
      const foundPuzzle = state.puzzles.find(p => p.id === puzzleId);
      setPuzzle(foundPuzzle || null);
      setProcessAim(state.project.processAim);
    };

    loadFromStore();

    // Subscribe to updates so we react to changes during the session
    const unsubscribe = contextStore.subscribe(() => {
      loadFromStore();
    });

    return () => {
      unsubscribe();
    };
  }, [puzzleId]);

  // Handle exit button click
  const handleEndPuzzle = () => {
    // The App.tsx will handle emitting PUZZLE_FINISH_CLICKED
    onExit();
  };

  // Mascot handlers
  const handleMascotOpen = () => {
    setIsMascotOpen(true);
    setMascotProposal(null);
  };

  const handleMascotClose = () => {
    setIsMascotOpen(false);
  };

  // In puzzle session, mascot can help with the current puzzle
  const handleMascotAction = (proposal: MascotProposal) => {
    // For now, just close the panel - could add more actions later
    setIsMascotOpen(false);
    setMascotProposal(null);
  };

  if (!puzzle) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading puzzle...</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen relative">
      {/* Puzzle Board - pass puzzle data */}
      <Board
        puzzle={puzzle}
        processAim={processAim}
        onEndPuzzle={handleEndPuzzle}
      />

      {/* Mascot Button - available in puzzle session for help */}
      <MascotButton onClick={handleMascotOpen} />

      {/* Mascot Panel */}
      <MascotPanel
        isOpen={isMascotOpen}
        onClose={handleMascotClose}
        proposal={mascotProposal}
        onStartPuzzle={handleMascotAction}
        context="puzzle"
      />
    </div>
  );
};

export default PuzzleSessionView;
