
import React, { useState, useMemo } from 'react';
import { CELL_SIZE, CENTER_CARD_HEIGHT, CENTER_CARD_WIDTH, COLORS } from '../../constants/puzzleGrid';
import { AnimatePresence, motion } from 'framer-motion';

interface CenterCardProps {
  centralQuestion?: string;
  processAim?: string;
  puzzleType?: 'CLARIFY' | 'EXPAND' | 'REFINE';
}

// Puzzle type colors (for accent only)
const PUZZLE_TYPE_COLORS = {
  CLARIFY: '#3B82F6',
  EXPAND: '#F97316',
  REFINE: '#9333EA',
};

export const CenterCard: React.FC<CenterCardProps> = ({
  centralQuestion = 'What is the core question?',
  processAim = '',
  puzzleType = 'CLARIFY',
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const width = CENTER_CARD_WIDTH * CELL_SIZE;
  const height = CENTER_CARD_HEIGHT * CELL_SIZE;
  const accentColor = PUZZLE_TYPE_COLORS[puzzleType] || PUZZLE_TYPE_COLORS.CLARIFY;

  // Dynamic font size based on question length - optimized for 4x4 card (256x256px)
  // Prioritize showing full text over large font size
  const fontSize = useMemo(() => {
    const charCount = centralQuestion.length;

    // Scale down more aggressively for longer text to show everything
    if (charCount <= 40) return '18px';
    if (charCount <= 80) return '15px';
    if (charCount <= 120) return '13px';
    if (charCount <= 180) return '12px';
    if (charCount <= 250) return '11px';
    return '10px'; // Very long questions
  }, [centralQuestion]);

  const handleClick = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      {/* Main Card - Clean design without badge */}
      <div
        className="absolute rounded-xl flex flex-col items-center justify-center px-4 py-2 shadow-2xl transition-all duration-300 cursor-pointer group"
        style={{
          width: width,
          height: height,
          backgroundColor: COLORS.darkCard,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: isHovered ? 10000 : 10,
          // Accent border on left side to indicate puzzle type
          borderLeft: `3px solid ${accentColor}`,
          boxShadow: isHovered
            ? '0 0 0 2px rgba(255,255,255,0.2), 0 20px 40px -10px rgba(0,0,0,0.6)'
            : '0 0 0 1px rgba(255,255,255,0.1), 0 10px 30px -10px rgba(0,0,0,0.5)'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        {/* Central Question - show full text, scroll if needed */}
        <div
          className="text-white font-semibold text-center leading-snug w-full flex items-center justify-center px-2 overflow-y-auto"
          style={{
            fontSize: fontSize,
            lineHeight: '1.4',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
            maxHeight: `calc(${height}px - 24px)`,  // Leave padding space
          }}
        >
          {centralQuestion}
        </div>

        {/* Expand hint on hover - subtle */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-50 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </div>

        {/* Puzzle type indicator - small dot in top right */}
        <div
          className="absolute top-3 right-3 w-2 h-2 rounded-full"
          style={{ backgroundColor: accentColor }}
          title={puzzleType}
        />
      </div>

      {/* Expanded Modal - for viewing full question */}
      <AnimatePresence>
        {isModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10001]"
              onClick={handleCloseModal}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10002] w-[90%] max-w-[480px]"
            >
              <div
                className="rounded-2xl shadow-2xl overflow-hidden"
                style={{
                  backgroundColor: COLORS.darkCard,
                  borderLeft: `4px solid ${accentColor}`,
                }}
              >
                {/* Modal Header - minimal */}
                <div className="px-6 pt-5 pb-2 flex items-center justify-between">
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: accentColor }}
                  >
                    {puzzleType}
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Modal Body */}
                <div className="px-6 py-4">
                  {/* Central Question - Large Display */}
                  <h2 className="text-white text-xl font-semibold leading-relaxed">
                    {centralQuestion}
                  </h2>

                  {/* Process Aim */}
                  {processAim && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-2">
                        Process Aim
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        {processAim}
                      </p>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-3 border-t border-white/10 flex justify-end">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
