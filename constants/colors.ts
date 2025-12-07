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

// Quadrant colors - 5-color palette per quadrant (light to dark)
// Based on Figma/colors/Group 42.png
export const QUADRANT_PALETTE = {
  FORM: {
    // Blue palette for FORM (Shape, structure, composition)
    1: '#C0E5EB',  // Lightest
    2: '#87BEF7',
    3: '#7496E9',  // Primary
    4: '#5354ED',
    5: '#3544E0',  // Darkest
  },
  MOTION: {
    // Green palette for MOTION (Rhythm, animation, timing)
    1: '#C9F9DF',  // Lightest
    2: '#00DE8C',
    3: '#00A650',  // Primary
    4: '#169B2F',
    5: '#0A6439',  // Darkest
  },
  EXPRESSION: {
    // Purple palette for EXPRESSION (Emotion, tone, personality)
    1: '#E0DEF8',  // Lightest
    2: '#C4ADFD',
    3: '#746DD8',  // Primary
    4: '#923CFF',
    5: '#532ACC',  // Darkest
  },
  FUNCTION: {
    // Pink palette for FUNCTION (Audience, context, usability)
    1: '#FFD5FF',  // Lightest
    2: '#FFB5FA',
    3: '#FEA1E6',  // Primary
    4: '#FE93F1',
    5: '#FB07AA',  // Darkest
  },
} as const;

// Quadrant color arrays for sequential piece placement (5 colors each, dark to light)
export const QUADRANT_GRADIENTS = {
  FORM: ['#3544E0', '#5354ED', '#7496E9', '#87BEF7', '#C0E5EB'],      // Blue
  MOTION: ['#0A6439', '#169B2F', '#00A650', '#00DE8C', '#C9F9DF'],    // Green
  EXPRESSION: ['#532ACC', '#923CFF', '#746DD8', '#C4ADFD', '#E0DEF8'],
  FUNCTION: ['#FB07AA', '#FE93F1', '#FEA1E6', '#FFB5FA', '#FFD5FF'],
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

/**
 * Get color by priority level (1-5)
 * Maps directly to the 5-color palette
 */
export type PiecePriority = 1 | 2 | 3 | 4 | 5;
export type SaturationLevel = 'high' | 'medium' | 'low';

/**
 * Map priority to saturation level for legacy compatibility
 * 1-2: high (dark colors), 3: medium (mid colors), 4-5: low (light colors)
 */
export const priorityToSaturation = (priority: PiecePriority | number): SaturationLevel => {
  const p = Math.max(1, Math.min(5, priority)) as PiecePriority;
  if (p <= 2) return 'high';
  if (p <= 3) return 'medium';
  return 'low';
};

export const getPriorityColor = (mode: DesignMode, priority: PiecePriority): string => {
  const palette = QUADRANT_PALETTE[mode];
  return palette[priority];
};

/**
 * Get all priority colors for a mode (useful for UI preview)
 */
export const getAllPriorityColors = (mode: DesignMode): Record<PiecePriority, string> => {
  return {
    1: getPriorityColor(mode, 1),
    2: getPriorityColor(mode, 2),
    3: getPriorityColor(mode, 3),
    4: getPriorityColor(mode, 4),
    5: getPriorityColor(mode, 5),
  };
};

/**
 * Get color for a quadrant based on attachment order
 * @param mode The design mode (FORM, MOTION, EXPRESSION, FUNCTION)
 * @param attachmentIndex The index of the piece being attached (0-based)
 * @returns Hex color string
 *
 * With 5 colors per quadrant, pieces cycle through colors:
 * - Index 0: darkest color
 * - Index 1-4: progressively lighter
 * - Index 5+: wraps back to start
 */
export const getSequentialColor = (mode: DesignMode, attachmentIndex: number): string => {
  const gradient = QUADRANT_GRADIENTS[mode];
  // Cycle through 5 colors
  const colorIndex = attachmentIndex % 5;
  return gradient[colorIndex];
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
