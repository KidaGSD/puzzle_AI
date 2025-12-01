
import { QUADRANT_COLORS, SYSTEM_COLORS } from '../constants/colors';

export const CELL_SIZE = 64; // px
export const GRID_GAP = 0;

export const COLORS = {
  form: QUADRANT_COLORS.FORM,
  motion: QUADRANT_COLORS.MOTION,
  expression: QUADRANT_COLORS.EXPRESSION,
  function: QUADRANT_COLORS.FUNCTION,
  darkCard: SYSTEM_COLORS.darkCard,
  gridDot: SYSTEM_COLORS.gridDot,
  ghost: 'rgba(0,0,0,0.1)'
};

export const QUADRANTS = {
  TL: 'Form',
  TR: 'Motion',
  BL: 'Expression',
  BR: 'Function',
};

// Center card dimensions in grid units (MUST be even for perfect grid alignment)
export const CENTER_CARD_WIDTH = 4;
export const CENTER_CARD_HEIGHT = 2;

// Shapes 1-8 from the reference guide
export const SHAPES = {
  // 1. Horizontal L (3 wide bottom, 2 high right)
  SHAPE_1: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 0 }],

  // 2. Fat T (3 wide bottom, center up)
  SHAPE_2: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 0 }],

  // 3. Square 2x2
  SHAPE_3: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],

  // 4. Horizontal Z (Top-left start) -> [{x:0,0}, {x:1,0}, {x:1,1}, {x:2,1}]
  SHAPE_4: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],

  // 5. Horizontal Bar 3x1
  SHAPE_5: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],

  // 6. Vertical Bar 1x2 (Reference looks short)
  SHAPE_6: [{ x: 0, y: 0 }, { x: 0, y: 1 }],

  // 7. Big Gamma / Gun (3 tall left, 2 wide top) -> [{0,0},{0,1},{0,2},{1,0}]
  // Reference image shape 7: 
  // Row 0: [x, x]
  // Row 1: [x, _]
  // Row 2: [x, _] 
  // Actually looking at image 7: It's 2 wide at top, 3 tall on left.
  SHAPE_7: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }],

  // 8. Vertical S/Z 
  SHAPE_8: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0, y: 2 }],
};

export const ALL_SHAPES = Object.values(SHAPES);

// Shape categorization by aspect ratio for text fitting
// Short text (2-3 words): Use tall/vertical shapes
// Longer text (4-6 words): Use wide/horizontal shapes

export const TALL_SHAPES = [
  SHAPES.SHAPE_6,  // 1×2 vertical bar - best for very short text
  SHAPES.SHAPE_7,  // 2×3 tall gamma
  SHAPES.SHAPE_8,  // 2×3 vertical S/Z
  SHAPES.SHAPE_3,  // 2×2 square - neutral, works for short text
];

export const WIDE_SHAPES = [
  SHAPES.SHAPE_5,  // 3×1 horizontal bar - best for longer text
  SHAPES.SHAPE_1,  // 3×2 horizontal L
  SHAPES.SHAPE_2,  // 3×2 fat T
  SHAPES.SHAPE_4,  // 3×2 horizontal Z
];

/**
 * Select appropriate shape based on text word count
 * @param text The text to display on the piece
 * @returns Appropriate shape cells array
 */
export const getShapeForText = (text: string): { x: number; y: number }[] => {
  // Count words (split by whitespace)
  const wordCount = text.trim().split(/\s+/).length;

  // 2-3 words: Use tall/vertical shapes
  if (wordCount <= 3) {
    return TALL_SHAPES[Math.floor(Math.random() * TALL_SHAPES.length)];
  }

  // 4-6+ words: Use wide/horizontal shapes
  return WIDE_SHAPES[Math.floor(Math.random() * WIDE_SHAPES.length)];
};

/**
 * Get a random shape from either category
 */
export const getRandomShapeFromCategory = (category: 'tall' | 'wide'): { x: number; y: number }[] => {
  const shapes = category === 'tall' ? TALL_SHAPES : WIDE_SHAPES;
  return shapes[Math.floor(Math.random() * shapes.length)];
};
