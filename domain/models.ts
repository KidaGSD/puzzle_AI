export type UUID = string;

export type DesignMode = "FORM" | "MOTION" | "EXPRESSION" | "FUNCTION";

export type PuzzlePieceCategory = "CLARIFY" | "EXPAND" | "REFINE";

export type AnchorType = "STARTING" | "SOLUTION";

export type FragmentType = "TEXT" | "IMAGE" | "LINK" | "OTHER";

export type PieceStatus = "SUGGESTED" | "PLACED" | "EDITED" | "DISCARDED" | "CONNECTED";

export type PuzzleSource = "user_request" | "ai_suggested";

export type PuzzlePieceSource = "AI" | "USER" | "AI_SUGGESTED_USER_EDITED";

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Fragment {
  id: UUID;
  projectId: UUID;
  type: FragmentType;
  content: string;
  position: Position;
  size?: Size;
  summary?: string;
  tags?: string[];
  labels: string[]; // puzzle ids or tags
  zIndex?: number;
  createdAt?: number;
  updatedAt?: number;
}

export interface FragmentLink {
  fragmentId: UUID;
  puzzlePieceId: UUID;
  span?: string;
}

export interface Cluster {
  id: UUID;
  fragmentIds: UUID[];
  theme: string;
}

export interface Project {
  id: UUID;
  title: string;
  processAim: string;
}

export interface Puzzle {
  id: UUID;
  centralQuestion: string;
  projectId: UUID;
  createdFrom: PuzzleSource;
  createdAt?: number;
}

export interface Anchor {
  id: UUID;
  puzzleId: UUID;
  type: AnchorType;
  text: string;
}

export interface PuzzlePiece {
  id: UUID;
  puzzleId: UUID;
  mode: DesignMode;
  category: PuzzlePieceCategory;
  text: string;
  userAnnotation?: string;
  anchorIds: UUID[];
  fragmentLinks: FragmentLink[];
  source: PuzzlePieceSource;
  status: PieceStatus;
}

export interface PuzzleSummary {
  puzzleId: UUID;
  directionStatement: string;
  reasons: string[];
  openQuestions?: string[];
  title?: string;
  oneLine?: string;
  tags?: string[];
  createdAt?: number;
}

export interface PreferenceStats {
  suggested: number;
  placed: number;
  edited: number;
  discarded: number;
  connected: number;
}

export type UserPreferenceProfile = Record<string, PreferenceStats>;

export type UIEventType =
  | "FRAGMENT_ADDED"
  | "FRAGMENT_UPDATED"
  | "FRAGMENT_DELETED"
  | "MASCOT_CLICKED"
  | "PUZZLE_FINISH_CLICKED"
  | "PUZZLE_CREATED"
  | "PUZZLE_UPDATED"
  | "PIECE_CREATED"
  | "PIECE_PLACED"
  | "PIECE_EDITED"
  | "PIECE_DELETED"
  | "PIECE_ATTACHED_TO_ANCHOR"
  | "PIECE_DETACHED_FROM_ANCHOR";

export interface UIEvent {
  type: UIEventType;
  payload: unknown;
  timestamp: number;
}

export type PieceEventType =
  | "CREATE_SUGGESTED"
  | "CREATE_USER"
  | "PLACE"
  | "EDIT_TEXT"
  | "DELETE"
  | "ATTACH_TO_ANCHOR"
  | "DETACH_FROM_ANCHOR";

export interface PieceEvent {
  pieceId: UUID;
  type: PieceEventType;
  timestamp: number;
}

export interface AgentState {
  mascot: {
    hasShownOnboarding: boolean;
    lastReflectionAt: number;
    reflectionsDisabled: boolean;
    lastProposal?: {
      centralQuestion: string;
      primaryModes: DesignMode[];
      rationale: string;
      suggestedAt: number;
    };
    lastSuggestion?: {
      shouldSuggest: boolean;
      centralQuestion?: string;
      primaryModes?: DesignMode[];
      rationale?: string;
      suggestedAt: number;
    };
  };
}

export interface ProjectStore {
  project: Project;
  fragments: Fragment[];
  clusters: Cluster[];
  puzzles: Puzzle[];
  anchors: Anchor[];
  puzzlePieces: PuzzlePiece[];
  puzzleSummaries: PuzzleSummary[];
  preferenceProfile: UserPreferenceProfile;
  pieceEvents: PieceEvent[];
  agentState: AgentState;
}
