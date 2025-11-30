
import React from 'react';
import { CELL_SIZE, CENTER_CARD_HEIGHT, CENTER_CARD_WIDTH, COLORS } from '../constants';

interface CenterCardProps {
  centralQuestion?: string;
  processAim?: string;
}

export const CenterCard: React.FC<CenterCardProps> = ({
  centralQuestion = 'What is the core question?',
  processAim = '',
}) => {
  const width = CENTER_CARD_WIDTH * CELL_SIZE;
  const height = CENTER_CARD_HEIGHT * CELL_SIZE;

  // Render centered.
  // With 2x2 grid units centered on origin (0,0), the box occupies indices -1 and 0.
  // Total Width = 128. Left = -64. Right = 64.
  // CSS: left: 50%, marginLeft: -64.
  
  return (
    <div 
      className="absolute top-1/2 left-1/2 rounded-2xl flex flex-col items-center justify-center p-2 text-center z-0 shadow-2xl"
      style={{
        width: width - 8,
        height: height - 8,
        backgroundColor: COLORS.darkCard,
        marginTop: -height / 2 + 4,
        marginLeft: -width / 2 + 4,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.1), 0 10px 30px -10px rgba(0,0,0,0.5)'
      }}
    >
      {/* Grid Pattern on Card */}
      <div 
        className="absolute inset-0 rounded-2xl opacity-10 pointer-events-none"
        style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: `${CELL_SIZE/2}px ${CELL_SIZE/2}px`, // Smaller grid on card
            backgroundPosition: 'center'
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-2">
         <div className="w-8 h-8 mb-2 rounded-full bg-slate-800 flex items-center justify-center text-white/50 text-xs">
            ?
         </div>
         <div className="text-white font-bold text-[10px] leading-tight max-w-[100px] text-center">
            {centralQuestion.length > 40 ? `${centralQuestion.slice(0, 40)}...` : centralQuestion}
         </div>
         {processAim && (
           <div className="text-white/40 text-[8px] mt-1 text-center max-w-[90px] leading-tight">
             {processAim.slice(0, 30)}...
           </div>
         )}
      </div>
      
      {/* Connector Indicators (Visual hints for attachment) */}
      {/* Top */}
      <div className="absolute -top-1 w-6 h-1.5 bg-slate-600/50 rounded-full" />
      {/* Bottom */}
      <div className="absolute -bottom-1 w-6 h-1.5 bg-slate-600/50 rounded-full" />
      {/* Left */}
      <div className="absolute -left-1 h-6 w-1.5 bg-slate-600/50 rounded-full" />
      {/* Right */}
      <div className="absolute -right-1 h-6 w-1.5 bg-slate-600/50 rounded-full" />
    </div>
  );
};
