import React, { useState } from 'react'
import { contextStore } from '../../store/runtime'
import { ArrowRight, Sparkles } from 'lucide-react'

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
 * Redesigned for a premium, glassmorphism look.
 */
export function WelcomeOverlay({ onComplete }: WelcomeOverlayProps) {
  const [aim, setAim] = useState('')

  const handleExampleClick = (example: string) => {
    setAim(example)
  }

  const handleGetStarted = () => {
    const trimmedAim = aim.trim()
    if (trimmedAim) {
      contextStore.updateProcessAim(trimmedAim)
      contextStore.setState((draft) => {
        draft.agentState.mascot.hasShownOnboarding = true
      })
      onComplete()
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6">
      {/* Blurred Backdrop */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-xl animate-in fade-in duration-500" />

      {/* Content Card */}
      <div className="relative w-full max-w-2xl bg-white/80 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-3xl overflow-hidden animate-in slide-in-from-bottom-8 duration-700">

        <div className="py-8 px-12 flex flex-col items-center justify-center text-center">
          {/* Logo */}
          <div className="-mb-2 transform hover:scale-105 transition-transform duration-500">
            <img src="/Frame 1.svg" alt="Puzzle AI" className="w-36 h-36 object-contain drop-shadow-lg" />
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">
            Welcome to Puzzle AI
          </h1>
          <p className="text-lg text-gray-500 mb-6 max-w-md leading-relaxed">
            Your thinking partner for creative work.<br />
            Let's start by defining your focus.
          </p>

          {/* Input Section */}
          <div className="w-full max-w-lg space-y-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl opacity-5 group-focus-within:opacity-15 transition duration-300 blur-sm"></div>
              <textarea
                value={aim}
                onChange={(e) => setAim(e.target.value)}
                placeholder="What are you working on? (e.g. Designing a new coffee brand)"
                className="relative w-full p-5 bg-white border-2 border-gray-200 focus:border-purple-600 rounded-xl text-lg placeholder-gray-400 text-gray-800 focus:ring-0 shadow-sm resize-none min-h-[160px] transition-colors"
                autoFocus
              />
            </div>

            {/* Examples */}
            <div className="space-y-2 text-center">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Or try an example</div>
              <div className="grid gap-2">
                {EXAMPLE_AIMS.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="text-center px-4 py-2.5 rounded-lg bg-white/50 hover:bg-white border border-transparent hover:border-purple-100 text-sm text-gray-600 hover:text-purple-700 transition-all duration-200 leading-snug"
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
              className="w-full py-4 rounded-xl bg-black text-white text-lg font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2 group"
            >
              Get Started
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
