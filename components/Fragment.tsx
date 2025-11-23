import React, { useRef, useState, useEffect } from 'react';
import { FragmentData, PALETTE } from '../types';
import { GripVertical, Link2, Image as ImageIcon } from 'lucide-react';

interface FragmentProps {
  data: FragmentData;
  scale: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onUpdate: (id: string, content: string) => void;
  leverColor?: string;
}

export const Fragment: React.FC<FragmentProps> = ({
  data,
  scale,
  isSelected,
  onMouseDown,
  onUpdate,
  leverColor
}) => {
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

  return (
    <div
      className={`absolute flex flex-col rounded-lg transition-all duration-200 group
        ${isSelected ? 'z-10 translate-y-[-4px]' : 'hover:translate-y-[-2px]'}
      `}
      style={{
        transform: `translate(${data.position.x}px, ${data.position.y}px)`,
        width: data.size.width,
        minHeight: isImage ? undefined : data.size.height,
        backgroundColor: '#fff',
        // 2.5D Thickness and Shadow
        boxShadow: isSelected
          ? '0 14px 28px rgba(0,0,0,0.15), 0 10px 10px rgba(0,0,0,0.12), 0 4px 0 #e5e5e5'
          : '0 4px 6px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.1), 0 2px 0 #e5e5e5',
        border: '1px solid #e5e5e5',
        zIndex: isSelected ? 100 : data.zIndex,
      }}
      onMouseDown={(e) => onMouseDown(e, data.id)}
    >
      {/* Top Handle / Lever Indicator */}
      <div className="h-6 w-full bg-gray-50 rounded-t-lg border-b border-gray-100 flex items-center justify-between px-2 cursor-grab active:cursor-grabbing relative">
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

      {/* Content */}
      <div className="p-4 relative flex-1 bg-white rounded-b-lg">
        {isImage ? (
          <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center bg-gray-50 rounded border border-dashed border-gray-200 overflow-hidden">
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
          <div className="flex items-center gap-3 p-2 bg-[#F5F1E8] rounded-md border border-[#EBE6DA]">
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
            className="w-full bg-transparent resize-none focus:outline-none text-[#262626] font-medium leading-relaxed font-sans text-[15px]"
            placeholder="Type a note..."
            style={{ minHeight: '60px' }}
            onMouseDown={(e) => e.stopPropagation()} // Allow selecting text without dragging fragment immediately
          />
        )}
      </div>
    </div>
  );
};
