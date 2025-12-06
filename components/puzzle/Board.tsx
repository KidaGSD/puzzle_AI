
import React from 'react';
import { GridBackground } from './GridBackground';
import { CenterCard } from './CenterCard';
import { PuzzlePiece } from './PuzzlePiece';
import { useGameStore } from '../../store/puzzleSessionStore';
import { QuadrantSpawner } from './QuadrantSpawner';
import { COLORS } from '../../constants/puzzleGrid';
import { Mascot } from './Mascot';
import { Puzzle } from '../../domain/models';

interface BoardProps {
  puzzle?: Puzzle;
  processAim?: string;
  onEndPuzzle?: () => void;
}

export const Board: React.FC<BoardProps> = ({
  puzzle,
  processAim = '',
  onEndPuzzle,
}) => {
  const pieces = useGameStore((state) => state.pieces);

  return (
    <div className="relative w-full h-screen overflow-hidden text-slate-800 select-none" style={{ backgroundColor: '#F9FAFB' }}>
      <GridBackground />

      {/* Game Layer */}
      <div className="relative w-full h-full">
        {/* Central Card */}
        <CenterCard
          centralQuestion={puzzle?.centralQuestion}
          processAim={processAim}
          puzzleType={puzzle?.type}
        />

        {/* Puzzle Pieces */}
        {pieces.map((piece) => (
          <PuzzlePiece key={piece.id} data={piece} />
        ))}
      </div>

      {/* Spawners Layer (UI Chrome) */}
      <QuadrantSpawner
        quadrant="form"
        label="Form"
        color={COLORS.form}
        className="top-20 left-6"
      />
      <QuadrantSpawner
        quadrant="motion"
        label="Motion"
        color={COLORS.motion}
        className="top-20 right-6"
      />
      <QuadrantSpawner
        quadrant="expression"
        label="Expression"
        color={COLORS.expression}
        className="bottom-36 left-6"
      />
      <QuadrantSpawner
        quadrant="function"
        label="Function"
        color={COLORS.function}
        className="bottom-20 right-6"
      />

      <Mascot />

      {/* Top Bar Chrome */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3">
          <img src="/Frame 1.svg" alt="Puzzle AI" className="h-10 w-auto object-contain drop-shadow-sm" />
        </div>

        <div className="pointer-events-auto flex space-x-2">
          <button
            onClick={onEndPuzzle}
            className="bg-white/90 backdrop-blur-sm text-gray-800 px-4 py-2 rounded-lg font-medium shadow-sm border border-gray-200 hover:bg-black hover:text-white hover:border-black transition-all"
          >
            End this Puzzle
          </button>
        </div>
      </div>
    </div>
  );
};
