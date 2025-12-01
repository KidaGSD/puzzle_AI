import React, { useState, useEffect, useRef } from 'react'
import { MascotProposal } from '../../ai/agents/mascotAgent'
import { eventBus } from '../../store/runtime'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, MessageCircle, ArrowRight, Shuffle } from 'lucide-react'

interface MascotPanelProps {
  isOpen: boolean
  onClose: () => void
  proposal: MascotProposal | null
  onStartPuzzle: (proposal: MascotProposal) => void
}

type ViewState = 'menu' | 'question' | 'analyzing' | 'proposal'

/**
 * MascotPanel - Redesigned as a Conversational Bubble
 * Floats near the mascot button, offering a premium, chat-like experience.
 */
export function MascotPanel({ isOpen, onClose, proposal, onStartPuzzle }: MascotPanelProps) {
  const [view, setView] = useState<ViewState>('menu')
  const [userQuestion, setUserQuestion] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // Reset view when opened/closed or proposal changes
  useEffect(() => {
    if (isOpen) {
      if (proposal) {
        setView('proposal')
      } else {
        setView('menu')
        setUserQuestion('')
      }
    }
  }, [isOpen, proposal])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        // Don't close if clicking the mascot button (handled by parent)
        const target = event.target as HTMLElement;
        if (!target.closest('.mascot-button')) {
          onClose();
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleSuggestClick = () => {
    setView('analyzing')
    // Simulate short delay for "thinking" feel
    setTimeout(() => {
      eventBus.emitType('MASCOT_CLICKED', { action: 'suggest_puzzle' })
    }, 800)
  }

  const handleQuestionSubmit = () => {
    if (!userQuestion.trim()) return
    setView('analyzing')

    setTimeout(() => {
      eventBus.emitType('MASCOT_CLICKED', {
        action: 'start_from_my_question',
        userQuestion: userQuestion.trim()
      })
    }, 800)
  }

  const handleShuffleClick = () => {
    // Request a new puzzle suggestion from AI
    setView('analyzing')
    setTimeout(() => {
      eventBus.emitType('MASCOT_CLICKED', { action: 'suggest_puzzle' })
    }, 800)
  }

  if (!isOpen && !proposal) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed left-24 bottom-28 z-[999] w-[380px] max-w-[calc(100vw-32px)]"
        >
          <div className="relative bg-white/80 backdrop-blur-xl border border-white/50 shadow-2xl rounded-2xl overflow-hidden flex flex-col">

            {/* Header / Close */}
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-black/5 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Area */}
            <div className="p-6">

              {/* MENU VIEW */}
              {view === 'menu' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800">Hi there!</h3>
                      <p className="text-sm text-gray-500">How can I help you think today?</p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    <button
                      onClick={handleSuggestClick}
                      className="group flex items-center gap-4 p-4 rounded-xl bg-white border border-purple-100 shadow-sm hover:shadow-md hover:border-purple-200 hover:bg-purple-50/50 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform">
                        <Sparkles size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">Suggest a Puzzle</div>
                        <div className="text-xs text-gray-500">I'll look at your fragments</div>
                      </div>
                      <ArrowRight size={16} className="ml-auto text-purple-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                    </button>

                    <button
                      onClick={() => setView('question')}
                      className="group flex items-center gap-4 p-4 rounded-xl bg-white border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-200 hover:bg-blue-50/50 transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform">
                        <MessageCircle size={18} />
                      </div>
                      <div>
                        <div className="font-semibold text-gray-800">I have a question</div>
                        <div className="text-xs text-gray-500">Start from a specific topic</div>
                      </div>
                      <ArrowRight size={16} className="ml-auto text-blue-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </button>
                  </div>
                </div>
              )}

              {/* QUESTION VIEW */}
              {view === 'question' && (
                <div className="flex flex-col h-full">
                  <button
                    onClick={() => setView('menu')}
                    className="self-start text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
                  >
                    ← Back
                  </button>

                  <h3 className="font-bold text-gray-800 mb-2">What's on your mind?</h3>
                  <textarea
                    autoFocus
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                    placeholder="e.g. How do I make this feel more nostalgic?"
                    className="w-full p-3 rounded-xl bg-gray-50 border-none focus:ring-2 focus:ring-purple-500/20 resize-none text-sm mb-4 min-h-[100px]"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleQuestionSubmit();
                      }
                    }}
                  />

                  <button
                    onClick={handleQuestionSubmit}
                    disabled={!userQuestion.trim()}
                    className="w-full py-3 rounded-xl bg-black text-white font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    Create Puzzle <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {/* ANALYZING VIEW */}
              {view === 'analyzing' && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="relative w-16 h-16 mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-purple-100"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles size={20} className="text-purple-500 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-800 mb-1">Thinking...</h3>
                  <p className="text-sm text-gray-500">Analyzing your context</p>
                </div>
              )}

              {/* PROPOSAL VIEW */}
              {view === 'proposal' && proposal && (
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <Sparkles size={16} />
                    </div>
                    <span className="text-sm font-bold text-green-700 uppercase tracking-wide">Puzzle Ready</span>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 leading-tight mb-3">
                    {proposal.centralQuestion}
                  </h3>

                  <p className="text-sm text-gray-600 mb-4 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {proposal.rationale}
                  </p>

                  <div className="flex flex-wrap gap-2 mb-6">
                    {proposal.primaryModes.map(mode => (
                      <span key={mode} className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">
                        {mode}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleShuffleClick}
                      className="py-2.5 px-4 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Shuffle size={16} />
                      Shuffle
                    </button>
                    <button
                      onClick={() => onStartPuzzle(proposal)}
                      className="py-2.5 px-4 rounded-xl bg-black text-white font-medium hover:bg-gray-800 transition-colors shadow-lg shadow-purple-500/20"
                    >
                      Create Puzzle
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Bubble Tail - points to mascot on left */}
          <div className="absolute bottom-8 -left-2 w-4 h-4 bg-white/80 backdrop-blur-xl border-l border-b border-white/50 transform rotate-45"></div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
