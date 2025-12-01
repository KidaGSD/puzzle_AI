
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Piece, Position } from '../../types';
import { CELL_SIZE } from '../../constants/puzzleGrid';
import { getDistanceAdjustedColor, getPriorityColor } from '../../constants/colors';
import { DesignMode } from '../../domain/models';
import { useGameStore } from '../../store/puzzleSessionStore';

interface PuzzlePieceProps {
  data: Piece;
}

/**
 * Get corner radius info for a cell based on neighboring cells
 */
const getCellCorners = (
  cell: Position,
  cellSet: Set<string>,
  cellSize: number,
  radius: number
): { tl: number; tr: number; br: number; bl: number } => {
  const hasCell = (x: number, y: number) => cellSet.has(`${x},${y}`);
  const { x, y } = cell;

  return {
    // Top-left corner: round if no cell above AND no cell to left
    tl: !hasCell(x, y - 1) && !hasCell(x - 1, y) ? radius : 0,
    // Top-right corner: round if no cell above AND no cell to right
    tr: !hasCell(x, y - 1) && !hasCell(x + 1, y) ? radius : 0,
    // Bottom-right corner: round if no cell below AND no cell to right
    br: !hasCell(x, y + 1) && !hasCell(x + 1, y) ? radius : 0,
    // Bottom-left corner: round if no cell below AND no cell to left
    bl: !hasCell(x, y + 1) && !hasCell(x - 1, y) ? radius : 0,
  };
};

/**
 * Generate SVG path for a single cell with selective rounded corners
 */
const generateCellPath = (
  cell: Position,
  cellSet: Set<string>,
  cellSize: number,
  radius: number
): string => {
  const corners = getCellCorners(cell, cellSet, cellSize, radius);
  const x = cell.x * cellSize;
  const y = cell.y * cellSize;
  const w = cellSize;
  const h = cellSize;
  const { tl, tr, br, bl } = corners;

  // Build path with selective rounded corners
  let d = `M ${x + tl} ${y}`;
  d += ` L ${x + w - tr} ${y}`;
  if (tr > 0) d += ` Q ${x + w} ${y} ${x + w} ${y + tr}`;
  d += ` L ${x + w} ${y + h - br}`;
  if (br > 0) d += ` Q ${x + w} ${y + h} ${x + w - br} ${y + h}`;
  d += ` L ${x + bl} ${y + h}`;
  if (bl > 0) d += ` Q ${x} ${y + h} ${x} ${y + h - bl}`;
  d += ` L ${x} ${y + tl}`;
  if (tl > 0) d += ` Q ${x} ${y} ${x + tl} ${y}`;
  d += ' Z';

  return d;
};

/**
 * Generate combined SVG path for all cells with unified look
 */
const generateUnifiedPath = (cells: Position[], cellSize: number, cornerRadius: number = 14): string => {
  if (cells.length === 0) return '';

  const cellSet = new Set(cells.map(c => `${c.x},${c.y}`));
  const paths = cells.map(cell => generateCellPath(cell, cellSet, cellSize, cornerRadius));
  return paths.join(' ');
};

export const PuzzlePiece: React.FC<PuzzlePieceProps> = ({ data }) => {
  const { updatePiecePosition, updatePieceTitle, removePiece, isValidDrop } = useGameStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const displayTitle = data.title || data.label || '';
  const [editText, setEditText] = useState(displayTitle);
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isValidPos, setIsValidPos] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // Update local edit text when data changes
  useEffect(() => {
    if (!isEditing) {
      setEditText(data.title || data.label || '');
    }
  }, [data.title, data.label, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Show preview on hover (with delay) or during drag
  useEffect(() => {
    if (isDragging) {
      setShowPreview(true);
      return;
    }
    if (isHovered && !isEditing) {
      const timer = setTimeout(() => setShowPreview(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowPreview(false);
    }
  }, [isDragging, isHovered, isEditing]);

  // Calculate bounding box
  const minX = Math.min(...data.cells.map(c => c.x));
  const maxX = Math.max(...data.cells.map(c => c.x));
  const minY = Math.min(...data.cells.map(c => c.y));
  const maxY = Math.max(...data.cells.map(c => c.y));
  const width = (maxX - minX + 1) * CELL_SIZE;
  const height = (maxY - minY + 1) * CELL_SIZE;

  // Normalize cells to start from 0,0
  const normalizedCells = useMemo(() =>
    data.cells.map(c => ({ x: c.x - minX, y: c.y - minY })),
    [data.cells, minX, minY]
  );

  // Generate SVG path for the shape (each cell rendered separately with smart corners)
  const shapePath = useMemo(() =>
    generateUnifiedPath(normalizedCells, CELL_SIZE, 14),
    [normalizedCells]
  );

  // Convert logical grid position to pixel position
  const x = (data.position.x + minX) * CELL_SIZE;
  const y = (data.position.y + minY) * CELL_SIZE;

  // Calculate color based on priority (if available) or distance from center
  const adjustedColor = useMemo(() => {
    // If piece has priority, use priority-based color
    if (data.priority) {
      const mode = data.quadrant.toUpperCase() as DesignMode;
      return getPriorityColor(mode, data.priority);
    }
    // Fallback to distance-based color adjustment
    const centerX = data.position.x + (maxX - minX + 1) / 2;
    const centerY = data.position.y + (maxY - minY + 1) / 2;
    const distance = Math.sqrt(centerX * centerX + centerY * centerY);
    return getDistanceAdjustedColor(data.color, distance);
  }, [data.priority, data.quadrant, data.color, data.position.x, data.position.y, maxX, minX, maxY, minY]);

  // Find center of mass for text placement
  const centerOfMass = useMemo(() => {
    const sumX = normalizedCells.reduce((sum, c) => sum + c.x, 0);
    const sumY = normalizedCells.reduce((sum, c) => sum + c.y, 0);
    return {
      x: (sumX / normalizedCells.length + 0.5) * CELL_SIZE,
      y: (sumY / normalizedCells.length + 0.5) * CELL_SIZE,
    };
  }, [normalizedCells]);

  const handleDragStart = () => {
    setIsDragging(true);
    setIsValidPos(true);
  };

  const handleDrag = (_: any, info: any) => {
    const currentX = x + info.offset.x;
    const currentY = y + info.offset.y;
    const gridX = Math.floor(currentX / CELL_SIZE + 0.5) - minX;
    const gridY = Math.floor(currentY / CELL_SIZE + 0.5) - minY;
    const valid = isValidDrop({ x: gridX, y: gridY }, data.cells, data.id);
    setIsValidPos(valid);
  };

  const handleDragEnd = (_: any, info: any) => {
    setIsDragging(false);
    const currentX = x + info.offset.x;
    const currentY = y + info.offset.y;
    const gridX = Math.floor(currentX / CELL_SIZE + 0.5) - minX;
    const gridY = Math.floor(currentY / CELL_SIZE + 0.5) - minY;

    if (isValidDrop({ x: gridX, y: gridY }, data.cells, data.id)) {
      updatePiecePosition(data.id, { x: gridX, y: gridY });
    } else {
      controls.start({ x, y, transition: { type: 'spring', stiffness: 300, damping: 25 } });
      setIsValidPos(true);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setShowPreview(false);
  };

  const handleEditSave = () => {
    setIsEditing(false);
    if (editText.trim() !== displayTitle) {
      updatePieceTitle(data.id, editText.trim());
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditSave();
    }
    if (e.key === 'Escape') {
      setEditText(displayTitle);
      setIsEditing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removePiece(data.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.confirm('Delete this piece?')) {
      removePiece(data.id);
    }
  };

  const hasContent = data.content && data.content.trim().length > 0;

  // Lighter color for fill
  const fillColor = isDragging && !isValidPos ? '#ef4444' : adjustedColor;

  return (
    <>
      {/* Content Preview Popup */}
      <AnimatePresence>
        {showPreview && hasContent && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed top-20 right-6 z-[100] pointer-events-none"
            style={{ maxWidth: '320px' }}
          >
            <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
              <div
                className="px-4 py-2 border-b border-gray-700/50"
                style={{ backgroundColor: data.color + '20' }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
                  <span className="text-white font-semibold text-sm truncate">
                    {displayTitle || 'Untitled'}
                  </span>
                </div>
              </div>
              <div className="p-4">
                {data.imageUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden">
                    <img src={data.imageUrl} alt={displayTitle} className="w-full h-32 object-cover" />
                  </div>
                )}
                <p className="text-gray-300 text-sm leading-relaxed">{data.content}</p>
                {data.category && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      {data.category}
                    </span>
                    {data.source === 'ai' && (
                      <span className="text-[10px] font-medium text-purple-400 uppercase tracking-wider">
                        AI Generated
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Piece - Unified Shape */}
      <motion.div
        ref={ref}
        drag={!isEditing}
        dragMomentum={false}
        dragElastic={0.05}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={controls}
        initial={{ x, y, scale: 0.9, opacity: 0 }}
        whileInView={{ scale: 1, opacity: 1 }}
        style={{
          width,
          height,
          x,
          y,
          position: 'absolute',
          top: '50%',
          left: '50%',
          zIndex: isDragging ? 50 : isEditing ? 40 : isHovered ? 20 : 10,
          cursor: isEditing ? 'text' : isDragging ? 'grabbing' : 'grab',
        }}
        whileHover={{ scale: isEditing ? 1 : 1.02, zIndex: 20 }}
        whileTap={{ scale: isEditing ? 1 : 1.05, zIndex: 50 }}
      >
        {/* SVG Shape */}
        <svg
          width={width}
          height={height}
          className="absolute inset-0"
          style={{ filter: isDragging ? 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' : 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}
        >
          <defs>
            <linearGradient id={`grad-${data.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={fillColor} stopOpacity="1" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.85" />
            </linearGradient>
            <filter id={`glow-${data.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Fill all cells without stroke to avoid internal lines */}
          <path
            d={shapePath}
            fill={`url(#grad-${data.id})`}
            stroke="none"
            filter={isHovered ? `url(#glow-${data.id})` : undefined}
          />
          {/* Outer border - only on truly outer edges */}
          <path
            d={shapePath}
            fill="none"
            stroke={isHovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'}
            strokeWidth={isHovered ? 2 : 1.5}
            style={{ paintOrder: 'stroke' }}
          />
        </svg>

        {/* Delete button */}
        <AnimatePresence>
          {isHovered && !isDragging && !isEditing && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={handleDelete}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors z-50"
              title="Delete piece"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>

        {/* Content indicator */}
        {hasContent && !isDragging && (
          <div
            className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-md z-20"
            title="Has content - hover to preview"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
        )}

        {/* Title/Content Overlay */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            left: centerOfMass.x - 40,
            top: centerOfMass.y - 20,
            width: 80,
            height: 40,
          }}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleEditSave}
              onKeyDown={handleEditKeyDown}
              className="w-full bg-white/95 text-gray-800 text-xs font-bold uppercase tracking-wider text-center rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 pointer-events-auto shadow-lg"
              placeholder="Title"
              style={{ minWidth: '100px' }}
            />
          ) : data.imageUrl ? (
            <div className="relative w-full h-full">
              <div className="bg-black/50 rounded-lg px-2 py-1 backdrop-blur-sm">
                <span className="text-white font-bold text-[10px] uppercase tracking-wider text-center drop-shadow-lg">
                  {displayTitle || 'Image'}
                </span>
              </div>
            </div>
          ) : displayTitle ? (
            <span className="text-white font-bold text-[11px] uppercase tracking-wider text-center drop-shadow-lg leading-tight px-1">
              {displayTitle}
            </span>
          ) : (
            <span className="text-white/60 font-medium text-[9px] uppercase tracking-wider text-center">
              Double-click
            </span>
          )}
        </div>
      </motion.div>
    </>
  );
};
