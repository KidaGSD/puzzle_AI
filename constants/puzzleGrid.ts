/**
 * Puzzle Session Grid Constants
 * Consolidated from puzzle_session/constants.ts
 */

// Grid dimensions
export const CELL_SIZE = 64; // px per grid cell
export const GRID_GAP = 0;

// Center card dimensions in grid units (must be even for centering)
export const CENTER_CARD_WIDTH = 2;  // 2 cells wide
export const CENTER_CARD_HEIGHT = 2; // 2 cells tall

// Center card pixel dimensions
export const CENTER_CARD_PX_WIDTH = CENTER_CARD_WIDTH * CELL_SIZE;
export const CENTER_CARD_PX_HEIGHT = CENTER_CARD_HEIGHT * CELL_SIZE;

/**
 * Tetris-like puzzle piece shapes
 * Each shape is defined as an array of relative cell positions
 * Position {x: 0, y: 0} is the anchor/origin point
 *
 * Reference: Figma/PuzzleStages/PuzzleShapes.png
 */
export const SHAPES = {
  // 1. Horizontal L (3 wide bottom, 2 high right)
  SHAPE_L: [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 2, y: 0 },
  ],

  // 2. Fat T (3 wide bottom, center up)
  SHAPE_T: [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 0 },
  ],

  // 3. Square 2x2
  SHAPE_SQUARE: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],

  // 4. Horizontal Z
  SHAPE_Z: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 2, y: 1 },
  ],

  // 5. Horizontal Bar 3x1
  SHAPE_BAR_H: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ],

  // 6. Vertical Bar 1x2
  SHAPE_BAR_V: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
  ],

  // 7. Big Gamma / Gun shape
  SHAPE_GAMMA: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ],

  // 8. Vertical S/Z
  SHAPE_S: [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ],
} as const;

export const ALL_SHAPES = Object.values(SHAPES);

export type ShapeType = keyof typeof SHAPES;
export type ShapeCells = (typeof SHAPES)[ShapeType];

/**
 * Get a random shape
 */
export const getRandomShape = (): readonly { x: number; y: number }[] => {
  return ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)];
};

/**
 * Quadrant positions for spawners
 * Relative to viewport
 */
export const QUADRANT_POSITIONS = {
  FORM: { position: 'top-left', className: 'top-1/4 left-12' },
  MOTION: { position: 'top-right', className: 'top-1/4 right-12' },
  EXPRESSION: { position: 'bottom-left', className: 'bottom-1/4 left-12' },
  FUNCTION: { position: 'bottom-right', className: 'bottom-1/4 right-12' },
} as const;

/**
 * Random labels per quadrant for piece generation
 */
export const QUADRANT_LABELS = {
  FORM: ['Solid', 'Light', 'Heavy', 'Soft', 'Round', 'Angular', 'Minimal', 'Dense'],
  MOTION: ['Fast', 'Slow', 'Glide', 'Pop', 'Flow', 'Bounce', 'Drift', 'Snap'],
  EXPRESSION: ['Happy', 'Bold', 'Quiet', 'Zen', 'Loud', 'Warm', 'Cool', 'Playful'],
  FUNCTION: ['Logo', 'Icon', 'Sign', 'Nav', 'Btn', 'Card', 'Hero', 'Footer'],
} as const;

export const getRandomLabel = (quadrant: keyof typeof QUADRANT_LABELS): string => {
  const labels = QUADRANT_LABELS[quadrant];
  return labels[Math.floor(Math.random() * labels.length)];
};
