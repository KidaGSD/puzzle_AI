/**
 * AIFeedback Component
 * Shows loading, success, and error states for AI operations
 */

import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader2, RefreshCw, X } from 'lucide-react';
import { eventBus } from '../../store/runtime';
import { AIErrorPayload, AILoadingPayload, UIEvent } from '../../domain/models';

interface FeedbackState {
  type: 'idle' | 'loading' | 'success' | 'error';
  source?: string;
  message?: string;
  recoverable?: boolean;
  retryEventType?: string;
  retryPayload?: unknown;
}

export const AIFeedback: React.FC = () => {
  const [state, setState] = useState<FeedbackState>({ type: 'idle' });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = eventBus.subscribe((event: UIEvent) => {
      if (event.type === 'AI_LOADING') {
        const payload = event.payload as AILoadingPayload;
        setState({
          type: 'loading',
          source: payload.source,
          message: payload.message,
        });
        setVisible(true);
      } else if (event.type === 'AI_SUCCESS') {
        const payload = event.payload as { source: string; message?: string };
        setState({
          type: 'success',
          source: payload.source,
          message: payload.message || 'Operation completed',
        });
        setVisible(true);
        // Auto-dismiss success after 2s
        setTimeout(() => setVisible(false), 2000);
      } else if (event.type === 'AI_ERROR') {
        const payload = event.payload as AIErrorPayload;
        setState({
          type: 'error',
          source: payload.source,
          message: payload.message,
          recoverable: payload.recoverable,
          retryEventType: payload.retryEventType,
          retryPayload: payload.retryPayload,
        });
        setVisible(true);
        // Auto-dismiss recoverable errors after 8s
        if (payload.recoverable) {
          setTimeout(() => setVisible(false), 8000);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleRetry = () => {
    if (state.retryEventType && state.retryPayload !== undefined) {
      eventBus.emitType(state.retryEventType as any, state.retryPayload);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
  };

  if (!visible || state.type === 'idle') return null;

  const sourceLabel = {
    mascot: 'Mascot',
    puzzle_session: 'Puzzle Session',
    quadrant: 'Quadrant Agent',
    synthesis: 'Synthesis',
    fragment: 'Fragment Analysis',
  }[state.source || ''] || 'AI';

  return (
    <div className="fixed bottom-20 right-4 z-[100] max-w-sm animate-in slide-in-from-right-5 duration-200">
      {/* Loading State */}
      {state.type === 'loading' && (
        <div className="bg-gray-800/95 backdrop-blur-sm text-white p-4 rounded-lg shadow-xl border border-gray-700 flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-200">{sourceLabel}</p>
            <p className="text-xs text-gray-400 mt-0.5">{state.message || 'Processing...'}</p>
          </div>
        </div>
      )}

      {/* Success State */}
      {state.type === 'success' && (
        <div className="bg-green-900/95 backdrop-blur-sm text-white p-4 rounded-lg shadow-xl border border-green-700 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-100">{sourceLabel}</p>
            <p className="text-xs text-green-300 mt-0.5">{state.message}</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {state.type === 'error' && (
        <div className="bg-red-900/95 backdrop-blur-sm text-white p-4 rounded-lg shadow-xl border border-red-700">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-100">{sourceLabel} Error</p>
              <p className="text-xs text-red-300 mt-0.5">{state.message}</p>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-red-800 rounded transition-colors"
            >
              <X className="w-4 h-4 text-red-300" />
            </button>
          </div>

          {state.recoverable && state.retryEventType && (
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs text-red-300 hover:text-white transition-colors"
              >
                Dismiss
              </button>
              <button
                onClick={handleRetry}
                className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 text-white rounded flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIFeedback;
