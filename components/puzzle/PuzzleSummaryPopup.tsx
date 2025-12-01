/**
 * PuzzleSummaryPopup - Displays puzzle summary after completion
 *
 * Shows:
 * - Direction statement
 * - Key reasons
 * - Open questions (if any)
 * - View in Deck button
 */

import React, { useEffect, useState } from 'react';
import { PuzzleSummary, PuzzleType } from '../../domain/models';
import { CheckCircle, X, ExternalLink } from 'lucide-react';

interface PuzzleSummaryPopupProps {
  summary: PuzzleSummary;
  puzzleType: PuzzleType;
  onClose: () => void;
  onViewInDeck?: () => void;
}

// Puzzle type colors
const PUZZLE_TYPE_COLORS: Record<PuzzleType, { bg: string; border: string; accent: string }> = {
  CLARIFY: { bg: '#EFF6FF', border: '#3B82F6', accent: '#1E40AF' },
  EXPAND: { bg: '#FFF7ED', border: '#F97316', accent: '#9A3412' },
  REFINE: { bg: '#FAF5FF', border: '#9333EA', accent: '#6B21A8' },
};

export const PuzzleSummaryPopup: React.FC<PuzzleSummaryPopupProps> = ({
  summary,
  puzzleType,
  onClose,
  onViewInDeck,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const colors = PUZZLE_TYPE_COLORS[puzzleType];

  // Animate in on mount
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 200);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0)',
        transition: 'background-color 0.2s ease-out',
      }}
      onClick={handleClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden"
        style={{
          transform: isVisible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-5 py-4 flex items-center gap-3"
          style={{ backgroundColor: colors.bg }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: colors.border }}
          >
            <CheckCircle size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold" style={{ color: colors.accent }}>
              Puzzle Complete
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">
              {puzzleType}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-black/5 transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          {summary.title && (
            <h3 className="text-lg font-semibold text-gray-900">
              {summary.title}
            </h3>
          )}

          {/* Direction Statement */}
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              Direction
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {summary.directionStatement}
            </p>
          </div>

          {/* Key Reasons */}
          {summary.reasons && summary.reasons.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Key Reasons
              </div>
              <ul className="space-y-1.5">
                {summary.reasons.slice(0, 5).map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <div
                      className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: colors.border }}
                    />
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Open Questions */}
          {summary.openQuestions && summary.openQuestions.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Open Questions
              </div>
              <ul className="space-y-1">
                {summary.openQuestions.slice(0, 3).map((q, i) => (
                  <li key={i} className="text-sm text-gray-500 italic">
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          {summary.tags && summary.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2">
              {summary.tags.slice(0, 5).map((tag, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 text-xs font-medium rounded-full"
                  style={{
                    backgroundColor: colors.bg,
                    color: colors.accent,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-50 flex items-center justify-end gap-2">
          {onViewInDeck && (
            <button
              onClick={onViewInDeck}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ExternalLink size={14} />
              View in Deck
            </button>
          )}
          <button
            onClick={handleClose}
            className="px-4 py-1.5 text-sm font-medium text-white rounded-lg transition-colors"
            style={{ backgroundColor: colors.border }}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
