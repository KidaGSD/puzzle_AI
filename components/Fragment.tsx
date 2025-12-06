import React, { useRef, useState, useEffect, forwardRef } from 'react';
import { FragmentData } from '../types';
import { Link2, Image as ImageIcon, Trash2, Maximize2, Sparkles } from 'lucide-react';
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
  const [showAISummary, setShowAISummary] = useState(false);
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

  // ESC key to close image modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showImageModal) {
        setShowImageModal(false);
      }
    };

    if (showImageModal) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [showImageModal]);

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
  const hasFixedHeight = data.size.height != null;

  return (
    <div
      ref={ref}
      className="absolute flex flex-col rounded-lg group cursor-move"
      style={{
        transform: `translate(${data.position.x}px, ${data.position.y}px) ${isSelected ? 'rotateX(1deg)' : 'rotateX(0deg)'}`,
        transformStyle: 'preserve-3d',
        width: data.size.width || 320,
        height: 'auto',
        maxHeight: hasFixedHeight ? undefined : '80vh', // Prevent extremely tall fragments
        background: 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,0.98) 100%)',
        boxShadow: isSelected
          ? '0 20px 40px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.95), inset 0 -1px 3px rgba(0,0,0,0.03)'
          : '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.06), inset 0 2px 4px rgba(255,255,255,0.95), inset 0 -1px 3px rgba(0,0,0,0.03)',
        border: '1px solid #D6D6D6',
        borderTop: '1px solid rgba(255,255,255,0.8)',
        zIndex: data.zIndex,
        overflow: hasFixedHeight ? 'hidden' : 'visible', // Changed: visible for auto-height
      }}
      onMouseDown={(e) => onMouseDown(e, data.id)}
    >

      {/* Action Buttons - Top Right Corner (Hover) */}
      {!isFrame && (
        <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {/* AI Summary button */}
          {summary && !summary.startsWith('/') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAISummary(!showAISummary);
              }}
              className={`p-1.5 rounded transition-colors ${
                showAISummary
                  ? 'bg-purple-100 text-purple-600'
                  : 'bg-white/90 text-gray-400 hover:text-purple-500 hover:bg-purple-50'
              }`}
              title="AI Summary"
            >
              <Sparkles size={14} />
            </button>
          )}

          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onDelete) onDelete(data.id);
            }}
            className="p-1.5 bg-white/90 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {/* AI Summary Popup */}
      {showAISummary && summary && !summary.startsWith('/') && (
        <div className="mx-4 mt-4 p-3 bg-purple-50 border border-purple-100 rounded-lg text-[12px] text-purple-700">
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-purple-400" />
            <div>
              <span className="font-semibold text-purple-600">AI Summary: </span>
              {summary}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - Scrollable */}
      <div
        className={hasFixedHeight ? "flex-1 overflow-auto p-4" : "p-4"}
        style={hasFixedHeight ? {} : { overflow: 'visible' }}
      >
        {isFrame ? (
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            {data.title || 'Frame'}
          </div>
        ) : isImage ? (
          <>
            {/* Image Title */}
            <div className="mb-2">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={handleTitleSave}
                  className="w-full text-[20px] font-semibold leading-[24px] text-[#000000] bg-white border-2 border-gray-200 focus:border-purple-200 rounded px-2 py-1 focus:outline-none focus:ring-0 shadow-sm transition-colors"
                  placeholder="Fragment title..."
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ lineHeight: '24px' }}
                />
              ) : (
                <h2
                  className="text-[20px] font-semibold leading-[24px] text-[#000000] cursor-text"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingTitle(true);
                  }}
                  title="Click to edit title"
                  style={{ lineHeight: '24px' }}
                >
                  {localTitle || <span className="text-gray-300">Untitled</span>}
                </h2>
              )}
            </div>

            {/* Image Content */}
            <div className="w-full flex items-center justify-center bg-gray-50 rounded overflow-hidden relative group/image" style={{ minHeight: '200px' }}>
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
                  <ImageIcon size={32} className="text-gray-300 mb-2" />
                  <span className="text-sm text-gray-400">Image Placeholder</span>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Text Title */}
            <div className="mb-2">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onKeyDown={handleTitleKeyDown}
                  onBlur={handleTitleSave}
                  className="w-full text-[20px] font-semibold leading-[24px] text-[#000000] bg-white border-2 border-gray-200 focus:border-purple-200 rounded px-2 py-1 focus:outline-none focus:ring-0 shadow-sm transition-colors"
                  placeholder="Fragment title..."
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{ lineHeight: '24px' }}
                />
              ) : (
                <h2
                  className="text-[20px] font-semibold leading-[24px] text-[#000000] cursor-text"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingTitle(true);
                  }}
                  title="Click to edit title"
                  style={{ lineHeight: '24px' }}
                >
                  {localTitle || <span className="text-gray-300">Untitled</span>}
                </h2>
              )}
            </div>

            {/* Text Content */}
            <textarea
              ref={textareaRef}
              value={localContent}
              onChange={handleChange}
              className="w-full bg-transparent resize-none focus:outline-none text-[14px] leading-[18px] text-[#2F2F2F] font-normal"
              placeholder="Type a note..."
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                minHeight: '60px',
                height: 'auto',
                overflow: 'hidden',
                lineHeight: '18px'
              }}
            />
          </>
        )}
      </div>

      {/* Bottom Row: Tags + Lever Pip - Fixed at bottom with 16px padding */}
      {!isFrame && (() => {
        // Filter valid tags
        const isValidTag = (tag: string) => {
          if (/^(png|jpg|jpeg|gif|webp|pdf|svg)$/i.test(tag)) return false;
          if (/^[0-9]+$/.test(tag)) return false;
          if (/^[0-9a-f]+$/i.test(tag) && tag.length >= 6) return false;
          if (/^(mockupfragments|fragments|images)$/i.test(tag)) return false;
          if (tag.length < 2) return false;
          return true;
        };

        const validTags = (tags || []).filter(isValidTag);

        // Get puzzle labels
        const storeFragment = contextStore.getState().fragments.find(f => f.id === data.id);
        const labels = storeFragment?.labels || [];
        const PUZZLE_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
          CLARIFY: { bg: '#DBEAFE', text: '#1E40AF', border: '#3B82F6' },
          EXPAND: { bg: '#FFEDD5', text: '#9A3412', border: '#F97316' },
          REFINE: { bg: '#F3E8FF', text: '#6B21A8', border: '#9333EA' },
        };

        return (
          <div className="px-4 pb-4 shrink-0">
            {/* Puzzle Labels */}
            {labels.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {labels.map((puzzleId) => {
                  const puzzle = contextStore.getState().puzzles.find(p => p.id === puzzleId);
                  if (!puzzle) return null;

                  const puzzleType = puzzle.type || 'CLARIFY';
                  const colors = PUZZLE_TYPE_COLORS[puzzleType] || PUZZLE_TYPE_COLORS.CLARIFY;

                  return (
                    <span
                      key={puzzleId}
                      className="w-3 h-3 rounded-sm border-2"
                      style={{
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      }}
                      title={`${puzzleType}: ${puzzle.centralQuestion}`}
                    />
                  );
                })}
              </div>
            )}

            {/* Tags + Pip Row */}
            <div className="flex items-center justify-between gap-2">
              {/* Tags - Left side */}
              <div className="flex flex-wrap gap-2 flex-1">
                {validTags.slice(0, 4).map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-[#F1F1F1] text-[#646464] rounded-[16px] text-[8px] font-medium leading-[10px]"
                    style={{
                      height: '18px',
                      lineHeight: '10px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Lever Pip - Right side */}
              {leverColor ? (
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: leverColor }}
                />
              ) : (
                <div className="w-3 h-3 rounded-full bg-[#E5E7EB] shrink-0" />
              )}
            </div>
          </div>
        );
      })()}

      {/* Resize Handle */}
      {isSelected && !isFrame && (
        <div
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center z-50"
          onMouseDown={(e) => onResizeStart(e, data.id)}
        >
          {/* <div className="w-2 h-2 bg-blue-500 rounded-full shadow-sm"></div> */}
        </div>
      )}

      {/* Image Modal */}
      {showImageModal && isImage && data.content && (
        <>
          <div
            className="fixed inset-0 z-[499] bg-black/80 backdrop-blur-sm"
            onClick={() => setShowImageModal(false)}
          />

          <div
            className="absolute inset-0 z-[500] flex items-center justify-center bg-transparent cursor-zoom-out"
            onClick={() => setShowImageModal(false)}
          >
            <img
              src={data.content}
              alt={data.title || 'Image'}
              className="w-full h-full object-contain"
            />
            <button
              className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-lg transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setShowImageModal(false);
              }}
              title="Minimize"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white"
              >
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
});

Fragment.displayName = 'Fragment';
