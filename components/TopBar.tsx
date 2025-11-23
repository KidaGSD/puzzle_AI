
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
    <div className="absolute top-0 left-0 w-full z-20 px-6 py-4 flex items-center justify-between pointer-events-none">
      {/* Left: Project Info */}
      <div className="flex items-center gap-3 pointer-events-auto bg-white/90 backdrop-blur-sm p-2 pr-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="w-8 h-8 bg-gradient-to-br from-[#E67E5A] to-[#E07A8A] rounded-lg shadow-inner border border-white/20"></div>
        <div className="flex flex-col">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Project</span>
          <span className="text-sm font-bold text-gray-900 leading-none">{projectTitle}</span>
        </div>
      </div>

      {/* Center: Aim */}
      <div className="pointer-events-auto max-w-xl w-full mx-4">
        <input
          type="text"
          value={aim}
          onChange={(e) => setAim(e.target.value)}
          className="w-full bg-white/80 border border-gray-200 rounded-full px-6 py-2.5 text-center text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#5FB3B0] shadow-sm font-medium transition-all"
          placeholder="What is the aim of this exploration?"
        />
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
  );
};
