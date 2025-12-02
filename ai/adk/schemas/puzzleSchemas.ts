/**
 * ADK Puzzle Schemas - Type definitions for puzzle workflow
 *
 * These schemas define the data contracts between agents and tools
 * in the ADK-based puzzle generation pipeline.
 */

import { DesignMode, PuzzleType, SaturationLevel, PiecePriority } from "../../../domain/models";

// ========== Fragment Feature Schema ==========

export interface FragmentFeatureSchema {
  fragmentId: string;
  analysisStatus: string;  // 'pending' | 'complete' | 'failed' | 'stale' | 'analyzed' | 'fallback' | 'error'
  updatedAt: number;

  // Text features
  keywords?: string[];
  themes?: string[];
  entities?: string[];
  sentiment?: string;  // 'positive' | 'negative' | 'neutral'

  // Image features (for IMAGE type)
  palette?: string[];
  objects?: string[];
  mood?: string;
  composition?: string;

  // Unified insight
  uniqueInsight?: string;
}

// ========== Retrieval Schema ==========

export interface RetrievalScoreSchema {
  fragmentId: string;
  relevanceScore: number;    // 0-1: How relevant to processAim + centralQuestion
  diversityScore: number;    // 0-1: How different from already selected
  noveltyScore: number;      // 0-1: How underused in current session
  totalScore: number;        // Weighted combination
  reasons: string[];         // Explanation of scores
}

export interface RetrievalResultSchema {
  global: RetrievalScoreSchema[];           // Top fragments across all modes
  perMode: Map<DesignMode, RetrievalScoreSchema[]>;  // Mode-specific selections
  stats: {
    totalFragments: number;
    selectedCount: number;
    textCount: number;
    imageCount: number;
    avgRelevance: number;
    avgDiversity: number;
  };
}

// ========== Piece Schema ==========

export interface PieceSchema {
  text: string;                    // 2-5 word statement
  priority: PiecePriority;         // 1-6
  saturationLevel: SaturationLevel;
  mode: DesignMode;

  // Fragment grounding (mandatory for at least 60%)
  fragmentId?: string;
  fragmentTitle?: string;
  fragmentSummary: string;         // MANDATORY: reasoning for this piece
  imageUrl?: string;

  // Quality metadata
  qualityMeta?: {
    wordCount: number;
    isQuestion: boolean;
    hasFragmentGrounding: boolean;
    isBlacklisted: boolean;
  };
}

// ========== Filter Result Schema ==========

export interface FilterResultSchema {
  pieces: PieceSchema[];
  stats: {
    inputCount: number;
    outputCount: number;
    filteredReasons: Record<string, number>;  // reason -> count
    uniqueRate: number;                        // 0-1
    fragmentCoverage: number;                  // 0-1
    qualityScore: number;                      // 0-100
  };
}

// ========== Quadrant Agent Input/Output ==========

export interface QuadrantAgentInputSchema {
  mode: DesignMode;
  puzzleType: PuzzleType;
  centralQuestion: string;
  processAim: string;

  // Fragment context
  relevantFragments: Array<{
    id: string;
    title: string;
    summary: string;
    tags?: string[];
    imageUrl?: string;
    uniqueInsight?: string;
  }>;

  // Existing pieces for dedup
  existingPieces: Array<{
    text: string;
    priority: PiecePriority;
  }>;

  // Anchors
  anchors: Array<{
    type: 'STARTING' | 'SOLUTION';
    text: string;
  }>;

  // Generation config
  requestedCount: number;
  maxTotalChars: number;
  preferenceHints?: string;
  avoidPhrases?: string[];
}

export interface QuadrantAgentOutputSchema {
  pieces: PieceSchema[];
  meta: {
    mode: DesignMode;
    generatedCount: number;
    filteredCount: number;
    qualityScore: number;
  };
}

// ========== Session State Schema ==========

export interface PuzzleSessionStateSchema {
  sessionId: string;
  userId: string;
  startedAt: number;

  // Current state
  currentStage: 'gathering' | 'analysis' | 'synthesis' | 'refinement';
  puzzleType: PuzzleType;
  centralQuestion: string;

  // Pieces per quadrant
  preGenPieces: {
    FORM: PieceSchema[];
    MOTION: PieceSchema[];
    EXPRESSION: PieceSchema[];
    FUNCTION: PieceSchema[];
  };

  // Usage tracking
  usedTexts: Set<string>;
  usedFragmentCounts: Map<string, number>;

  // Quality metrics
  qualityScore: number;
  completionPercentage: number;
}

// ========== Preference Profile Schema ==========

export interface PreferenceHintsSchema {
  mode: DesignMode;
  puzzleType: PuzzleType;
  hints: string;
  suggestedLength: 'shorter' | 'normal' | 'longer';
  suggestedDiversity: 'lower' | 'normal' | 'higher';
}

// ========== Synthesis Schema ==========

export interface SynthesisInputSchema {
  puzzleId: string;
  puzzleType: PuzzleType;
  centralQuestion: string;
  processAim: string;

  // Placed pieces with quadrant info
  placedPieces: Array<{
    quadrant: DesignMode;
    text: string;
    fragmentSummary?: string;
  }>;

  // Anchors
  anchors: Array<{
    type: 'STARTING' | 'SOLUTION';
    text: string;
  }>;
}

export interface SynthesisOutputSchema {
  title: string;
  oneLine: string;
  directionStatement: string;
  keyInsights: string[];
  nextSteps?: string[];
}

// ========== Tool Response Schemas ==========

export interface ToolResponseSchema {
  success: boolean;
  data?: any;
  error?: string;
}

export interface FeatureStoreToolResponse extends ToolResponseSchema {
  data?: {
    features: FragmentFeatureSchema[];
    cacheHits: number;
    newExtractions: number;
  };
}

export interface RetrievalToolResponse extends ToolResponseSchema {
  data?: RetrievalResultSchema;
}

export interface PreGenPoolToolResponse extends ToolResponseSchema {
  data?: {
    enqueuedCount: number;
    skippedCount: number;
    currentPoolSize: number;
  };
}
