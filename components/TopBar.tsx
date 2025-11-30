
import React, { useState } from 'react';
import { Undo2, Redo2, Share2, ZoomIn, ZoomOut, Info } from 'lucide-react';

interface TopBarProps {
  projectTitle: string;
  aim: string;
  setAim: (aim: string) => void;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  projectTitle,
  aim,
  setAim,
  scale,
  onZoomIn,
  onZoomOut
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const isEmpty = !aim.trim();

  return (
    <>
      {/* Top Blue Status Bar */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-[#3B82F6] z-30"></div>

      <div className="absolute top-0 left-0 w-full z-20 px-6 py-4 pt-6 flex items-center justify-between pointer-events-none">

        {/* Left: Logo & Input */}
        <div className="flex items-center gap-6 pointer-events-auto">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <img src="/Frame 1.svg" alt="Puzzle AI" className="h-10 w-auto object-contain" />
          </div>

          {/* Input Field with Info Icon */}
          <div className="w-[400px] relative">
            <input
              type="text"
              value={aim}
              onChange={(e) => setAim(e.target.value)}
              className={`w-full bg-transparent backdrop-blur-sm border rounded-lg px-4 py-2 pr-10 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 shadow-sm font-medium transition-all text-sm ${isEmpty
                ? 'border-yellow-400 focus:border-yellow-500'
                : 'border-gray-200 focus:border-[#3B82F6]'
                }`}
              placeholder="Write your project brief here"
            />

            {/* Info Icon */}
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <Info
                size={16}
                className={`cursor-help ${isEmpty ? 'text-yellow-600' : 'text-gray-400'}`}
              />

              {/* Tooltip */}
              {showTooltip && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg z-50">
                  <div className="font-semibold mb-1">Process Aim</div>
                  <div className="text-gray-300 leading-relaxed">
                    This guides all AI suggestions for your project. Describe what you're trying to achieve or explore.
                  </div>
                  <div className="absolute -top-1 right-3 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 pointer-events-auto bg-white/90 backdrop-blur-sm p-2 rounded-xl border border-gray-200 shadow-sm">
          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
            <Undo2 size={18} />
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
            <Redo2 size={18} />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1"></div>

          <button onClick={onZoomOut} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
            <ZoomOut size={18} />
          </button>
          <span className="text-xs font-mono w-10 text-center text-gray-500">{Math.round(scale * 100)}%</span>
          <button onClick={onZoomIn} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
            <ZoomIn size={18} />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1"></div>

          <button className="px-4 py-1.5 bg-[#1A1A1A] text-white rounded-lg text-sm font-medium shadow-md hover:bg-[#333] transition-all flex items-center gap-2">
            Share <Share2 size={14} />
          </button>
        </div>
      </div>
    </>
  );
};
