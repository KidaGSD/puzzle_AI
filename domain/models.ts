export type UUID = string;

export type DesignMode = "FORM" | "MOTION" | "EXPRESSION" | "FUNCTION";

// PuzzleType is at SESSION level - each puzzle session is ONE of these types
export type PuzzleType = "CLARIFY" | "EXPAND" | "REFINE";

// @deprecated - use PuzzleType instead. Kept for backwards compatibility.
export type PuzzlePieceCategory = PuzzleType;

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
  title: string;      // Short, readable title (AI-generated, user-editable)
  content: string;    // Full text content or Image URL
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
  type: PuzzleType;           // THE PUZZLE'S OPERATION TYPE - all pieces inherit this
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
  // NOTE: category is DEPRECATED - pieces inherit type from their puzzle session
  // Kept for backwards compatibility during migration
  category?: PuzzlePieceCategory;
  text: string;               // The QUESTION/PROMPT on the piece (AI-generated)
  userAnnotation?: string;    // User's SHORT ANSWER or note
  // @deprecated - use text instead
  title?: string;
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
  | "PIECE_DETACHED_FROM_ANCHOR"
  // Multi-agent system events
  | "PUZZLE_SESSION_STARTED"    // Triggers full puzzle pre-generation
  | "PUZZLE_SESSION_COMPLETED"  // Session finished, aggregate preferences
  | "QUADRANT_REGENERATE"       // Regenerate a single quadrant
  | "QUADRANT_REPLENISH_NEEDED" // Pool low, needs replenishment
  // Output events from orchestrator
  | "PUZZLE_SESSION_GENERATED"  // Pre-generated pieces ready
  | "QUADRANT_REGENERATED"      // Single quadrant regenerated
  // Error and loading events
  | "AI_ERROR"                  // AI operation failed
  | "AI_LOADING"                // AI operation in progress
  | "AI_SUCCESS";               // AI operation completed

// AI Error payload interface
export type AIErrorSource = 'mascot' | 'puzzle_session' | 'quadrant' | 'synthesis' | 'fragment';

export interface AIErrorPayload {
  source: AIErrorSource;
  message: string;
  recoverable: boolean;
  retryEventType?: UIEventType;
  retryPayload?: unknown;
}

export interface AILoadingPayload {
  source: AIErrorSource;
  message: string;
}

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
  };
}

/**
 * Tracks which fragments have been used in which puzzles
 * Used to display puzzle type colors on fragments in HomeCanvasView
 */
export interface FragmentPuzzleLink {
  fragmentId: UUID;
  puzzleId: UUID;
  puzzleType: PuzzleType;
  linkedAt: number;  // timestamp when the link was created
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
  fragmentPuzzleLinks: FragmentPuzzleLink[];  // Track fragment-puzzle associations
}

// ========== Multi-Agent System Types ==========

/**
 * Priority levels for puzzle pieces
 * 1-2: Core/anchor insights (closest to center, high saturation)
 * 3-4: Supporting insights (middle distance)
 * 5-6: Subtle/detailed insights (further out, low saturation)
 */
export type PiecePriority = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Saturation level mapped from priority
 * high: priority 1-2 (core insights, vivid colors)
 * medium: priority 3-4 (supporting, moderate colors)
 * low: priority 5-6 (subtle details, pastel colors)
 */
export type SaturationLevel = 'high' | 'medium' | 'low';

/**
 * Fragment summary for agent context
 */
export interface FragmentSummary {
  id: UUID;
  type: FragmentType;
  title: string;      // Short title (2-5 words)
  summary: string;    // 1-2 sentence summary
  tags?: string[];
  imageUrl?: string;  // If image fragment
}

/**
 * Shared input schema for all QuadrantAgents
 */
export interface QuadrantAgentInput {
  mode: DesignMode;
  puzzle_type: PuzzleType;
  central_question: string;
  process_aim: string;
  anchors: Anchor[];
  relevant_fragments: FragmentSummary[];
  existing_pieces: Array<{ text: string; priority: PiecePriority }>;
  preference_hints: string;
  requested_count: number;  // 4-6
  max_total_chars: number;  // e.g., 300
}

/**
 * Output piece from QuadrantAgent
 * text: 陈述式 statement, NOT a question (no ? ending)
 */
export interface QuadrantAgentPiece {
  text: string;              // Statement/insight (no question marks)
  priority: PiecePriority;   // 1-6, determines position and color
  saturation_level: SaturationLevel;
  // Source fragment reference (for summary popup)
  fragment_id?: string;       // Links to canvas fragment
  fragment_title?: string;    // Original title from canvas
  fragment_summary?: string;  // How this fragment influenced the insight
  image_url?: string;         // If derived from image fragment
}

/**
 * Shared output schema for all QuadrantAgents
 */
export interface QuadrantAgentOutput {
  pieces: QuadrantAgentPiece[];
}

/**
 * Input for PuzzleSessionAgent (coordinator)
 */
export interface PuzzleSessionInput {
  process_aim: string;
  fragments_summary: FragmentSummary[];
  previous_puzzle_summaries: PuzzleSummary[];
  preference_profile: UserPreferenceProfile;
  puzzle_type: PuzzleType;
}

/**
 * State for a puzzle session (shared across all quadrant agents)
 */
export interface PuzzleSessionState {
  // Session-level
  session_id: UUID;
  central_question: string;
  puzzle_type: PuzzleType;
  process_aim: string;
  anchors: Anchor[];

  // Pre-generated pieces per quadrant
  form_pieces: QuadrantAgentPiece[];
  motion_pieces: QuadrantAgentPiece[];
  expression_pieces: QuadrantAgentPiece[];
  function_pieces: QuadrantAgentPiece[];

  // Generation status
  generation_status: 'pending' | 'generating' | 'completed' | 'failed';
}
