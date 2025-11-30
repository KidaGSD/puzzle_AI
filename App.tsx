/**
 * App.tsx - View Router
 * Manages navigation between Home Canvas and Puzzle Session views
 */

import React, { useState, useEffect, useRef } from 'react';
import { HomeCanvasView } from './views/HomeCanvasView';
import { PuzzleSessionView } from './views/PuzzleSessionView';
import { LoadingTransition } from './components/common/LoadingTransition';
import { contextStore, eventBus, ensureOrchestrator } from './store/runtime';

// View types
type AppView = 'canvas' | 'puzzle';

interface AppState {
  currentView: AppView;
  activePuzzleId: string | null;
  isTransitioning: boolean;
  transitionMessage: string;
}

export default function App() {
  // View state
  const [appState, setAppState] = useState<AppState>({
    currentView: 'canvas',
    activePuzzleId: null,
    isTransitioning: false,
    transitionMessage: '',
  });

  // Ref for orchestrator cleanup
  const detachOrchestratorRef = useRef<null | (() => void)>(null);

  // Attach orchestrator once on mount
  // Note: Mock data is auto-initialized in runtime.ts at module load time
  useEffect(() => {
    console.log('[app] useEffect: attaching orchestrator...');
    const detach = ensureOrchestrator();
    detachOrchestratorRef.current = detach;
    console.log('[app] orchestrator attached');
    console.log('[app] Fragments in store:', contextStore.getState().fragments.length);

    return () => {
      console.log('[app] cleaning up orchestrator');
      // Don't call detach - singleton pattern persists across re-renders
    };
  }, []);

  /**
   * Enter puzzle session
   * Shows loading animation, then switches view
   */
  const handleEnterPuzzle = (puzzleId: string) => {
    // Get puzzle title for loading message
    const state = contextStore.getState();
    const puzzle = state.puzzles.find(p => p.id === puzzleId);
    const puzzleTitle = puzzle?.centralQuestion?.slice(0, 30) || 'your puzzle';

    console.log('[app] entering puzzle:', puzzleId);

    setAppState({
      currentView: 'canvas', // Keep showing canvas during transition
      activePuzzleId: puzzleId,
      isTransitioning: true,
      transitionMessage: `Entering "${puzzleTitle}"...`,
    });

    // Transition delay for animation
    setTimeout(() => {
      setAppState({
        currentView: 'puzzle',
        activePuzzleId: puzzleId,
        isTransitioning: false,
        transitionMessage: '',
      });
    }, 1500);
  };

  /**
   * Exit puzzle session
   * Triggers summary generation, then returns to canvas
   */
  const handleExitPuzzle = () => {
    const puzzleId = appState.activePuzzleId;
    console.log('[app] exiting puzzle:', puzzleId);

    if (puzzleId) {
      // Emit puzzle finish event to trigger summary generation
      const state = contextStore.getState();
      const puzzle = state.puzzles.find(p => p.id === puzzleId);
      const pieces = state.puzzlePieces.filter(p => p.puzzleId === puzzleId);
      const anchors = state.anchors.filter(a => a.puzzleId === puzzleId);

      eventBus.emitType('PUZZLE_FINISH_CLICKED', {
        puzzleId,
        centralQuestion: puzzle?.centralQuestion || '',
        anchors: anchors.map(a => ({ type: a.type, text: a.text })),
        pieces: pieces.map(p => ({ mode: p.mode, text: p.text })),
        fragmentIds: [], // Could link fragments here
      });
    }

    // Show transition back to canvas
    setAppState({
      currentView: 'puzzle', // Keep showing puzzle during transition
      activePuzzleId: puzzleId,
      isTransitioning: true,
      transitionMessage: 'Generating summary...',
    });

    setTimeout(() => {
      setAppState({
        currentView: 'canvas',
        activePuzzleId: null,
        isTransitioning: false,
        transitionMessage: '',
      });
    }, 1200);
  };

  return (
    <>
      {/* Loading Transition Overlay */}
      {appState.isTransitioning && (
        <LoadingTransition message={appState.transitionMessage} />
      )}

      {/* Current View */}
      {appState.currentView === 'canvas' ? (
        <HomeCanvasView onEnterPuzzle={handleEnterPuzzle} />
      ) : (
        <PuzzleSessionView
          puzzleId={appState.activePuzzleId!}
          onExit={handleExitPuzzle}
        />
      )}
    </>
  );
}
