
export enum ToolType {
  POINTER = 'POINTER',
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  FRAME = 'FRAME',
}

export enum FragmentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  LINK = 'LINK',
  FRAME = 'FRAME',
}

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface FragmentData {
  id: string;
  type: FragmentType;
  position: Position;
  size: Size;
  content: string; // Text content or Image URL
  title: string;   // Short title (AI-generated if not provided, user-editable)
  leverId?: string; // The "cluster" or "lever" this belongs to
  zIndex: number;
  summary?: string;
  tags?: string[];
}

export interface Lever {
  id: string;
  name: string;
  color: string; // Hex code
}

export interface Puzzle {
  id: string;
  leverId: string;
  title: string;
  type?: PuzzleSessionType; // clarify | expand | refine
  description: string;
}

// Colors from the clean cream palette
export const PALETTE = {
  bg: '#FDFBF7', // Clean Cream
  text: '#1A1A1A', // Sharp Charcoal
  ui_chrome: '#FFFFFF', // Pure White
  grid: '#E2E2E2', // Neutral Grey

  // Accents (Slightly more vibrant to pop against white)
  teal: '#2E8B8B',
  aqua: '#5FB3B0',
  orange: '#E67E5A',
  pink: '#E07A8A',
  purple: '#9B8DBF',

  shadow: 'rgba(0, 0, 0, 0.08)',
  highlight: '#FFFFFF',
};

export type QuadrantType = 'form' | 'motion' | 'expression' | 'function';
// PuzzleSessionType is at SESSION level - each puzzle session is ONE of these types
export type PuzzleSessionType = 'clarify' | 'expand' | 'refine';
// @deprecated - use PuzzleSessionType instead
export type PieceCategoryType = PuzzleSessionType;
export type PieceSourceType = 'user' | 'ai' | 'ai_edited';

/**
 * Priority levels for puzzle pieces
 * 1-2: Core/anchor insights (closest to center, high saturation)
 * 3-4: Supporting insights (middle distance)
 * 5-6: Subtle/detailed insights (further out, low saturation)
 */
export type PiecePriority = 1 | 2 | 3 | 4 | 5 | 6;

export interface Piece {
  id: string;
  quadrant: QuadrantType;
  color: string;
  position: Position; // Grid coordinates
  cells: Position[]; // Relative coordinates of cells occupying the piece

  // ═══════════════════════════════════════════════════════════
  // PIECE TITLE (shown ON the piece - 2-5 words, 陈述式)
  // ═══════════════════════════════════════════════════════════
  text: string;               // The STATEMENT on the piece (AI-generated, 陈述式)
  userAnnotation?: string;    // User's SHORT note

  // Priority for color saturation and positioning
  priority?: PiecePriority;   // 1-6, determines color saturation

  // ═══════════════════════════════════════════════════════════
  // SOURCE FRAGMENT INFO (for summary popup - NOT the title!)
  // ═══════════════════════════════════════════════════════════
  fragmentId?: string;        // Reference to canvas fragment
  fragmentTitle?: string;     // Original title from canvas (e.g., "Brand Color Analysis")
  fragmentSummary?: string;   // AI summary of fragment (1-2 sentences)
  imageUrl?: string;          // If fragment is an image

  // @deprecated - use text instead for display
  title?: string;
  content?: string;
  label?: string;

  // @deprecated - pieces inherit type from puzzle session
  category?: PieceCategoryType;
  source?: PieceSourceType;
}

export interface DragItem {
  type: 'SPAWNER' | 'PIECE';
  id: string;
  quadrant?: QuadrantType;
  cells?: Position[];
  color?: string;
  startPos?: Position;
}
