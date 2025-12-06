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

        <div className="p-12 flex flex-col items-center text-center">
          {/* Logo */}
          <div className="mb-8 transform hover:scale-105 transition-transform duration-500">
            <img src="/Frame 1.svg" alt="Puzzle AI" className="w-24 h-24 object-contain drop-shadow-lg" />
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-gray-900 mb-3 tracking-tight">
            Welcome to Puzzle AI
          </h1>
          <p className="text-lg text-gray-500 mb-10 max-w-md leading-relaxed">
            Your thinking partner for creative work. Let's start by defining your focus.
          </p>

          {/* Input Section */}
          <div className="w-full max-w-lg space-y-6">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl opacity-20 group-focus-within:opacity-50 transition duration-300 blur"></div>
              <textarea
                value={aim}
                onChange={(e) => setAim(e.target.value)}
                placeholder="What are you working on? (e.g. Designing a new coffee brand)"
                className="relative w-full p-5 bg-white border-none rounded-xl text-lg placeholder-gray-400 text-gray-800 focus:ring-0 shadow-sm resize-none min-h-[120px]"
                autoFocus
              />
            </div>

            {/* Examples */}
            <div className="space-y-3">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Or try an example</div>
              <div className="grid gap-2">
                {EXAMPLE_AIMS.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(example)}
                    className="text-left px-4 py-3 rounded-lg bg-white/50 hover:bg-white border border-transparent hover:border-purple-100 text-sm text-gray-600 hover:text-purple-700 transition-all duration-200"
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
