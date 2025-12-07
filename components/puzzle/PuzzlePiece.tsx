
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { Piece, Position } from '../../types';
import { CELL_SIZE } from '../../constants/puzzleGrid';
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
  const [isLongPressed, setIsLongPressed] = useState(false);
  const displayTitle = data.title || data.label || '';
  const [editText, setEditText] = useState(displayTitle);
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
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

  // Show preview on hover (with delay), during drag, or on long-press
  useEffect(() => {
    if (isDragging || isLongPressed) {
      setShowPreview(true);
      return;
    }
    if (isHovered && !isEditing) {
      const timer = setTimeout(() => setShowPreview(true), 500);
      return () => clearTimeout(timer);
    } else {
      setShowPreview(false);
    }
  }, [isDragging, isHovered, isEditing, isLongPressed]);

  // Long-press handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    longPressTimerRef.current = setTimeout(() => {
      setIsLongPressed(true);
    }, 500); // 500ms for long-press
  };

  const handleMouseUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // Keep preview open for a bit after release
    if (isLongPressed) {
      setTimeout(() => setIsLongPressed(false), 300);
    }
  };

  const handleMouseLeaveOrCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressed(false);
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

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

  // Use the piece's assigned color directly (supports sequential coloring)
  const adjustedColor = useMemo(() => {
    // Always use the color assigned to the piece
    // This allows sequential color gradients to work properly
    return data.color;
  }, [data.color]);

  // Find the largest rectangle within the shape for text placement
  const textBoundingBox = useMemo(() => {
    // Create a grid representation of the shape
    const grid: boolean[][] = [];
    const gridWidth = maxX - minX + 1;
    const gridHeight = maxY - minY + 1;

    // Initialize grid with false
    for (let y = 0; y < gridHeight; y++) {
      grid[y] = new Array(gridWidth).fill(false);
    }

    // Mark cells that are part of the shape
    normalizedCells.forEach(cell => {
      grid[cell.y][cell.x] = true;
    });

    // Find largest inscribed rectangle
    let maxArea = 0;
    let bestRect = { x: 0, y: 0, width: 1, height: 1 };

    // Try each possible starting position
    for (let startY = 0; startY < gridHeight; startY++) {
      for (let startX = 0; startX < gridWidth; startX++) {
        if (!grid[startY][startX]) continue;

        // Try different rectangle sizes from this start point
        let maxWidth = gridWidth - startX;

        for (let h = 1; h <= gridHeight - startY; h++) {
          // Find width of valid rectangle at this height
          let w = 0;
          for (let x = startX; x < startX + maxWidth; x++) {
            let validColumn = true;
            for (let y = startY; y < startY + h; y++) {
              if (!grid[y][x]) {
                validColumn = false;
                break;
              }
            }
            if (validColumn) {
              w++;
            } else {
              break;
            }
          }

          if (w > 0) {
            const area = w * h;
            if (area > maxArea) {
              maxArea = area;
              bestRect = { x: startX, y: startY, width: w, height: h };
            }
            maxWidth = w; // Narrow search for next row
          } else {
            break;
          }
        }
      }
    }

    // Convert grid coordinates to pixel coordinates
    const pixelRect = {
      x: bestRect.x * CELL_SIZE,
      y: bestRect.y * CELL_SIZE,
      width: bestRect.width * CELL_SIZE,
      height: bestRect.height * CELL_SIZE,
      centerX: (bestRect.x + bestRect.width / 2) * CELL_SIZE,
      centerY: (bestRect.y + bestRect.height / 2) * CELL_SIZE,
    };

    return pixelRect;
  }, [normalizedCells, maxX, minX, maxY, minY]);

  // Calculate text layout based on the inscribed rectangle
  // Optimized for readability with larger fonts and shape-specific strategies
  const textLayout = useMemo(() => {
    const aspectRatio = textBoundingBox.width / textBoundingBox.height;
    const text = displayTitle || '';
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    const charCount = text.length;

    // Shape classification: tall, square, or wide
    const isTall = aspectRatio < 0.8;
    const isWide = aspectRatio > 1.5;
    const isSquare = !isTall && !isWide;

    // Use 90% of the inscribed rectangle for better space utilization
    const containerWidth = textBoundingBox.width * 0.90;
    const containerHeight = textBoundingBox.height * 0.90;

    // === ADAPTIVE FONT SIZE CALCULATION ===
    // Base size depends on shape type, then adjusted by text length
    let baseFontSize: number;
    let lineHeight: number;
    let maxLines: number;

    if (isTall) {
      // TALL SHAPES: vertical orientation, more lines allowed
      // Base: 10-14px range
      baseFontSize = Math.max(10, Math.min(14, containerHeight / 6));
      lineHeight = 1.15;
      maxLines = Math.min(5, Math.floor(containerHeight / (baseFontSize * lineHeight)));
    } else if (isWide) {
      // WIDE SHAPES: horizontal orientation, prefer single/double line
      // Base: 14-18px range for high readability
      baseFontSize = Math.max(14, Math.min(18, containerWidth / 10));
      lineHeight = 1.25;
      maxLines = 2;
    } else {
      // SQUARE SHAPES: balanced, good for medium text
      // Base: 12-16px range
      baseFontSize = Math.max(12, Math.min(16, Math.min(containerWidth, containerHeight) / 5));
      lineHeight = 1.2;
      maxLines = 3;
    }

    // === TEXT LENGTH ADJUSTMENT ===
    // Short text gets larger font, long text gets smaller
    let fontSize = baseFontSize;
    if (wordCount <= 2) {
      // Very short: boost font size
      fontSize = Math.min(baseFontSize * 1.3, isWide ? 20 : 18);
    } else if (wordCount <= 4) {
      // Short: slight boost
      fontSize = Math.min(baseFontSize * 1.1, isWide ? 18 : 16);
    } else if (wordCount > 6 || charCount > 40) {
      // Long text: reduce to fit
      fontSize = Math.max(baseFontSize * 0.85, isTall ? 10 : 12);
    }

    // Ensure font size fits within container constraints
    // Max chars per line estimate: containerWidth / (fontSize * 0.6)
    const estimatedCharsPerLine = containerWidth / (fontSize * 0.55);
    const estimatedLines = Math.ceil(charCount / estimatedCharsPerLine);

    // If text would exceed maxLines, reduce font size
    if (estimatedLines > maxLines && fontSize > 10) {
      const reductionFactor = Math.sqrt(maxLines / estimatedLines);
      fontSize = Math.max(10, fontSize * reductionFactor);
    }

    return {
      isTall,
      isWide,
      isSquare,
      containerWidth,
      containerHeight,
      fontSize: Math.round(fontSize * 10) / 10, // Round to 1 decimal
      lineHeight,
      maxLines,
      centerX: textBoundingBox.centerX,
      centerY: textBoundingBox.centerY,
    };
  }, [textBoundingBox, displayTitle]);

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

  // Show preview if piece has content, image, or just title
  const hasContent = (data.content && data.content.trim().length > 0) || data.imageUrl || displayTitle;

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
                {/* Image display */}
                {data.imageUrl && (
                  <div className="mb-3 rounded-lg overflow-hidden">
                    <img src={data.imageUrl} alt={displayTitle} className="w-full h-32 object-cover" />
                  </div>
                )}

                {/* Source Fragment Section - This is the key distinction from title */}
                {(data.fragmentTitle || data.fragmentSummary || data.fragmentId) ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14,2 14,8 20,8" />
                      </svg>
                      Source Fragment
                    </div>
                    {data.fragmentTitle && (
                      <p className="text-gray-200 text-sm font-medium">{data.fragmentTitle}</p>
                    )}
                    {data.fragmentSummary ? (
                      <p className="text-gray-400 text-sm leading-relaxed">{data.fragmentSummary}</p>
                    ) : data.imageUrl ? (
                      <p className="text-gray-400 text-sm italic">Visual reference from canvas</p>
                    ) : (
                      <p className="text-gray-500 text-xs italic">Fragment linked: {data.fragmentId}</p>
                    )}
                  </div>
                ) : data.content ? (
                  <p className="text-gray-300 text-sm leading-relaxed">{data.content}</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4M12 8h.01"/>
                      </svg>
                      Source
                    </div>
                    <p className="text-gray-400 text-sm">
                      {data.source === 'ai' ? 'AI-generated insight based on project context' : 'User-created piece'}
                    </p>
                    <p className="text-gray-500 text-xs italic">
                      Tip: Add fragments to your canvas for richer AI insights
                    </p>
                  </div>
                )}

                {/* Metadata footer */}
                <div className="mt-3 pt-2 border-t border-gray-700/50 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                    {data.quadrant}
                  </span>
                  {data.category && (
                    <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                      · {data.category}
                    </span>
                  )}
                  {data.source === 'ai' && (
                    <span className="text-[10px] font-medium text-purple-400 uppercase tracking-wider">
                      · AI Generated
                    </span>
                  )}
                  {data.priority && (
                    <span className="text-[10px] font-medium text-blue-400 uppercase tracking-wider">
                      · P{data.priority}
                    </span>
                  )}
                </div>
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
        onMouseLeave={() => { setIsHovered(false); handleMouseLeaveOrCancel(); }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onTouchStart={(e) => handleMouseDown(e as any)}
        onTouchEnd={handleMouseUp}
        onTouchCancel={handleMouseLeaveOrCancel}
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
            {/* Glass morphism gradient - more transparent for frosted glass effect */}
            <linearGradient id={`grad-${data.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={fillColor} stopOpacity="0.85" />
              <stop offset="50%" stopColor={fillColor} stopOpacity="0.7" />
              <stop offset="100%" stopColor={fillColor} stopOpacity="0.8" />
            </linearGradient>
            {/* Inner glow for glass effect */}
            <linearGradient id={`glass-${data.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.3" />
              <stop offset="50%" stopColor="white" stopOpacity="0.05" />
              <stop offset="100%" stopColor="white" stopOpacity="0.1" />
            </linearGradient>
            <filter id={`glow-${data.id}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Glass blur filter for frosted effect */}
            <filter id={`blur-${data.id}`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" />
            </filter>
          </defs>
          {/* Fill all cells without stroke to avoid internal lines */}
          <path
            d={shapePath}
            fill={`url(#grad-${data.id})`}
            stroke="none"
            filter={isHovered ? `url(#glow-${data.id})` : undefined}
          />
          {/* Glass overlay - inner highlight for glass effect */}
          <path
            d={shapePath}
            fill={`url(#glass-${data.id})`}
            stroke="none"
          />
          {/* Outer border - glass edge highlight */}
          <path
            d={shapePath}
            fill="none"
            stroke={isHovered ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.25)'}
            strokeWidth={isHovered ? 1.5 : 1}
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

        {/* Content indicator - REMOVED: no longer showing "i" icon */}

        {/* Title/Content Overlay - Using inscribed rectangle */}
        <div
          className="absolute flex items-center justify-center pointer-events-none"
          style={{
            left: textLayout.centerX - textLayout.containerWidth / 2,
            top: textLayout.centerY - textLayout.containerHeight / 2,
            width: textLayout.containerWidth,
            height: textLayout.containerHeight,
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
              className="w-full bg-white/95 text-gray-800 text-xs font-bold tracking-wider text-center rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 pointer-events-auto shadow-lg"
              placeholder="Title"
              style={{
                minWidth: '60px',
                fontSize: `${Math.min(12, textLayout.fontSize + 2)}px`,
                textTransform: 'capitalize',
              }}
            />
          ) : data.imageUrl ? (
            <div className="relative w-full h-full flex flex-col items-center justify-center gap-1">
              {/* Image thumbnail background */}
              <div
                className="absolute inset-0 rounded-lg overflow-hidden opacity-40"
                style={{
                  backgroundImage: `url(${data.imageUrl})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              {/* Title overlay */}
              <div className="relative bg-black/60 rounded-lg px-2 py-1 backdrop-blur-sm max-w-full">
                <span
                  className="text-white font-bold tracking-wider text-center drop-shadow-lg block"
                  style={{
                    fontSize: `${Math.max(8, textLayout.fontSize - 1)}px`,
                    lineHeight: textLayout.lineHeight,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflowWrap: 'break-word',
                    wordBreak: 'normal',
                    textTransform: 'capitalize',
                  }}
                >
                  {displayTitle || 'Image'}
                </span>
              </div>
              {/* Small image icon indicator */}
              <div className="relative text-white/70">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
              </div>
            </div>
          ) : displayTitle ? (
            <span
              className="text-white font-bold tracking-wider text-center drop-shadow-lg block"
              style={{
                fontSize: `${textLayout.fontSize}px`,
                lineHeight: textLayout.lineHeight,
                width: '100%',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: textLayout.maxLines,
                WebkitBoxOrient: 'vertical',
                overflowWrap: 'break-word',
                wordBreak: 'normal',
                textTransform: 'capitalize',
              }}
            >
              {displayTitle}
            </span>
          ) : (
            <span className="text-white/60 font-medium text-[9px] tracking-wider text-center" style={{ textTransform: 'capitalize' }}>
              Double-Click
            </span>
          )}
        </div>
      </motion.div>
    </>
  );
};
