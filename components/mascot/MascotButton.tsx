import React, { useState, useEffect, useCallback, useRef } from 'react'
import { eventBus } from '../../store/runtime'
import { usePuzzleSessionStateStore } from '../../store/puzzleSessionStateStore'

// ========== Onboarding Configuration ==========

const ONBOARDING_MESSAGES = [
  "Welcome! Drag colorful blocks near the central question",  // Step 1
  "Dark = Core ideas | Light = Exploration paths",            // Step 2
  "Keep adding, or click 'End Puzzle' for summary"            // Step 3
];

// ========== Contextual Hints ==========
const CONTEXTUAL_HINTS = {
  REPLENISHING: "Generating more ideas...",
  IDLE: "Try dragging a block?",
  DELETED: "Removed? That's okay, keep exploring",
  COMPLETED: "🎉 Summary generated!",
  DEFAULT: "Stuck? Click me to start a thinking puzzle!",
};

const BUBBLE_AUTO_SHOW_DELAY = 3000;   // Show bubble 3s after component mounts
const BUBBLE_AUTO_HIDE_DELAY = 5000;   // Hide bubble after 5s
const IDLE_TIMEOUT = 30000;            // 30 seconds idle timeout
const ONBOARDING_STORAGE_KEY = 'puzzle_mascot_onboarding_step';

interface MascotButtonProps {
  onClick: () => void
}

/**
 * Floating mascot button positioned on the left side below the toolbar.
 * Acts as the single AI entry point for starting puzzles and getting suggestions.
 *
 * Includes auto-appearing onboarding hints for new users:
 * 1. Welcome hint (appears automatically)
 * 2. Dark/Light explanation (appears after first piece placed)
 * 3. End puzzle hint (appears after 3 pieces placed)
 */
export function MascotButton({ onClick }: MascotButtonProps) {
  const [showBubble, setShowBubble] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [contextualMessage, setContextualMessage] = useState<string | null>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get replenishing state from store
  const replenishingQuadrants = usePuzzleSessionStateStore(state => state.replenishingQuadrants);
  const isAnyReplenishing = replenishingQuadrants.size > 0;

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState<number>(() => {
    const saved = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
    const step = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return step ? parseInt(step, 10) >= ONBOARDING_MESSAGES.length : false;
  });

  // Show contextual hint temporarily
  const showContextualHint = useCallback((message: string, duration: number = 3000) => {
    setContextualMessage(message);
    setShowBubble(true);

    // Clear any existing hide timer
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = setTimeout(() => {
      setShowBubble(false);
      setContextualMessage(null);
    }, duration);
  }, []);

  // Reset idle timer
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      if (hasCompletedOnboarding) {
        showContextualHint(CONTEXTUAL_HINTS.IDLE, 4000);
      }
    }, IDLE_TIMEOUT);
  }, [hasCompletedOnboarding, showContextualHint]);

  // Get current bubble message
  const getBubbleMessage = useCallback((): string => {
    // Contextual message takes priority
    if (contextualMessage) {
      return contextualMessage;
    }
    if (hasCompletedOnboarding) {
      return CONTEXTUAL_HINTS.DEFAULT;
    }
    return ONBOARDING_MESSAGES[onboardingStep] || ONBOARDING_MESSAGES[0];
  }, [hasCompletedOnboarding, onboardingStep, contextualMessage]);

  // Advance onboarding to next step
  const advanceOnboarding = useCallback(() => {
    setOnboardingStep(prev => {
      const next = prev + 1;
      if (next >= ONBOARDING_MESSAGES.length) {
        setHasCompletedOnboarding(true);
        localStorage.setItem(ONBOARDING_STORAGE_KEY, String(ONBOARDING_MESSAGES.length));
        return prev;
      }
      localStorage.setItem(ONBOARDING_STORAGE_KEY, String(next));
      // Show the next hint
      setShowBubble(true);
      setTimeout(() => setShowBubble(false), BUBBLE_AUTO_HIDE_DELAY);
      return next;
    });
  }, []);

  // Show initial bubble on mount (auto-appear behavior)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBubble(true);
      // Hide after delay
      setTimeout(() => setShowBubble(false), BUBBLE_AUTO_HIDE_DELAY);
    }, BUBBLE_AUTO_SHOW_DELAY);

    return () => clearTimeout(timer);
  }, []);

  // Listen for events to advance onboarding and show contextual hints
  useEffect(() => {
    let pieceCount = 0;

    const unsubscribe = eventBus.subscribe((event) => {
      // Reset idle timer on any user activity
      if (['PIECE_PLACED', 'PIECE_DELETED', 'PIECE_EDITED'].includes(event.type)) {
        resetIdleTimer();
      }

      if (event.type === 'PIECE_PLACED') {
        pieceCount++;

        // Advance onboarding based on piece count
        if (!hasCompletedOnboarding) {
          if (pieceCount === 1 && onboardingStep === 0) {
            advanceOnboarding();
          } else if (pieceCount === 3 && onboardingStep === 1) {
            advanceOnboarding();
          }
        }
      }

      // Show contextual hints for various events
      if (event.type === 'PIECE_DELETED' && hasCompletedOnboarding) {
        showContextualHint(CONTEXTUAL_HINTS.DELETED, 2000);
      }

      if (event.type === 'PUZZLE_SESSION_COMPLETED' && hasCompletedOnboarding) {
        showContextualHint(CONTEXTUAL_HINTS.COMPLETED, 4000);
      }
    });

    // Start idle timer
    resetIdleTimer();

    return () => {
      unsubscribe();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [hasCompletedOnboarding, onboardingStep, advanceOnboarding, resetIdleTimer, showContextualHint]);

  // Show replenishing hint when quadrants are being replenished
  useEffect(() => {
    if (isAnyReplenishing && hasCompletedOnboarding) {
      showContextualHint(CONTEXTUAL_HINTS.REPLENISHING, 3000);
    }
  }, [isAnyReplenishing, hasCompletedOnboarding, showContextualHint]);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div className="fixed left-8 bottom-8 z-[9999] flex flex-col items-start pointer-events-none">
      {/* Conversational Bubble - positioned to the right of mascot */}
      <div
        className={`
          absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-[#FFB5FA] px-4 py-3 rounded-lg shadow-lg
          border border-[#1C1C1C]/10 min-w-[180px] max-w-[280px] transform transition-all duration-300 origin-left
          ${showBubble ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-90 -translate-x-2 pointer-events-none'}
        `}
      >
        <p className="text-sm text-[#1C1C1C] font-semibold leading-snug whitespace-normal">
          {getBubbleMessage()}
        </p>
        {/* Arrow pointing left to mascot */}
        <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full border-8 border-transparent border-r-[#FFB5FA]"></span>

        {/* Onboarding step indicator (for non-completed users) */}
        {!hasCompletedOnboarding && (
          <div className="flex gap-1 mt-2 justify-center">
            {ONBOARDING_MESSAGES.map((_, idx) => (
              <div
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  idx <= onboardingStep ? 'bg-[#1C1C1C]' : 'bg-[#1C1C1C]/30'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mascot Button */}
      <button
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="mascot-button pointer-events-auto group relative"
        title="Ask AI for help"
        aria-label="Open AI assistant"
      >
        {/* Mascot Image */}
        <img
          src={isHovered ? "/mascot-hovered.svg" : "/mascot-design.svg"}
          alt="Mascot"
          className="w-20 h-20 object-contain drop-shadow-md transform transition-transform duration-300 group-hover:scale-110 group-active:scale-95 animate-float"
        />

        {/* Click Me Text - Shows on Hover */}
        <div
          className={`absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-sm font-bold text-[#1C1C1C] transition-all duration-200 ${
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
          }`}
        >
          Click Me!
        </div>
      </button>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
