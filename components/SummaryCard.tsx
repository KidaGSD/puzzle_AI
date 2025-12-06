import React from 'react';
import { PuzzleSummary } from '../domain/models';

interface SummaryCardProps {
  summary: PuzzleSummary;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ summary }) => {
  return (
    <div className="bg-white/95 border border-gray-200 rounded-xl shadow-md p-3 w-64 text-sm text-gray-800">
      <div className="text-[11px] font-bold uppercase text-gray-500 mb-1">Puzzle Summary</div>
      <div className="font-semibold text-gray-900 mb-2">{summary.directionStatement || 'Direction pending'}</div>
      {summary.reasons?.length ? (
        <ul className="list-disc list-inside text-[12px] text-gray-700 space-y-1">
          {summary.reasons.slice(0, 4).map((r, idx) => (
            <li key={idx}>{r}</li>
          ))}
        </ul>
      ) : (
        <div className="text-[12px] text-gray-500">Reasons not provided.</div>
      )}
      {summary.openQuestions?.length ? (
        <div className="mt-2 text-[12px] text-gray-600">
          <div className="font-semibold">Open:</div>
          <ul className="list-disc list-inside space-y-1">
            {summary.openQuestions.slice(0, 3).map((q, idx) => (
              <li key={idx}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
