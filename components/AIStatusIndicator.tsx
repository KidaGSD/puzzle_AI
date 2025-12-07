/**
 * AIStatusIndicator - Shows the current state of AI precomputation
 *
 * Displays whether puzzle pieces are ready for instant generation.
 * Positioned in bottom-right corner of canvas.
 */

import React, { useEffect, useState } from 'react';
import { getAIStatus } from '../store/runtime';

interface AIStatus {
  isReady: boolean;
  contextReady: boolean;
  insightsReady: boolean;
  piecesReady: boolean;
  fragmentCount: number;
  pieceCount: number;
  lastUpdated: number;
}

export const AIStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Poll status every 2 seconds
    const updateStatus = () => {
      const currentStatus = getAIStatus();
      setStatus(currentStatus as AIStatus);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  // Only show if we have fragments
  if (status.fragmentCount === 0) return null;

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      {/* Main indicator */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg cursor-pointer
          transition-all duration-300 backdrop-blur-sm
          ${status.piecesReady
            ? 'bg-green-500/20 border border-green-500/40'
            : status.insightsReady
              ? 'bg-yellow-500/20 border border-yellow-500/40'
              : 'bg-gray-500/20 border border-gray-500/40'
          }
        `}
      >
        {/* Status dot */}
        <div
          className={`
            w-2 h-2 rounded-full
            ${status.piecesReady
              ? 'bg-green-500 animate-none'
              : status.contextReady
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-gray-400 animate-pulse'
            }
          `}
        />

        {/* Status text */}
        <span className="text-xs font-medium text-gray-700">
          {status.piecesReady
            ? `Ready (${status.pieceCount} pieces)`
            : status.insightsReady
              ? 'Preparing pieces...'
              : status.contextReady
                ? 'Analyzing...'
                : 'Processing...'}
        </span>
      </div>

      {/* Details popup - shows below when at top-right */}
      {showDetails && (
        <div className="absolute top-full right-0 mt-2 p-3 bg-white rounded-lg shadow-xl border border-gray-200 min-w-[200px]">
          <div className="text-xs font-semibold text-gray-800 mb-2">AI Preparation Status</div>

          <div className="space-y-1.5">
            <StatusRow
              label="Context"
              ready={status.contextReady}
              detail={`${status.fragmentCount} fragments`}
            />
            <StatusRow
              label="Insights"
              ready={status.insightsReady}
              detail={status.insightsReady ? 'Questions ready' : 'Computing...'}
            />
            <StatusRow
              label="Pieces"
              ready={status.piecesReady}
              detail={status.pieceCount > 0 ? `${status.pieceCount} pre-generated` : 'Generating...'}
            />
          </div>

          {status.lastUpdated > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
              Updated {Math.round((Date.now() - status.lastUpdated) / 1000)}s ago
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const StatusRow: React.FC<{ label: string; ready: boolean; detail: string }> = ({
  label,
  ready,
  detail
}) => (
  <div className="flex items-center justify-between gap-3">
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${ready ? 'bg-green-500' : 'bg-gray-300'}`} />
      <span className="text-[11px] text-gray-600">{label}</span>
    </div>
    <span className={`text-[10px] ${ready ? 'text-green-600' : 'text-gray-400'}`}>
      {detail}
    </span>
  </div>
);
