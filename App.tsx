/**
 * App.tsx - View Router
 * Manages navigation between Home Canvas and Puzzle Session views
 */

import React, { useState, useEffect, useRef } from 'react';
import { HomeCanvasView } from './views/HomeCanvasView';
import { PuzzleSessionView } from './views/PuzzleSessionView';
import { LoadingTransition } from './components/common/LoadingTransition';
import { PuzzleSummaryPopup } from './components/puzzle/PuzzleSummaryPopup';
import { AIFeedback } from './components/common/AIFeedback';
import { contextStore, eventBus, ensureOrchestrator, getPuzzleSyncInstance } from './store/runtime';
import { PuzzleSummary, PuzzleType } from './domain/models';

// View types
type AppView = 'canvas' | 'puzzle';

interface AppState {
  currentView: AppView;
  activePuzzleId: string | null;
  isTransitioning: boolean;
  transitionMessage: string;
}

// Summary popup state
interface SummaryPopupState {
  isVisible: boolean;
  summary: PuzzleSummary | null;
  puzzleType: PuzzleType;
}

export default function App() {
  // View state
  const [appState, setAppState] = useState<AppState>({
    currentView: 'canvas',
    activePuzzleId: null,
    isTransitioning: false,
    transitionMessage: '',
  });

  // Summary popup state
  const [summaryPopup, setSummaryPopup] = useState<SummaryPopupState>({
    isVisible: false,
    summary: null,
    puzzleType: 'CLARIFY',
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

    // Subscribe to PUZZLE_SESSION_COMPLETED to show summary popup
    const unsubscribe = eventBus.subscribe((event) => {
      if (event.type === 'PUZZLE_SESSION_COMPLETED') {
        const payload = event.payload as { puzzleId: string; summary: PuzzleSummary };
        console.log('[app] PUZZLE_SESSION_COMPLETED received:', payload);

        // Get puzzle type
        const puzzle = contextStore.getState().puzzles.find(p => p.id === payload.puzzleId);
        const puzzleType: PuzzleType = puzzle?.type || 'CLARIFY';

        // Show summary popup
        setSummaryPopup({
          isVisible: true,
          summary: payload.summary,
          puzzleType,
        });
      }
    });

    return () => {
      console.log('[app] cleaning up orchestrator');
      unsubscribe();
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

    console.log('[app] ⚡⚡⚡ handleEnterPuzzle called with puzzleId:', puzzleId);
    console.log('[app] ⚡⚡⚡ puzzle found:', puzzle ? 'YES' : 'NO');
    console.log('[app] ⚡⚡⚡ puzzle type:', puzzle?.type);

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
      // Force sync all pieces to domain before emitting finish event
      const syncInstance = getPuzzleSyncInstance();
      if (syncInstance) {
        syncInstance.syncAllToDomain();
        console.log('[app] Synced all pieces to domain before finish');
      }

      // Emit puzzle finish event to trigger summary generation
      const state = contextStore.getState();
      const puzzle = state.puzzles.find(p => p.id === puzzleId);
      const pieces = state.puzzlePieces.filter(p => p.puzzleId === puzzleId && p.status !== 'DISCARDED');
      const anchors = state.anchors.filter(a => a.puzzleId === puzzleId);

      console.log(`[app] Finishing puzzle with ${pieces.length} pieces`);

      eventBus.emitType('PUZZLE_FINISH_CLICKED', {
        puzzleId,
        centralQuestion: puzzle?.centralQuestion || '',
        anchors: anchors.map(a => ({ type: a.type, text: a.text })),
        pieces: pieces.map(p => ({ mode: p.mode, category: p.category, text: p.text })),
        fragmentIds: pieces.flatMap(p => p.fragmentLinks.map(fl => fl.fragmentId)),
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

  // Close summary popup
  const handleCloseSummaryPopup = () => {
    setSummaryPopup({
      isVisible: false,
      summary: null,
      puzzleType: 'CLARIFY',
    });
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

      {/* Summary Popup */}
      {summaryPopup.isVisible && summaryPopup.summary && (
        <PuzzleSummaryPopup
          summary={summaryPopup.summary}
          puzzleType={summaryPopup.puzzleType}
          onClose={handleCloseSummaryPopup}
        />
      )}

      {/* AI Loading/Error Feedback Toast */}
      <AIFeedback />
    </>
  );
}
