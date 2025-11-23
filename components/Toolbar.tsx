
import React from 'react';
import { MousePointer2, Type, Image as ImageIcon, BoxSelect, Sparkles } from 'lucide-react';
import { ToolType, PALETTE } from '../types';

interface ToolbarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  onAgentTrigger: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onSelectTool, onAgentTrigger }) => {
  const tools = [
    { id: ToolType.POINTER, icon: MousePointer2, label: 'Select' },
    { id: ToolType.TEXT, icon: Type, label: 'Note' },
    { id: ToolType.IMAGE, icon: ImageIcon, label: 'Image' },
    { id: ToolType.FRAME, icon: BoxSelect, label: 'Frame' },
  ];

  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-6">
      <div
        className="flex flex-col bg-white/90 backdrop-blur border border-gray-200 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-2 gap-2"
      >
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => onSelectTool(tool.id)}
              className={`
                p-3.5 rounded-xl transition-all duration-200 relative group
                ${isActive
                  ? 'bg-[#262626] text-white shadow-lg scale-105'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                }
              `}
              title={tool.label}
            >
              <tool.icon size={20} strokeWidth={isActive ? 2.5 : 2} />

              {/* Tooltip */}
              <span className="absolute left-full ml-4 px-3 py-1.5 bg-[#262626] text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl translate-x-2 group-hover:translate-x-0 duration-200">
                {tool.label}
                {/* Arrow */}
                <span className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-[#262626]"></span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Agent Trigger Separated */}
      <button
        onClick={onAgentTrigger}
        className="
          bg-gradient-to-br from-[#9B8DBF] to-[#8A7CAE] p-4 rounded-2xl text-white
          shadow-[0_10px_20px_rgba(155,141,191,0.3)]
          hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(155,141,191,0.4)]
          active:translate-y-0 active:shadow-sm
          transition-all duration-200 group relative flex items-center justify-center
        "
      >
        <Sparkles size={22} strokeWidth={2.5} className="animate-pulse" />
        <span className="absolute left-full ml-4 px-3 py-1.5 bg-[#9B8DBF] text-white text-xs font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
          Ask Agent
        </span>
      </button>
    </div>
  );
};
