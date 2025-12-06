/**
 * LoadingTransition Component
 * Shows "Entering your puzzle..." animation during view transition
 * Based on Figma/ux/loading animation.png
 */

import React from 'react';

interface LoadingTransitionProps {
  message?: string;
}

export const LoadingTransition: React.FC<LoadingTransitionProps> = ({
  message = 'Entering your puzzle...',
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1A1A1A]/90 backdrop-blur-sm">
      {/* Central content */}
      <div className="flex flex-col items-center gap-6">
        {/* Animated puzzle icon */}
        <div className="relative w-16 h-16">
          {/* Four quadrant pieces animating */}
          <div
            className="absolute top-0 left-0 w-7 h-7 rounded-tl-lg"
            style={{
              backgroundColor: '#00DE8C',
              animation: 'pulse-piece 1.5s ease-in-out infinite',
              animationDelay: '0s',
            }}
          />
          <div
            className="absolute top-0 right-0 w-7 h-7 rounded-tr-lg"
            style={{
              backgroundColor: '#3544E0',
              animation: 'pulse-piece 1.5s ease-in-out infinite',
              animationDelay: '0.2s',
            }}
          />
          <div
            className="absolute bottom-0 left-0 w-7 h-7 rounded-bl-lg"
            style={{
              backgroundColor: '#8E34FE',
              animation: 'pulse-piece 1.5s ease-in-out infinite',
              animationDelay: '0.4s',
            }}
          />
          <div
            className="absolute bottom-0 right-0 w-7 h-7 rounded-br-lg"
            style={{
              backgroundColor: '#FB07AA',
              animation: 'pulse-piece 1.5s ease-in-out infinite',
              animationDelay: '0.6s',
            }}
          />
        </div>

        {/* Loading text */}
        <div className="text-white text-lg font-semibold tracking-wide">
          {message}
        </div>

        {/* Loading bar */}
        <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full"
            style={{
              animation: 'loading-bar 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse-piece {
          0%, 100% {
            opacity: 0.4;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes loading-bar {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 60%;
            margin-left: 20%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingTransition;
