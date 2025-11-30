
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
  title?: string; // For links or images
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
  type: 'clarify' | 'expand' | 'converge';
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
