/**
 * ADK Agents Index - Export all puzzle workflow agents
 *
 * Architecture: 1 Manager + 4 Specialized Quadrant Agents
 * - QuadrantManager: Coordinates fragment assignment and runs agents in parallel
 * - FormAgent: Shape, structure, texture, composition
 * - MotionAgent: Pacing, rhythm, verbs, transitions
 * - ExpressionAgent: Emotions, tone, cultural cues, voice
 * - FunctionAgent: Audience, context, accessibility, constraints
 */

// === 1 Manager + 4 Agents Architecture ===
export {
  runQuadrantManager,
  assignFragmentsToModes
} from './quadrantManagerAgent';
export type { EnrichedFragment, ManagerInput, ManagerOutput, FragmentAssignment } from './quadrantManagerAgent';

export { runFormAgent } from './formAgent';
export type { FormAgentInput } from './formAgent';

export { runMotionAgent } from './motionAgent';
export type { MotionAgentInput } from './motionAgent';

export { runExpressionAgent } from './expressionAgent';
export type { ExpressionAgentInput } from './expressionAgent';

export { runFunctionAgent } from './functionAgent';
export type { FunctionAgentInput } from './functionAgent';

// === Legacy Quadrant Agent (kept for backward compatibility) ===
export {
  createQuadrantAgentConfig,
  createAllQuadrantAgentConfigs,
  runQuadrantAgentADK,
  MODE_CONFIG,
  PUZZLE_TYPE_CONFIG
} from './quadrantAgent';

// === Filter Agent ===
export {
  applyDiversityFilter,
  filterPieces,
  createFilterTool,
  retryFilterWithAvoidPhrases
} from './filterAgent';

// === Central Question Agent ===
export {
  runCentralQuestionAgent
} from './centralQuestionAgent';
export type { CentralQuestionInput, CentralQuestionOutput } from './centralQuestionAgent';

// === Mascot Agent (Entry Point) ===
export {
  runMascotSelf,
  runMascotSuggest
} from './mascotAgent';
export type { MascotSelfInput, MascotSuggestInput, MascotProposal, MascotSuggestOutput } from './mascotAgent';

// === Synthesis Agent (End Stage) ===
export {
  runSynthesisAgent,
  synthesizePuzzle
} from './synthesisAgent';
export type { SynthesisInput, SynthesisOutput } from './synthesisAgent';
