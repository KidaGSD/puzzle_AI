/**
 * ADK Integration Index
 *
 * Main entry point for ADK-based puzzle workflow system.
 *
 * This is the REAL ADK implementation that:
 * - Uses LlmAgent and Runner for agent execution
 * - Uses retrieval/feature tools for intelligent fragment selection
 * - Uses CentralQuestionAgent for validated question generation
 * - Tracks usage via PreGen pool
 * - Provides preference-based hints
 */

// Runner - main workflow orchestration
export {
  createPuzzleSession,
  startPuzzleSession,
  regenerateQuadrant,
  synthesizePuzzle
} from './runner';
export type { PuzzleSessionResult } from './runner';

// Agents
export {
  // Legacy quadrant agent (backward compatibility)
  createQuadrantAgentConfig,
  createAllQuadrantAgentConfigs,
  runQuadrantAgentADK,
  MODE_CONFIG,
  PUZZLE_TYPE_CONFIG,
  // Filter agent
  applyDiversityFilter,
  filterPieces,
  createFilterTool,
  // Central question agent
  runCentralQuestionAgent,
  // 1 Manager + 4 Agents architecture
  runQuadrantManager,
  assignFragmentsToModes,
  runFormAgent,
  runMotionAgent,
  runExpressionAgent,
  runFunctionAgent,
  // Mascot agent (entry point)
  runMascotSelf,
  runMascotSuggest,
  // Synthesis agent (end stage)
  runSynthesisAgent
} from './agents';
export type {
  CentralQuestionInput,
  CentralQuestionOutput,
  // Manager types
  EnrichedFragment,
  ManagerInput,
  ManagerOutput,
  // Mascot types
  MascotSelfInput,
  MascotSuggestInput,
  MascotProposal,
  MascotSuggestOutput,
  // Synthesis types
  SynthesisInput,
  SynthesisOutput
} from './agents';

// Tools
export {
  createFeatureStoreTool,
  createSummarizeFeaturesTool,
  createRetrievalTools,
  createPreGenPoolTools,
  rankFragments,
  getFragmentsForMode,
  enqueuePieces,
  getNextPiece,
  peekPieces,
  clearPool,
  getPoolStats,
  createPreferenceTools,
  readPreferenceHints,
  updatePreferenceStats,
  getProfileSummary,
  resetProfile
} from './tools';
export type { PreferenceStats, PreferenceProfile, PreferenceAction } from './tools';

// Schemas
export * from './schemas/puzzleSchemas';

// Types - including new LlmAgent and Runner
export {
  SimpleSession,
  SimpleSessionState,
  SimpleFunctionTool,
  LlmAgent,
  Runner
} from './types/adkTypes';
export type {
  Session,
  SessionState,
  ToolContext,
  LlmAgentOptions,
  RunnerOptions,
  RunResult
} from './types/adkTypes';
