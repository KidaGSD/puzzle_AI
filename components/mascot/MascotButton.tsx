import React, { useState, useEffect } from 'react'

interface MascotButtonProps {
  onClick: () => void
}

/**
 * Floating mascot button that sits in the bottom-right corner of the canvas.
 * Clicking it opens the MascotPanel where users can start puzzles.
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
    <div className="fixed right-6 bottom-6 z-[1000] flex flex-col items-end pointer-events-none">
      {/* Conversational Bubble */}
      <div
        className={`
          mb-3 mr-2 bg-white px-4 py-3 rounded-2xl rounded-br-none shadow-lg 
          border border-purple-100 max-w-[200px] transform transition-all duration-300 origin-bottom-right
          ${showBubble ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-2 pointer-events-none'}
        `}
      >
        <p className="text-sm text-gray-700 font-medium leading-relaxed">
          Stuck? Click me to start a thinking puzzle!
        </p>
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
          className="w-16 h-16 object-contain drop-shadow-md transform transition-transform duration-300 group-hover:scale-110 group-active:scale-95 animate-float"
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
