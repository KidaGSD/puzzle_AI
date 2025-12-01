import React, { useRef, useState, useEffect, forwardRef } from 'react';
import { FragmentData } from '../types';
import { GripVertical, Link2, Image as ImageIcon, Trash2, Edit2, Check, X, Maximize2 } from 'lucide-react';
import { contextStore } from '../store/runtime';

interface FragmentProps {
  data: FragmentData;
  scale: number;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onResizeStart: (e: React.MouseEvent, id: string) => void;
  onUpdate: (id: string, content: string) => void;
  onTitleUpdate?: (id: string, title: string) => void;
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
  onTitleUpdate,
  leverColor,
  summary,
  tags,
  onDelete
}, ref) => {
  const [localContent, setLocalContent] = useState(data.content);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(data.title || '');
  const [showImageModal, setShowImageModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync local title when data changes
  useEffect(() => {
    if (!isEditingTitle) {
      setLocalTitle(data.title || '');
    }
  }, [data.title, isEditingTitle]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Handle title save
  const handleTitleSave = () => {
    setIsEditingTitle(false);
    if (localTitle.trim() !== data.title && onTitleUpdate) {
      onTitleUpdate(data.id, localTitle.trim());
    }
  };

  // Handle title cancel
  const handleTitleCancel = () => {
    setIsEditingTitle(false);
    setLocalTitle(data.title || '');
  };

  // Handle title key events
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    }
    if (e.key === 'Escape') {
      handleTitleCancel();
    }
  };

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
      {/* Top Handle / Title Bar - Hide for Frame */}
      {!isFrame && (
        <div className="h-8 w-full bg-gray-50 rounded-t-lg border-b border-gray-100 flex items-center px-2 cursor-grab active:cursor-grabbing relative shrink-0 gap-1.5">
          {/* Lever Pip */}
          {leverColor ? (
            <div
              className="w-2.5 h-2.5 rounded-full shadow-sm border border-black/10 shrink-0"
              style={{ backgroundColor: leverColor }}
            />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-gray-200 border border-black/5 shrink-0" />
          )}

          {/* AI Title - Editable */}
          <div className="flex-1 min-w-0 flex items-center">
            {isEditingTitle ? (
              <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={handleTitleSave}
                  className="flex-1 text-[11px] font-medium text-gray-700 bg-white border border-blue-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Fragment title..."
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <button
                  onClick={handleTitleSave}
                  className="p-0.5 text-green-600 hover:text-green-700"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={handleTitleCancel}
                  className="p-0.5 text-gray-400 hover:text-gray-600"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <span
                className="text-[11px] font-medium text-gray-600 truncate cursor-text"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingTitle(true);
                }}
                title={localTitle || 'Click to add title'}
              >
                {localTitle || <span className="text-gray-400 italic">Untitled</span>}
              </span>
            )}
          </div>

          {/* Edit button (visible on hover) */}
          {!isEditingTitle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingTitle(true);
              }}
              className="p-1 text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              title="Edit title"
            >
              <Edit2 size={12} />
            </button>
          )}

          <GripVertical size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onDelete) onDelete(data.id);
            }}
            className="p-1 text-gray-300 hover:text-red-500 transition-opacity opacity-0 group-hover:opacity-100 shrink-0"
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
          <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 rounded border border-dashed border-gray-200 overflow-hidden relative group/image">
            {data.content ? (
              <>
                <img
                  src={data.content}
                  alt={data.title}
                  className="w-full h-full object-contain cursor-zoom-in"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImageModal(true);
                  }}
                />
                {/* Expand button overlay */}
                <button
                  className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg opacity-0 group-hover/image:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowImageModal(true);
                  }}
                  title="View full size"
                >
                  <Maximize2 size={14} className="text-white" />
                </button>
              </>
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

        {/* Puzzle Labels - colored by puzzle type */}
        {!isFrame && (() => {
          const storeFragment = contextStore.getState().fragments.find(f => f.id === data.id);
          const labels = storeFragment?.labels || [];
          if (labels.length === 0) return null;

          // Puzzle type colors: CLARIFY=Blue, EXPAND=Orange, REFINE=Purple
          const PUZZLE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
            CLARIFY: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
            EXPAND: { bg: '#FFEDD5', text: '#9A3412', border: '#F97316' },
            REFINE: { bg: '#F3E8FF', text: '#6B21A8', border: '#9333EA' },
          };

          return (
            <div className="mt-2 flex flex-wrap gap-1">
              {labels.map((puzzleId) => {
                const puzzle = contextStore.getState().puzzles.find(p => p.id === puzzleId);
                if (!puzzle) return null;

                const puzzleType = puzzle.type || 'CLARIFY';
                const colors = PUZZLE_TYPE_COLORS[puzzleType] || PUZZLE_TYPE_COLORS.CLARIFY;

                return (
                  <span
                    key={puzzleId}
                    className="w-3 h-3 rounded-full border-2"
                    style={{
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                    }}
                    title={`${puzzleType}: ${puzzle.centralQuestion}`}
                  />
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

      {/* Image Modal for full-size view */}
      {showImageModal && isImage && data.content && (
        <div
          className="fixed inset-0 z-[500] bg-black/90 flex items-center justify-center"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh]">
            <img
              src={data.content}
              alt={data.title || 'Image'}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            {/* Close button */}
            <button
              className="absolute -top-4 -right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
              onClick={() => setShowImageModal(false)}
              title="Close"
            >
              <X size={20} className="text-gray-700" />
            </button>
            {/* Image title */}
            {data.title && (
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-white font-medium text-lg">{data.title}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

Fragment.displayName = 'Fragment';
