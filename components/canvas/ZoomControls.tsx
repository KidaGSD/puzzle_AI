/**
 * ZoomControls Component
 * Fixed zoom controls in bottom-right corner of canvas
 */

import React, { useState } from 'react';
import { Plus, Minus, Maximize2 } from 'lucide-react';

interface ZoomControlsProps {
  scale: number;
  onScaleChange: (newScale: number) => void;
  onFitToCanvas?: () => void;
  minScale?: number;
  maxScale?: number;
}

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
const ZOOM_STEP = 0.25;

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  scale,
  onScaleChange,
  onFitToCanvas,
  minScale = 0.2,
  maxScale = 3,
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const zoomIn = () => {
    const newScale = Math.min(maxScale, scale + ZOOM_STEP);
    onScaleChange(newScale);
  };

  const zoomOut = () => {
    const newScale = Math.max(minScale, scale - ZOOM_STEP);
    onScaleChange(newScale);
  };

  const resetZoom = () => {
    onScaleChange(1);
  };

  const setPreset = (preset: number) => {
    onScaleChange(preset);
    setShowPresets(false);
  };

  const percentage = Math.round(scale * 100);

  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2">
      {/* Zoom presets dropdown */}
      {showPresets && (
        <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700 p-1 mb-1">
          {ZOOM_PRESETS.map(preset => (
            <button
              key={preset}
              onClick={() => setPreset(preset)}
              className={`
                w-full px-3 py-1.5 text-xs text-left rounded
                ${Math.abs(preset - scale) < 0.01
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
                }
              `}
            >
              {Math.round(preset * 100)}%
            </button>
          ))}
        </div>
      )}

      {/* Main controls */}
      <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700 flex items-center overflow-hidden">
        {/* Zoom out */}
        <button
          onClick={zoomOut}
          disabled={scale <= minScale}
          className="p-2 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Zoom out (Ctrl + -)"
        >
          <Minus size={16} className="text-gray-300" />
        </button>

        {/* Percentage display / presets trigger */}
        <button
          onClick={() => setShowPresets(!showPresets)}
          onDoubleClick={resetZoom}
          className="px-3 py-2 min-w-[60px] text-center text-sm font-medium text-gray-200 hover:bg-gray-700 transition-colors"
          title="Click for presets, double-click to reset"
        >
          {percentage}%
        </button>

        {/* Zoom in */}
        <button
          onClick={zoomIn}
          disabled={scale >= maxScale}
          className="p-2 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Zoom in (Ctrl + +)"
        >
          <Plus size={16} className="text-gray-300" />
        </button>
      </div>

      {/* Fit to canvas button */}
      {onFitToCanvas && (
        <button
          onClick={onFitToCanvas}
          className="bg-gray-800/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-700 p-2 hover:bg-gray-700 transition-colors self-end"
          title="Fit all content to view"
        >
          <Maximize2 size={16} className="text-gray-300" />
        </button>
      )}
    </div>
  );
};

export default ZoomControls;
