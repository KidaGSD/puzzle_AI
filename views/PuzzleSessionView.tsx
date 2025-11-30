/**
 * PuzzleSessionView
 * Wrapper view that integrates puzzle_session components with main app
 * Handles passing puzzle data and exit callback
 */

import React, { useEffect, useState } from 'react';
import { Board } from '../components/puzzle/Board';
import { contextStore } from '../store/runtime';
import { Puzzle as DomainPuzzle } from '../domain/models';

interface PuzzleSessionViewProps {
  puzzleId: string;
  onExit: () => void;
}

export const PuzzleSessionView: React.FC<PuzzleSessionViewProps> = ({
  puzzleId,
  onExit,
}) => {
  const [puzzle, setPuzzle] = useState<DomainPuzzle | null>(null);
  const [processAim, setProcessAim] = useState('');

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
    </div>
  );
};

export default PuzzleSessionView;
