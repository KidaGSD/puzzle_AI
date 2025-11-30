
import React from 'react';
import { GridBackground } from './GridBackground';
import { CenterCard } from './CenterCard';
import { PuzzlePiece } from './PuzzlePiece';
import { useGameStore } from '../store';
import { QuadrantSpawner } from './QuadrantSpawner';
import { COLORS } from '../constants';
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
    <div className="relative w-full h-screen overflow-hidden bg-gray-50 text-slate-800 select-none">
      <GridBackground />
      
      {/* Game Layer */}
      <div className="relative w-full h-full">
        {/* Central Anchor */}
        <CenterCard
          centralQuestion={puzzle?.centralQuestion}
          processAim={processAim}
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
        className="top-1/4 left-12" 
      />
      <QuadrantSpawner 
        quadrant="motion" 
        label="Motion" 
        color={COLORS.motion} 
        className="top-1/4 right-12"
      />
      <QuadrantSpawner 
        quadrant="expression" 
        label="Expression" 
        color={COLORS.expression} 
        className="bottom-1/4 left-12"
      />
      <QuadrantSpawner 
        quadrant="function" 
        label="Function" 
        color={COLORS.function} 
        className="bottom-1/4 right-12"
      />

      <Mascot />
      
      {/* Top Bar Chrome */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start pointer-events-none">
          <div className="pointer-events-auto flex items-center space-x-3 bg-white px-4 py-2 rounded-lg border shadow-sm">
             <div className="w-6 h-6 bg-slate-900 rounded-sm grid grid-cols-2 gap-0.5 p-0.5">
                <div className="bg-white rounded-[1px]"></div>
                <div className="bg-white/30 rounded-[1px]"></div>
                <div className="bg-white/30 rounded-[1px]"></div>
                <div className="bg-white rounded-[1px]"></div>
             </div>
             <span className="font-bold text-lg">Puzzle AI</span>
          </div>

          <div className="pointer-events-auto flex space-x-2">
            <button
              onClick={onEndPuzzle}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium shadow-lg hover:bg-gray-800 transition-colors"
            >
                End this Puzzle
            </button>
             <button className="bg-white p-2 rounded-lg shadow border hover:bg-gray-50">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/></svg>
            </button>
            <button className="bg-white p-2 rounded-lg shadow border hover:bg-gray-50">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 12"/></svg>
            </button>
          </div>
      </div>
    </div>
  );
};
