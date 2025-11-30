import React, { useState, useEffect } from 'react'

interface MascotButtonProps {
  onClick: () => void
}

/**
 * Floating mascot button positioned on the left side below the toolbar.
 * Acts as the single AI entry point for starting puzzles and getting suggestions.
 */
export function MascotButton({ onClick }: MascotButtonProps) {
  const [showBubble, setShowBubble] = useState(false);

  // Show a hint bubble occasionally
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowBubble(true);
      // Hide after 5 seconds
      setTimeout(() => setShowBubble(false), 5000);
    }, 3000); // Show after 3s

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed left-6 bottom-28 z-[1000] flex flex-col items-start pointer-events-none">
      {/* Conversational Bubble - positioned to the right of mascot */}
      <div
        className={`
          absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-[#FFB5FA] px-4 py-3 rounded-lg shadow-lg
          border border-[#1C1C1C]/10 max-w-[200px] transform transition-all duration-300 origin-left
          ${showBubble ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-90 -translate-x-2 pointer-events-none'}
        `}
      >
        <p className="text-sm text-[#1C1C1C] font-semibold leading-relaxed">
          Stuck? Click me to start a thinking puzzle!
        </p>
        {/* Arrow pointing left */}
        <span className="absolute left-0 bottom-4 -translate-x-full border-8 border-transparent border-r-[#FFB5FA]"></span>
      </div>

      {/* Mascot Button */}
      <button
        onClick={onClick}
        className="mascot-button pointer-events-auto group relative"
        title="Ask AI for help"
        aria-label="Open AI assistant"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-purple-400 rounded-full blur-lg opacity-20 group-hover:opacity-40 transition-opacity duration-300 animate-pulse"></div>

        {/* Mascot Image */}
        <img
          src="/mascot-design.svg"
          alt="Mascot"
          className="w-14 h-14 object-contain drop-shadow-md transform transition-transform duration-300 group-hover:scale-110 group-active:scale-95 animate-float"
        />
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
