
import React from 'react';
import { Puzzle, Lever } from '../types';
import { Gamepad2, ChevronRight, HelpCircle, CheckCircle2, Check } from 'lucide-react';
import { PuzzleSummary } from '../domain/models';
import { eventBus, contextStore } from '../store/runtime';

interface PuzzleDeckProps {
  activeLeverId: string | null;
  puzzles: Puzzle[];
  levers: Lever[];
  puzzleSummaries?: PuzzleSummary[];
  onSelectPuzzle: (puzzle: Puzzle) => void;
}

export const PuzzleDeck: React.FC<PuzzleDeckProps> = ({ activeLeverId, puzzles, levers, puzzleSummaries = [], onSelectPuzzle }) => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  // Filter puzzles based on selection
  const displayPuzzles = activeLeverId
    ? puzzles.filter(p => p.leverId === activeLeverId)
    : puzzles;

  const getLeverColor = (id: string) => {
    return levers.find(l => l.id === id)?.color || '#999';
  };

  return (
    <div className="absolute bottom-0 left-0 w-full z-30 flex justify-center items-end pointer-events-none h-[400px]">

      {/* Cards Container */}
      <div
        className="
            relative flex items-end gap-3 px-10 pb-0 pointer-events-auto
            perspective-1000
        "
      >
        {displayPuzzles.map((puzzle, index) => {
          const leverColor = getLeverColor(puzzle.leverId);
          const isFinished = puzzleSummaries.some(s => s.puzzleId === puzzle.id);

          // Calculate offset based on hover state
          let translateY = 'translateY(120px)'; // Default peek height (shows more top)
          let zIndex = 0;
          let scale = 'scale(1)';

          if (hoveredIndex !== null) {
            const dist = Math.abs(hoveredIndex - index);
            if (dist === 0) {
              translateY = 'translateY(-20px)'; // Fully up
              zIndex = 50;
              scale = 'scale(1.1)';
            } else if (dist === 1) {
              translateY = 'translateY(50px)'; // Half up
              zIndex = 40;
              scale = 'scale(1.05)';
            } else {
              translateY = 'translateY(140px)'; // Others push down slightly or stay
            }
          }

          return (
            <div
              key={puzzle.id}
              onClick={() => onSelectPuzzle(puzzle)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="relative flex-shrink-0 cursor-pointer transition-all duration-700 ease-out group/card" // Slower transition
              style={{
                width: '150px',
                height: '200px',
                transform: `${translateY} ${scale}`,
                zIndex: zIndex,
              }}
            >
              {/*
                 Cartridge Shape Construction
              */}

              {/* Main Body (Leaned Back) */}
              <div
                className="absolute inset-0 rounded-t-lg shadow-xl"
                style={{
                  backgroundColor: '#E5E5E5', // Light grey cartridge plastic
                  transform: 'rotateX(5deg)', // Less lean for taller look
                  boxShadow: '0 10px 20px rgba(0,0,0,0.2), inset 0 2px 5px rgba(255,255,255,0.8)'
                }}
              >
                {/* Side Grips */}
                <div className="absolute top-12 left-0 w-1.5 h-24 bg-gray-300/50 rounded-r"></div>
                <div className="absolute top-12 right-0 w-1.5 h-24 bg-gray-300/50 rounded-l"></div>

                {/* Sticker Label Area */}
                <div className="absolute top-3 left-3 right-3 bottom-4 bg-white rounded-md overflow-hidden border border-gray-300 shadow-inner flex flex-col">
                  {/* Top Color Strip & Lever Name */}
                  <div className="h-auto w-full relative overflow-hidden shrink-0 border-b border-gray-100">
                    <div className="absolute inset-0 opacity-20" style={{ backgroundColor: leverColor }}></div>

                    <div className="relative z-10 p-3 pb-2">
                      <div
                        className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded text-white shadow-sm"
                        style={{ backgroundColor: leverColor }}
                      >
                        {levers.find(l => l.id === puzzle.leverId)?.name.split(' ')[0]}
                      </div>
                    </div>
                  </div>

                  {/* Content - Title on Top part of the body */}
                  <div className="p-3 pt-2 flex-1 flex flex-col">
                    <h3 className="text-xs font-bold text-gray-800 leading-tight font-mono mb-2 line-clamp-4">
                      {puzzle.title}
                    </h3>

                    <div className="flex items-center gap-1 text-[10px] uppercase font-bold tracking-wide mb-2">
                      {isFinished ? (
                        <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12} /> Finished</span>
                      ) : (
                        <span className="text-amber-600">Active</span>
                      )}
                    </div>

                    <div className="mt-auto flex items-center gap-1 opacity-60">
                      {puzzle.type === 'expand' && <ChevronRight size={12} />}
                      {puzzle.type === 'clarify' && <HelpCircle size={12} />}
                      {puzzle.type === 'converge' && <Gamepad2 size={12} />}
                      <span className="text-[9px] uppercase font-bold tracking-wide">{puzzle.type}</span>
                    </div>
                  </div>
                </div>
              </div>
              {!isFinished && (
                <button
                  className="absolute -top-3 -right-3 bg-emerald-600 text-white text-[11px] px-2 py-1 rounded-full shadow hover:bg-emerald-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    const fragments = contextStore.getState().fragments;
                    eventBus.emitType("PUZZLE_FINISH_CLICKED", {
                      puzzleId: puzzle.id,
                      centralQuestion: puzzle.title,
                      anchors: [],
                      pieces: [],
                      fragmentIds: fragments.map(f => f.id)
                    });
                  }}
                >
                  Finish
                </button>
              )}

              {/* Hover Glow */}
              <div
                className="absolute -inset-4 bg-white/0 rounded-xl transition-all duration-500 opacity-0 group-hover/card:opacity-100 blur-xl pointer-events-none"
                style={{ zIndex: -1, backgroundColor: 'rgba(255,255,255,0.3)' }}
              ></div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
