import React, { useRef, useState, useEffect, forwardRef } from 'react';
import { FragmentData } from '../types';
import { GripVertical, Link2, Image as ImageIcon, Trash2 } from 'lucide-react';
import { contextStore } from '../store/runtime';

interface FragmentProps {
  data: FragmentData;
  scale: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onResizeStart: (e: React.MouseEvent, id: string) => void;
  onUpdate: (id: string, content: string) => void;
  leverColor?: string;
  summary?: string;
  tags?: string[];
  onDelete?: (id: string) => void;
}

export const Fragment = forwardRef<HTMLDivElement, FragmentProps>(({
  data,
  scale,
  isSelected,
  onMouseDown,
  onResizeStart,
  onUpdate,
  leverColor,
  summary,
  tags,
  onDelete
}, ref) => {
  const [localContent, setLocalContent] = useState(data.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize text area
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [localContent]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
    onUpdate(data.id, e.target.value);
  };

  // Styles based on type
  const isImage = data.type === 'IMAGE';
  const isLink = data.type === 'LINK';
  const isFrame = data.type === 'FRAME';

  return (
    <div
      ref={ref}
      className={`absolute flex flex-col rounded-lg transition-shadow duration-200 group
        ${isSelected ? 'z-10' : ''}
      `}
      style={{
        transform: `translate(${data.position.x}px, ${data.position.y}px)`,
        width: data.size.width,
        height: data.size.height, // Enforce height for all types now that we resize
        backgroundColor: isFrame ? 'rgba(255,255,255,0.1)' : '#fff', // Slight tint for frame
        // 2.5D Thickness and Shadow
        boxShadow: isFrame
          ? 'none'
          : isSelected
            ? '0 14px 28px rgba(0,0,0,0.15), 0 10px 10px rgba(0,0,0,0.12), 0 4px 0 #e5e5e5'
            : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1), 0 2px 0 #e5e5e5',
        border: isFrame ? '2px dashed #e5e5e5' : '1px solid #e5e5e5',
        zIndex: isSelected ? 100 : data.zIndex,
        // pointerEvents: isFrame && !isSelected ? 'none' : 'auto', // Allow clicking through frame if not selected (optional, but good for frames) - actually let's keep it clickable for selection
      }}
      onMouseDown={(e) => onMouseDown(e, data.id)}
    >
      {/* Top Handle / Lever Indicator - Hide for Frame unless selected? Or just different style? */}
      {!isFrame && (
        <div className="h-6 w-full bg-gray-50 rounded-t-lg border-b border-gray-100 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing relative shrink-0">
          {/* Lever Pip */}
          <div className="flex items-center gap-2">
            {leverColor ? (
              <div
                className="w-2.5 h-2.5 rounded-full shadow-sm border border-black/10"
                style={{ backgroundColor: leverColor }}
              />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-gray-200 border border-black/5" />
            )}
          </div>

          <GripVertical size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onDelete) onDelete(data.id);
            }}
            className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-500 transition-opacity opacity-0 group-hover:opacity-100"
            title="Delete fragment"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className={`relative flex-1 overflow-hidden flex flex-col ${isFrame ? '' : 'p-4 bg-white rounded-b-lg'}`}>
        {isFrame ? (
          <div className="p-2 text-xs font-bold text-gray-400 uppercase tracking-wider select-none">
            {data.title || 'Frame'}
          </div>
        ) : isImage ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded border border-dashed border-gray-200 overflow-hidden">
            {data.content ? (
              <img src={data.content} alt={data.title} className="w-full h-full object-cover pointer-events-none" />
            ) : (
              <>
                <ImageIcon size={24} className="text-gray-300 mb-2" />
                <span className="text-xs text-gray-400">Image Placeholder</span>
              </>
            )}
          </div>
        ) : isLink ? (
          <div className="flex items-center gap-3 p-2 bg-[#F5F1E8] rounded-md border border-[#EBE6DA] h-full">
            <div className="w-10 h-10 bg-white rounded flex items-center justify-center shrink-0 shadow-sm border border-gray-100">
              <Link2 size={20} className="text-[#8AC6C3]" />
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-[#262626] truncate">{data.title || 'Link Title'}</span>
              <span className="text-[10px] text-gray-500 truncate">{data.content}</span>
            </div>
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            value={localContent}
            onChange={handleChange}
            className="w-full h-full bg-transparent resize-none focus:outline-none text-[#262626] font-medium leading-relaxed font-sans text-[15px]"
            placeholder="Type a note..."
            onMouseDown={(e) => e.stopPropagation()} // Allow selecting text without dragging fragment immediately
          />
        )}

        {/* Summary & Tags */}
        {(summary || (tags && tags.length)) && !isFrame && (
          <div className="mt-2 text-[12px] text-gray-500 space-y-1">
            {summary && <div className="leading-snug">Summary: {summary}</div>}
            {tags && tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 4).map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-100 rounded-full text-[10px] font-semibold text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Puzzle Labels */}
        {!isFrame && (() => {
          const storeFragment = contextStore.getState().fragments.find(f => f.id === data.id);
          const labels = storeFragment?.labels || [];
          if (labels.length === 0) return null;

          return (
            <div className="mt-2 flex flex-wrap gap-1">
              {labels.map((puzzleId, idx) => {
                const puzzle = contextStore.getState().puzzles.find(p => p.id === puzzleId);
                if (!puzzle) return null;

                const questionPreview = puzzle.centralQuestion?.slice(0, 20) || 'Puzzle';
                const hue = (idx * 137.5) % 360;

                return (
                  <span
                    key={puzzleId}
                    className="px-2 py-0.5 text-xs rounded-full"
                    style={{
                      backgroundColor: `hsl(${hue}, 70%, 85%)`,
                      color: `hsl(${hue}, 70%, 30%)`
                    }}
                    title={puzzle.centralQuestion}
                  >
                    📌 {questionPreview}{puzzle.centralQuestion && puzzle.centralQuestion.length > 20 ? '...' : ''}
                  </span>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Resize Handle */}
      {isSelected && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center z-50"
          onMouseDown={(e) => onResizeStart(e, data.id)}
        >
          <div className="w-2 h-2 bg-blue-500 rounded-full shadow-sm"></div>
        </div>
      )}
    </div>
  );
});

Fragment.displayName = 'Fragment';
