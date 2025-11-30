import React from 'react';
import { CELL_SIZE } from '../../constants/puzzleGrid';

export const GridBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {/* Dot Grid */}
      <div 
        className="w-full h-full opacity-40"
        style={{
          backgroundImage: 'radial-gradient(#9ca3af 2px, transparent 2px)',
          backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          backgroundPosition: `center`, 
          // Offset by half cell size to align dots with intersections if desired, 
          // or center to align with cell centers. Let's align with cell corners.
          backgroundPositionX: `calc(50% - 1px)`,
          backgroundPositionY: `calc(50% - 1px)`
        }}
      />
      
      {/* Quadrant Crosshair */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-full h-[1px] bg-gray-300 relative"></div>
        <div className="absolute h-full w-[1px] bg-gray-300"></div>
      </div>

      {/* Note: Quadrant labels removed - now displayed inside QuadrantSpawner buttons */}
    </div>
  );
};
