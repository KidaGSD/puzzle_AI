import React, { useRef, useState, useEffect, forwardRef } from 'react';
import { FragmentData } from '../types';
import { GripVertical, Link2, Image as ImageIcon, Scaling } from 'lucide-react';

interface FragmentProps {
  data: FragmentData;
  scale: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onResizeStart: (e: React.MouseEvent, id: string) => void;
  onUpdate: (id: string, content: string) => void;
  leverColor?: string;
}

export const Fragment = forwardRef<HTMLDivElement, FragmentProps>(({
  data,
  scale,
  isSelected,
  onMouseDown,
  onResizeStart,
  onUpdate,
  leverColor
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

          {/* Placeholder for symmetry or close button */}
          <div className="w-2.5"></div>
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
