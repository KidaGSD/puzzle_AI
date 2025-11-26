
import React from 'react';
import { Undo2, Redo2, Share2, ZoomIn, ZoomOut } from 'lucide-react';

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
  return (
    <>
      {/* Top Blue Status Bar */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-[#3B82F6] z-30"></div>

      <div className="absolute top-0 left-0 w-full z-20 px-6 py-4 pt-6 flex items-center justify-between pointer-events-none">

        {/* Left: Logo & Input */}
        <div className="flex items-center gap-6 pointer-events-auto">
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <img src="/Vector.png" alt="Puzzle AI" className="w-8 h-8 object-contain" />
            <span className="text-xl font-extrabold text-gray-900 tracking-tight">Puzzle AI</span>
            <span className="text-gray-300">/</span>
            <span className="text-lg font-semibold text-gray-700">{projectTitle}</span>
          </div>

          {/* Input Field */}
          <div className="w-[400px]">
            <input
              type="text"
              value={aim}
              onChange={(e) => setAim(e.target.value)}
              className="w-full bg-transparent backdrop-blur-sm border border-gray-200 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/20 focus:border-[#3B82F6] shadow-sm font-medium transition-all text-sm"
              placeholder="Write your project brief here"
            />
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
