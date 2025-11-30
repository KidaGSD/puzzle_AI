import React, { useState } from 'react'
import { MascotProposal } from '../../ai/agents/mascotAgent'
import { eventBus } from '../../store/runtime'

interface MascotPanelProps {
  isOpen: boolean
  onClose: () => void
  proposal: MascotProposal | null
  onStartPuzzle: (proposal: MascotProposal) => void
}

type MascotMode = 'suggest' | 'question'

/**
 * Main mascot interaction panel that slides in from the right.
 * Provides two modes:
 * 1. "Suggest a puzzle" - AI analyzes fragments and suggests a puzzle
 * 2. "I have a question" - User inputs a question to create a puzzle
 */
export function MascotPanel({ isOpen, onClose, proposal, onStartPuzzle }: MascotPanelProps) {
  const [mode, setMode] = useState<MascotMode>('suggest')
  const [userQuestion, setUserQuestion] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  if (!isOpen) return null

  const handleGenerate = async () => {
    setIsGenerating(true)

    if (mode === 'suggest') {
      // Emit event for AI to suggest a puzzle
      eventBus.emitType('MASCOT_CLICKED', {
        action: 'suggest_puzzle'
      })
    } else {
      // Emit event for AI to process user's question
      if (userQuestion.trim()) {
        eventBus.emitType('MASCOT_CLICKED', {
          action: 'start_from_my_question',
          userQuestion: userQuestion.trim()
        })
        setUserQuestion('')
      }
    }

    // Reset after a short delay (orchestrator will process)
    setTimeout(() => setIsGenerating(false), 500)
  }

  const handleDecline = () => {
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="mascot-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="mascot-panel">
        {/* Header */}
        <div className="mascot-panel-header">
          <h2 className="text-xl font-bold">✨ AI Assistant</h2>
          <button
            onClick={onClose}
            className="mascot-close-btn"
            aria-label="Close panel"
          >
            ✕
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mascot-tabs">
          <button
            className={`mascot-tab ${mode === 'suggest' ? 'active' : ''}`}
            onClick={() => setMode('suggest')}
          >
            Suggest a puzzle
          </button>
          <button
            className={`mascot-tab ${mode === 'question' ? 'active' : ''}`}
            onClick={() => setMode('question')}
          >
            I have a question
          </button>
        </div>

        {/* Content */}
        <div className="mascot-content">
          {mode === 'suggest' ? (
            <div className="mascot-mode-content">
              <p className="text-gray-600 mb-4">
                I'll analyze your fragments and suggest a puzzle to help you move forward.
              </p>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="mascot-generate-btn"
              >
                {isGenerating ? 'Analyzing...' : 'Generate Suggestion'}
              </button>
            </div>
          ) : (
            <div className="mascot-mode-content">
              <p className="text-gray-600 mb-4">
                Describe what you're stuck on or what you'd like to explore.
              </p>
              <textarea
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                placeholder="Example: How do I map features to different audiences?"
                className="mascot-textarea"
                rows={4}
              />
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !userQuestion.trim()}
                className="mascot-generate-btn"
              >
                {isGenerating ? 'Creating...' : 'Create Puzzle'}
              </button>
            </div>
          )}

          {/* Proposal Display */}
          {proposal && (
            <div className="mascot-proposal">
              <div className="mascot-proposal-header">
                <h3 className="text-lg font-bold">Puzzle Proposal</h3>
              </div>

              <div className="mascot-proposal-body">
                {/* Central Question */}
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-1">Central Question</div>
                  <div className="text-xl font-bold">{proposal.centralQuestion}</div>
                </div>

                {/* Primary Modes */}
                <div className="mb-4">
                  <div className="text-sm text-gray-500 mb-2">Focus Areas</div>
                  <div className="flex flex-wrap gap-2">
                    {proposal.primaryModes.map((mode) => (
                      <span
                        key={mode}
                        className="mascot-mode-badge"
                        data-mode={mode.toLowerCase()}
                      >
                        {mode}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Rationale */}
                <div className="mb-6">
                  <div className="text-sm text-gray-500 mb-1">Why this puzzle?</div>
                  <div className="text-gray-700">{proposal.rationale}</div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => onStartPuzzle(proposal)}
                    className="mascot-accept-btn"
                  >
                    Start This Puzzle
                  </button>
                  <button
                    onClick={handleDecline}
                    className="mascot-decline-btn"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .mascot-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 1001;
          animation: fadeIn 0.2s ease;
        }

        .mascot-panel {
          position: fixed;
          right: 0;
          top: 0;
          bottom: 0;
          width: 400px;
          max-width: 100vw;
          background: white;
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
          z-index: 1002;
          display: flex;
          flex-direction: column;
          animation: slideInRight 0.3s ease;
        }

        .mascot-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .mascot-close-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: #f3f4f6;
          color: #6b7280;
          font-size: 20px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .mascot-close-btn:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .mascot-tabs {
          display: flex;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .mascot-tab {
          flex: 1;
          padding: 12px 16px;
          border: none;
          background: transparent;
          color: #6b7280;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .mascot-tab.active {
          color: #a855f7;
          background: white;
        }

        .mascot-tab.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          right: 0;
          height: 2px;
          background: #a855f7;
        }

        .mascot-tab:hover:not(.active) {
          background: #f3f4f6;
        }

        .mascot-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        .mascot-mode-content {
          margin-bottom: 24px;
        }

        .mascot-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          font-family: inherit;
          resize: vertical;
          margin-bottom: 12px;
          transition: border-color 0.2s;
        }

        .mascot-textarea:focus {
          outline: none;
          border-color: #a855f7;
        }

        .mascot-generate-btn {
          width: 100%;
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mascot-generate-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
        }

        .mascot-generate-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .mascot-proposal {
          margin-top: 24px;
          padding: 20px;
          background: linear-gradient(135deg, #fef3c7 0%, #fce7f3 100%);
          border-radius: 12px;
        }

        .mascot-proposal-header {
          margin-bottom: 16px;
        }

        .mascot-proposal-body {
          /* Styling already defined above */
        }

        .mascot-mode-badge {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .mascot-mode-badge[data-mode="form"] {
          background: #dbeafe;
          color: #1e40af;
        }

        .mascot-mode-badge[data-mode="motion"] {
          background: #d1fae5;
          color: #065f46;
        }

        .mascot-mode-badge[data-mode="expression"] {
          background: #e9d5ff;
          color: #6b21a8;
        }

        .mascot-mode-badge[data-mode="function"] {
          background: #fed7aa;
          color: #9a3412;
        }

        .mascot-accept-btn {
          flex: 1;
          padding: 10px 16px;
          border: none;
          border-radius: 8px;
          background: #10b981;
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mascot-accept-btn:hover {
          background: #059669;
          transform: translateY(-1px);
        }

        .mascot-decline-btn {
          flex: 0 0 auto;
          padding: 10px 16px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          background: white;
          color: #6b7280;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .mascot-decline-btn:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  )
}
