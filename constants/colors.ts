/**
 * Unified Color Palette for Puzzle AI
 * Based on Figma/colors/ColorPallate.png
 *
 * Quadrant colors use Row 5 (primary saturation level)
 * Saturation decreases as pieces move away from center
 */

// Quadrant colors - primary (saturated)
export const QUADRANT_COLORS = {
  FORM: '#5E5BFF',        // Blue - How it looks
  MOTION: '#00DE8C',      // Green - How it moves
  EXPRESSION: '#8E34FE',  // Purple - What it feels like
  FUNCTION: '#FB07AA',    // Pink/Magenta - What it does
} as const;

// Quadrant colors - full palette (light to dark)
// Based on ColorPallate.png: Blue=FORM, Green=MOTION, Purple=EXPRESSION, Pink=FUNCTION
export const QUADRANT_PALETTE = {
  FORM: {
    // Blue palette for FORM (How it looks)
    100: '#C0E5EB',
    200: '#87BEF7',
    300: '#7496E9',
    400: '#5E5BFF',
    500: '#5354ED',  // Primary
    600: '#3544E0',
    700: '#1244C5',
  },
  MOTION: {
    // Green palette for MOTION (How it moves)
    100: '#C9F9DF',
    200: '#87E8B5',
    300: '#00DE8C',
    400: '#00A650',
    500: '#169B2F',  // Primary
    600: '#0A6439',
    700: '#193E18',
  },
  EXPRESSION: {
    100: '#E0DEF8',
    200: '#C4ADFD',
    300: '#B4ABFA',
    400: '#746DD8',
    500: '#8E34FE',  // Primary (actual bright purple)
    600: '#923CFF',
    700: '#532ACC',
  },
  FUNCTION: {
    100: '#FFD5FF',
    200: '#FFB5FA',
    300: '#FEA1E6',
    400: '#FE93F1',
    500: '#FB07AA',  // Primary
    600: '#E91D26',
    700: '#AF0C21',
  },
} as const;

// System colors
export const SYSTEM_COLORS = {
  // Backgrounds
  canvasBg: '#F5F1E8',      // Cream/warm white for canvas
  puzzleBg: '#F9FAFB',      // Light gray for puzzle session
  darkCard: '#111827',      // Dark slate for center card

  // UI Chrome
  white: '#FFFFFF',
  border: '#E5E7EB',
  gridDot: '#9CA3AF',

  // Text
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  // States
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',

  // Shadows
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowStrong: 'rgba(0, 0, 0, 0.25)',
} as const;

// Helper to get quadrant color by mode
export type DesignMode = 'FORM' | 'MOTION' | 'EXPRESSION' | 'FUNCTION';
export type QuadrantType = 'form' | 'motion' | 'expression' | 'function';

export const getQuadrantColor = (mode: DesignMode | QuadrantType): string => {
  const key = mode.toUpperCase() as DesignMode;
  return QUADRANT_COLORS[key];
};

// Calculate desaturated color based on distance from center
export const getDistanceAdjustedColor = (
  baseColor: string,
  distance: number,
  maxDistance: number = 7
): string => {
  // Convert hex to HSL, reduce saturation based on distance
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  // Reduce saturation and increase lightness based on distance
  const distanceRatio = Math.min(distance / maxDistance, 1);
  const newS = s * (1 - distanceRatio * 0.6); // Reduce saturation up to 60%
  const newL = l + (1 - l) * distanceRatio * 0.4; // Increase lightness up to 40%

  // Convert back to hex
  const hslToRgb = (h: number, s: number, l: number) => {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const [rNew, gNew, bNew] = hslToRgb(h, newS, newL);
  return `#${rNew.toString(16).padStart(2, '0')}${gNew.toString(16).padStart(2, '0')}${bNew.toString(16).padStart(2, '0')}`;
};
