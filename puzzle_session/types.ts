export interface Position {
  x: number;
  y: number;
}

export type QuadrantType = 'form' | 'motion' | 'expression' | 'function';

export interface Piece {
  id: string;
  quadrant: QuadrantType;
  color: string;
  position: Position; // Grid coordinates
  cells: Position[]; // Relative coordinates of cells occupying the piece
  label?: string;
}

export interface DragItem {
  type: 'SPAWNER' | 'PIECE';
  id: string;
  quadrant?: QuadrantType;
  cells?: Position[];
  color?: string;
  startPos?: Position;
}
