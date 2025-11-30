
import React, { useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { Piece } from '../types';
import { CELL_SIZE } from '../constants';
import { useGameStore } from '../store';
import clsx from 'clsx';

interface PuzzlePieceProps {
  data: Piece;
}

export const PuzzlePiece: React.FC<PuzzlePieceProps> = ({ data }) => {
  const { updatePiecePosition, isValidDrop } = useGameStore();
  const [isDragging, setIsDragging] = useState(false);
  const controls = useAnimation();
  const ref = useRef<HTMLDivElement>(null);
  const [isValidPos, setIsValidPos] = useState(true);

  // Calculate bounding box in pixels
  const maxX = Math.max(...data.cells.map(c => c.x));
  const maxY = Math.max(...data.cells.map(c => c.y));
  const width = (maxX + 1) * CELL_SIZE;
  const height = (maxY + 1) * CELL_SIZE;

  // Convert logical grid position to pixel position relative to screen center
  const x = data.position.x * CELL_SIZE;
  const y = data.position.y * CELL_SIZE;

  // Calculate distance from center for transparency gradient
  // We use the center of the piece relative to grid origin (0,0)
  // Grid origin is at the crosshair.
  // Piece position is top-left cell. Center of piece is pos + width/2.
  const centerX = data.position.x + (maxX + 1) / 2;
  const centerY = data.position.y + (maxY + 1) / 2;
  const distance = Math.sqrt(centerX * centerX + centerY * centerY);

  // Opacity Logic: 
  // Center (dist ~1-2) -> 1.0
  // Edge (dist ~6-7) -> 0.85 (Still very visible)
  const maxDist = 8;
  // Much gentler falloff
  const opacityFactor = Math.max(0.85, 1 - (distance / maxDist) * 0.3);
  const baseOpacity = Math.min(1, opacityFactor);

  const handleDragStart = () => {
    setIsDragging(true);
    setIsValidPos(true);
  };

  const handleDrag = (_: any, info: any) => {
    const currentX = x + info.offset.x;
    const currentY = y + info.offset.y;

    const gridX = Math.floor(currentX / CELL_SIZE + 0.5);
    const gridY = Math.floor(currentY / CELL_SIZE + 0.5);

    const valid = isValidDrop({ x: gridX, y: gridY }, data.cells, data.id);
    setIsValidPos(valid);
  };

  const handleDragEnd = (_: any, info: any) => {
    setIsDragging(false);

    const currentX = x + info.offset.x;
    const currentY = y + info.offset.y;

    const gridX = Math.floor(currentX / CELL_SIZE + 0.5);
    const gridY = Math.floor(currentY / CELL_SIZE + 0.5);

    if (isValidDrop({ x: gridX, y: gridY }, data.cells, data.id)) {
      updatePiecePosition(data.id, { x: gridX, y: gridY });
    } else {
      controls.start({ x, y, transition: { type: 'spring', stiffness: 300, damping: 25 } });
      setIsValidPos(true);
    }
  };

  return (
    <motion.div
      ref={ref}
      drag
      dragMomentum={false}
      dragElastic={0.05}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
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
        zIndex: isDragging ? 50 : 10,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      whileHover={{ scale: 1.02, zIndex: 20 }}
      whileTap={{ scale: 1.05, zIndex: 50 }}
    >
      {data.cells.map((cell, idx) => (
        <div
          key={idx}
          className={clsx(
            "absolute transition-all duration-200 backdrop-blur-md",
            isDragging && "shadow-xl z-50",
            isDragging && !isValidPos && "bg-red-500/80",
          )}
          style={{
            left: cell.x * CELL_SIZE,
            top: cell.y * CELL_SIZE,
            width: CELL_SIZE - 0.5, // Almost full size for gapless look
            height: CELL_SIZE - 0.5,
            opacity: isDragging ? 1 : Math.max(0.9, baseOpacity), // Keep opacity high
            background: isDragging && !isValidPos
              ? undefined
              : `linear-gradient(135deg, ${data.color}FF, ${data.color}CC)`, // Fully opaque start, slightly transparent end
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: isDragging ? '0 10px 30px -5px rgba(0,0,0,0.3)' : 'inset 0 1px 0 rgba(255,255,255,0.4)',
            borderRadius: '2px', // Tighter radius for gapless feel
          }}
        >
          {/* Inner highlight for glass effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />

          {idx === 0 && data.label && (
            <div className="absolute inset-0 flex items-center justify-center p-1 pointer-events-none overflow-hidden z-10">
              <span className="text-white font-bold text-[10px] uppercase tracking-wider text-center select-none leading-none drop-shadow-md" style={{ opacity: Math.max(0.8, baseOpacity + 0.2) }}>
                {data.label}
              </span>
            </div>
          )}
        </div>
      ))}
    </motion.div>
  );
};
