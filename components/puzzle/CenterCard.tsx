
import React, { useState } from 'react';
import { CELL_SIZE, CENTER_CARD_HEIGHT, CENTER_CARD_WIDTH, COLORS } from '../../constants/puzzleGrid';

interface CenterCardProps {
  centralQuestion?: string;
  processAim?: string;
}

export const CenterCard: React.FC<CenterCardProps> = ({
  centralQuestion = 'What is the core question?',
  processAim = '',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const width = CENTER_CARD_WIDTH * CELL_SIZE;
  const height = CENTER_CARD_HEIGHT * CELL_SIZE;

  return (
    <div
      className="absolute rounded-lg flex flex-col items-center justify-center px-4 py-3 text-center z-10 shadow-2xl cursor-pointer"
      style={{
        // Exact grid-aligned dimensions (same as puzzle pieces)
        width: width,
        height: height,
        backgroundColor: COLORS.darkCard,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        boxShadow: isHovered
          ? '0 0 0 2px rgba(255,255,255,0.3), 0 20px 40px -10px rgba(0,0,0,0.6)'
          : '0 0 0 1px rgba(255,255,255,0.1), 0 10px 30px -10px rgba(0,0,0,0.5)'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Content - Question only */}
      <div className="relative z-10 flex flex-col items-center px-2 w-full h-full justify-center">
        <div className="text-white font-semibold text-base md:text-lg leading-snug text-center drop-shadow-md">
          {centralQuestion}
        </div>
      </div>

      {/* Popup tooltip on hover - positioned above the card */}
      {processAim && isHovered && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-white rounded-lg shadow-xl px-4 py-3 min-w-[200px] max-w-[300px] z-50 animate-fade-in"
          style={{
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Context</div>
          <div className="text-sm text-gray-700 leading-relaxed">{processAim}</div>
          {/* Arrow pointing down */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white"></div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
};
