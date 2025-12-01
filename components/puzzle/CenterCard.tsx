
import React, { useState } from 'react';
import { CELL_SIZE, CENTER_CARD_HEIGHT, CENTER_CARD_WIDTH, COLORS } from '../../constants/puzzleGrid';

interface CenterCardProps {
  centralQuestion?: string;
  processAim?: string;
  puzzleType?: 'CLARIFY' | 'EXPAND' | 'REFINE';
}

// Puzzle type styling
const PUZZLE_TYPE_STYLES = {
  CLARIFY: { color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.2)', label: 'CLARIFY' },
  EXPAND: { color: '#F97316', bgColor: 'rgba(249, 115, 22, 0.2)', label: 'EXPAND' },
  REFINE: { color: '#9333EA', bgColor: 'rgba(147, 51, 234, 0.2)', label: 'REFINE' },
};

export const CenterCard: React.FC<CenterCardProps> = ({
  centralQuestion = 'What is the core question?',
  processAim = '',
  puzzleType = 'CLARIFY',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const width = CENTER_CARD_WIDTH * CELL_SIZE;
  const height = CENTER_CARD_HEIGHT * CELL_SIZE;

  const typeStyle = PUZZLE_TYPE_STYLES[puzzleType] || PUZZLE_TYPE_STYLES.CLARIFY;

  return (
    <div
      className="absolute rounded-xl flex flex-col items-center justify-center px-4 py-3 z-10 shadow-2xl transition-all duration-300"
      style={{
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
      {/* Puzzle Type Badge */}
      <div
        className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3"
        style={{
          backgroundColor: typeStyle.bgColor,
          color: typeStyle.color,
        }}
      >
        {typeStyle.label}
      </div>

      {/* Central Question - Main Focus */}
      <div className="text-white font-semibold text-base leading-snug text-center drop-shadow-md px-2">
        {centralQuestion}
      </div>

      {/* Subtle bottom accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl opacity-60"
        style={{ backgroundColor: typeStyle.color }}
      />

      {/* Popup tooltip on hover - positioned above the card */}
      {processAim && isHovered && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-white rounded-lg shadow-xl px-4 py-3 min-w-[200px] max-w-[300px] z-50"
          style={{ animation: 'fadeIn 0.2s ease-out' }}
        >
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Process Aim</div>
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
