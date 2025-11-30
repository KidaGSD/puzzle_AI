import React, { useState } from 'react'
import { contextStore } from '../../store/runtime'

interface WelcomeOverlayProps {
  onComplete: () => void
}

const EXAMPLE_AIMS = [
  "Explore the tension between analog warmth and digital coldness",
  "Design a meditation app for busy professionals",
  "Create a visual identity for a sustainable fashion brand",
]

/**
 * Welcome overlay shown to first-time users.
 * Guides them through entering their Process Aim.
 */
export function WelcomeOverlay({ onComplete }: WelcomeOverlayProps) {
  const [aim, setAim] = useState('')

  const handleExampleClick = (example: string) => {
    setAim(example)
  }

  const handleGetStarted = () => {
    const trimmedAim = aim.trim()
    if (trimmedAim) {
      // Update process aim in store
      contextStore.updateProcessAim(trimmedAim)

      // Mark onboarding as complete
      contextStore.setState((draft) => {
        draft.agentState.mascot.hasShownOnboarding = true
      })

      // Notify parent
      onComplete()
    }
  }

  return (
    <div className="welcome-overlay">
      {/* Backdrop */}
      <div className="welcome-backdrop" />

      {/* Content Card */}
      <div className="welcome-card">
        {/* Header */}
        <div className="welcome-header">
          <div className="welcome-icon">✨</div>
          <h1 className="welcome-title">Welcome to Puzzle AI</h1>
          <p className="welcome-subtitle">Your thinking partner for creative work</p>
        </div>

        {/* Process Aim Section */}
        <div className="welcome-content">
          <h2 className="welcome-section-title">What are you working on?</h2>
          <p className="welcome-description">
            Describe your creative challenge or what you'd like to explore.
            This will guide all AI suggestions throughout your project.
          </p>

          {/* Input */}
          <textarea
            value={aim}
            onChange={(e) => setAim(e.target.value)}
            placeholder="Example: Explore the tension between analog warmth and digital coldness"
            className="welcome-input"
            rows={3}
            autoFocus
          />

          {/* Examples */}
          <div className="welcome-examples">
            <div className="welcome-examples-label">Or try an example:</div>
            <div className="welcome-examples-buttons">
              {EXAMPLE_AIMS.map((example, idx) => (
                <button
                  key={idx}
                  onClick={() => handleExampleClick(example)}
                  className="welcome-example-btn"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleGetStarted}
            disabled={!aim.trim()}
            className="welcome-cta"
          >
            Get Started
          </button>
        </div>
      </div>

      <style>{`
        .welcome-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .welcome-backdrop {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%);
          backdrop-filter: blur(8px);
          animation: fadeIn 0.3s ease;
        }

        .welcome-card {
          position: relative;
          width: 100%;
          max-width: 600px;
          background: white;
          border-radius: 20px;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
          overflow: hidden;
          animation: slideUp 0.4s ease;
        }

        .welcome-header {
          padding: 48px 48px 32px;
          text-align: center;
          background: linear-gradient(135deg, #fef3c7 0%, #fce7f3 100%);
        }

        .welcome-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .welcome-title {
          font-size: 32px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 8px 0;
        }

        .welcome-subtitle {
          font-size: 18px;
          color: #6b7280;
          margin: 0;
        }

        .welcome-content {
          padding: 40px 48px 48px;
        }

        .welcome-section-title {
          font-size: 20px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 8px 0;
        }

        .welcome-description {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.6;
          margin: 0 0 24px 0;
        }

        .welcome-input {
          width: 100%;
          padding: 16px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 16px;
          font-family: inherit;
          line-height: 1.5;
          resize: vertical;
          transition: border-color 0.2s;
          margin-bottom: 20px;
        }

        .welcome-input:focus {
          outline: none;
          border-color: #a855f7;
        }

        .welcome-input::placeholder {
          color: #9ca3af;
        }

        .welcome-examples {
          margin-bottom: 32px;
        }

        .welcome-examples-label {
          font-size: 13px;
          color: #6b7280;
          margin-bottom: 12px;
        }

        .welcome-examples-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .welcome-example-btn {
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: white;
          color: #374151;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }

        .welcome-example-btn:hover {
          background: #f9fafb;
          border-color: #a855f7;
          color: #a855f7;
        }

        .welcome-cta {
          width: 100%;
          padding: 16px 32px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #a855f7 0%, #ec4899 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .welcome-cta:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(168, 85, 247, 0.3);
        }

        .welcome-cta:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
