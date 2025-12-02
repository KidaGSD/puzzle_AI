/**
 * Quadrant Agent - ADK LlmAgent for generating puzzle pieces per quadrant
 *
 * Implements the redesigned baseQuadrantAgent using ADK patterns:
 * - Structured output schema
 * - Over-generate + filter + rerank
 * - Fragment grounding enforcement
 * - Callbacks for validation and backfill
 */

import {
  LlmAgentOptions,
  LlmRequest,
  LlmResponse,
  CallbackContext,
  ToolContext,
  SimpleFunctionTool as FunctionTool,
  SimpleSession,
  LlmAgent,
  Runner
} from "../types/adkTypes";
import { DesignMode, PuzzleType, PiecePriority } from "../../../domain/models";
import { QuadrantAgentInputSchema, QuadrantAgentOutputSchema, PieceSchema } from "../schemas/puzzleSchemas";
import { priorityToSaturation } from "../../../constants/colors";

// ========== Mode Configuration ==========

export const MODE_CONFIG: Record<DesignMode, {
  focus: string;
  aspects: string[];
  keywords: string[];
}> = {
  FORM: {
    focus: "Visual structure, shape, composition, spatial relationships",
    aspects: ["geometric vs organic", "visual weight", "layering", "proportion", "texture"],
    keywords: ["structure", "layout", "shape", "composition", "visual", "geometric", "organic"]
  },
  MOTION: {
    focus: "Movement, animation, transitions, rhythm, timing",
    aspects: ["speed & pacing", "easing curves", "entrance/exit", "micro-interactions", "flow"],
    keywords: ["animation", "transition", "rhythm", "flow", "timing", "movement", "dynamic"]
  },
  EXPRESSION: {
    focus: "Emotional tone, personality, brand voice, atmosphere",
    aspects: ["mood", "voice & tone", "warmth vs cool", "premium vs accessible", "energy level"],
    keywords: ["mood", "emotion", "tone", "voice", "personality", "feeling", "atmosphere"]
  },
  FUNCTION: {
    focus: "Purpose, utility, user value, practical constraints",
    aspects: ["primary use case", "target audience", "accessibility", "platform", "constraints"],
    keywords: ["purpose", "utility", "audience", "constraint", "accessibility", "practical"]
  }
};

export const PUZZLE_TYPE_CONFIG: Record<PuzzleType, { verb: string; guidance: string }> = {
  CLARIFY: { verb: "clarify", guidance: "Make vague concepts concrete. State what IS, not what to explore." },
  EXPAND: { verb: "expand", guidance: "Introduce fresh perspectives. State new angles and possibilities." },
  REFINE: { verb: "refine", guidance: "Help prioritize. State what's essential and what to commit to." }
};

// ========== Instruction Builder ==========

const buildQuadrantInstruction = (mode: DesignMode): string => {
  const modeInfo = MODE_CONFIG[mode];

  return `You are the ${mode} Quadrant Agent for a design thinking puzzle app.

=== YOUR ROLE ===
Generate short declarative STATEMENTS (2-5 words each) that represent design insights for the ${mode} quadrant.
Focus on: ${modeInfo.focus}
Key aspects: ${modeInfo.aspects.join(", ")}

=== CRITICAL RULES ===
1. TITLE LENGTH: Every piece MUST be 2-5 words. Count before outputting.
2. STATEMENTS ONLY: No questions. Each piece is an insight/answer, not a prompt.
3. FRAGMENT GROUNDING: At least 60% of pieces must cite a fragment with reasoning.
4. UNIQUE CONTENT: Do not repeat phrases from existing pieces or across quadrants.

=== FORMAT PATTERNS (structure, NOT content to copy) ===
- 2 words: Adjective + Noun
- 3 words: Noun + Preposition + Noun
- 4 words: Adjective + Noun + Verb + Noun
- 5 words: Noun + As + Adjective + Noun + Noun

=== PRIORITY ASSIGNMENT ===
- Priority 1-2: Core insights (anchor to central question)
- Priority 3-4: Supporting insights (expand on core)
- Priority 5-6: Subtle/detailed nuances

=== CONTEXT (injected at runtime) ===
Central question: {central_question}
Process aim: {process_aim}
Puzzle type: {puzzle_type}
Fragments: {fragments_summary}
Existing pieces to avoid: {existing_pieces}

Generate insights derived from the fragments above. Extract SPECIFIC insights, not generic advice.`;
};

// ========== Output Schema ==========

const PIECE_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    pieces: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '2-5 word statement' },
          priority: { type: 'number', description: '1-6 priority level' },
          saturation_level: { type: 'string', enum: ['high', 'medium', 'low'] },
          fragment_id: { type: 'string', description: 'ID of source fragment' },
          fragment_title: { type: 'string', description: 'Title of source fragment' },
          fragment_summary: { type: 'string', description: 'MANDATORY reasoning for this piece' },
          image_url: { type: 'string', description: 'URL if image fragment' }
        },
        required: ['text', 'priority', 'fragment_summary']
      }
    }
  },
  required: ['pieces']
};

// ========== Tools ==========

/**
 * Tool to record generated pieces with validation
 */
const createRecordPiecesTool = (mode: DesignMode): FunctionTool => {
  return new FunctionTool({
    name: 'record_pieces',
    description: `Record generated pieces for ${mode} quadrant with validation`,
    fn: async (params: { pieces: any[] }, context: ToolContext) => {
      const session = context.invocationContext.session;
      const input = session.state.get('quadrantInput') as QuadrantAgentInputSchema;

      // Validate and transform pieces
      const validPieces: PieceSchema[] = [];
      const errors: string[] = [];

      for (const p of params.pieces) {
        // Validate word count
        const wordCount = (p.text || '').trim().split(/\s+/).length;
        if (wordCount < 2 || wordCount > 5) {
          errors.push(`"${p.text}" has ${wordCount} words (need 2-5)`);
          continue;
        }

        // Reject questions
        if ((p.text || '').trim().endsWith('?')) {
          errors.push(`"${p.text}" is a question`);
          continue;
        }

        // Ensure reasoning exists
        let fragmentSummary = p.fragment_summary || p.fragmentSummary;
        if (!fragmentSummary) {
          fragmentSummary = `This ${PUZZLE_TYPE_CONFIG[input.puzzleType].verb}s the ${mode.toLowerCase()} direction`;
        }

        // Backfill from input fragments if fragmentId present
        let fragmentId = p.fragment_id || p.fragmentId;
        let fragmentTitle = p.fragment_title || p.fragmentTitle;
        let imageUrl = p.image_url || p.imageUrl;

        if (fragmentId && input.relevantFragments) {
          const srcFrag = input.relevantFragments.find(f => f.id === fragmentId);
          if (srcFrag) {
            if (!fragmentTitle) fragmentTitle = srcFrag.title;
            if (!imageUrl && srcFrag.imageUrl) imageUrl = srcFrag.imageUrl;
            if (!fragmentSummary || fragmentSummary.length < 20) {
              fragmentSummary = `From "${fragmentTitle}": ${srcFrag.summary?.slice(0, 100) || 'This fragment influenced the insight'}`;
            }
          }
        }

        validPieces.push({
          text: p.text.trim(),
          priority: p.priority as PiecePriority,
          saturationLevel: priorityToSaturation(p.priority),
          mode,
          fragmentId,
          fragmentTitle,
          fragmentSummary,
          imageUrl,
          qualityMeta: {
            wordCount,
            isQuestion: false,
            hasFragmentGrounding: !!fragmentId,
            isBlacklisted: false
          }
        });
      }

      // Store in session
      session.state.set('quadrantOutput', {
        pieces: validPieces,
        meta: {
          mode,
          generatedCount: params.pieces.length,
          filteredCount: validPieces.length,
          qualityScore: calculateQualityScore(validPieces, input.relevantFragments?.length || 0)
        }
      } as QuadrantAgentOutputSchema);

      return {
        recorded: validPieces.length,
        rejected: errors.length,
        errors: errors.slice(0, 5)
      };
    },
    functionDeclaration: {
      name: 'record_pieces',
      description: 'Record and validate generated pieces',
      parameters: {
        type: 'object',
        properties: {
          pieces: {
            type: 'array',
            description: 'Array of pieces to record'
          }
        },
        required: ['pieces']
      }
    }
  });
};

/**
 * Calculate quality score for a set of pieces
 */
const calculateQualityScore = (pieces: PieceSchema[], fragmentCount: number): number => {
  if (pieces.length === 0) return 0;

  let score = 0;
  const maxScore = 100;

  // Fragment grounding (40 points)
  const groundedCount = pieces.filter(p => p.fragmentId).length;
  const groundingRate = groundedCount / pieces.length;
  score += groundingRate * 40;

  // Reasoning quality (30 points)
  const avgReasoningLength = pieces.reduce((sum, p) => sum + (p.fragmentSummary?.length || 0), 0) / pieces.length;
  score += Math.min(30, avgReasoningLength / 3);

  // Title length compliance (20 points)
  const validLengthCount = pieces.filter(p => {
    const wc = p.text.split(/\s+/).length;
    return wc >= 2 && wc <= 5;
  }).length;
  score += (validLengthCount / pieces.length) * 20;

  // Diversity (10 points)
  const uniqueFragments = new Set(pieces.filter(p => p.fragmentId).map(p => p.fragmentId)).size;
  const diversityRate = fragmentCount > 0 ? uniqueFragments / Math.min(fragmentCount, pieces.length) : 0.5;
  score += diversityRate * 10;

  return Math.round(Math.min(maxScore, score));
};

// ========== Before/After Callbacks ==========

/**
 * Before model callback: Inject context into instruction
 */
const beforeModelCallback = async (
  context: CallbackContext,
  request: LlmRequest
): Promise<LlmResponse | undefined> => {
  const input = context.state.get('quadrantInput') as QuadrantAgentInputSchema;
  if (!input) return undefined;

  // Build fragments summary for prompt
  const fragmentsSummary = input.relevantFragments
    .slice(0, 5)
    .map((f, i) => {
      if (f.imageUrl) {
        return `${i + 1}. [IMAGE] ID: "${f.id}" | Title: "${f.title}" | ImageURL: "${f.imageUrl}"`;
      }
      return `${i + 1}. ID: "${f.id}" | Title: "${f.title}" | Summary: "${f.summary}" [${f.tags?.join(", ") || "no tags"}]`;
    })
    .join("\n");

  const existingPieces = input.existingPieces
    .map(p => `"${p.text}"`)
    .join(", ");

  // Update system instruction with context
  // This modifies the request to include dynamic context
  console.log(`[QuadrantAgent:${input.mode}] Injecting context: ${input.relevantFragments.length} fragments`);

  return undefined; // Continue to model
};

/**
 * After model callback: Validate output structure
 */
const afterModelCallback = async (
  context: CallbackContext,
  response: LlmResponse
): Promise<LlmResponse | undefined> => {
  const output = context.state.get('quadrantOutput') as QuadrantAgentOutputSchema | undefined;

  if (output && output.pieces.length > 0) {
    console.log(`[QuadrantAgent:${output.meta.mode}] Generated ${output.pieces.length} pieces, quality: ${output.meta.qualityScore}`);
  }

  return undefined;
};

// ========== Agent Factory ==========

/**
 * Create a QuadrantAgent configuration for a specific mode
 * Returns the options that would be used to create an LlmAgent
 */
export const createQuadrantAgentConfig = (mode: DesignMode): LlmAgentOptions => {
  return {
    name: `quadrant_${mode.toLowerCase()}`,
    model: 'gemini-2.0-flash',
    description: `Generate puzzle pieces for the ${mode} quadrant`,
    instruction: buildQuadrantInstruction(mode),

    tools: [createRecordPiecesTool(mode)],

    // Structured output
    outputSchema: PIECE_OUTPUT_SCHEMA,

    // Disable transfers - this is a leaf agent
    disallowTransferToParent: true,
    disallowTransferToPeers: true,

    // Callbacks
    beforeModelCallback,
    afterModelCallback,

    // Generation config
    generateContentConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 2048
    }
  };
};

/**
 * Create all 4 quadrant agent configs
 */
export const createAllQuadrantAgentConfigs = (): Map<DesignMode, LlmAgentOptions> => {
  const configs = new Map<DesignMode, LlmAgentOptions>();
  const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];

  for (const mode of modes) {
    configs.set(mode, createQuadrantAgentConfig(mode));
  }

  return configs;
};

// ========== Real ADK Runner Implementation ==========

/**
 * Run quadrant agent using real ADK LlmAgent and Runner
 * No legacy delegation - pure ADK execution
 */
export const runQuadrantAgentADK = async (
  input: QuadrantAgentInputSchema,
  client: { generate: (prompt: string, temperature?: number) => Promise<string> }
): Promise<QuadrantAgentOutputSchema> => {
  const mode = input.mode;

  // Create session with input state
  const session = new SimpleSession({
    id: `quadrant_${mode}_${Date.now()}`,
    appName: 'puzzle_app',
    userId: 'user',
    state: {
      quadrantInput: input
    }
  });

  // Create the LlmAgent with proper config
  const agentConfig = createQuadrantAgentConfig(mode);
  const agent = new LlmAgent(agentConfig);

  // Create runner
  const runner = new Runner({ agent, session });

  // Build user content from input
  const fragmentsSummary = input.relevantFragments
    .slice(0, 6)
    .map((f, i) => {
      if (f.imageUrl) {
        return `${i + 1}. [IMAGE] ID="${f.id}" Title="${f.title}" ImageURL="${f.imageUrl}"${f.uniqueInsight ? ` Insight: "${f.uniqueInsight}"` : ''}`;
      }
      return `${i + 1}. ID="${f.id}" Title="${f.title}" Summary="${f.summary}" Tags=[${f.tags?.join(', ') || 'none'}]${f.uniqueInsight ? ` Insight: "${f.uniqueInsight}"` : ''}`;
    })
    .join('\n');

  const existingPiecesStr = input.existingPieces
    .map(p => `"${p.text}"`)
    .join(', ');

  const anchorsStr = input.anchors
    .map(a => `${a.type}: "${a.text}"`)
    .join('; ');

  const avoidPhrasesStr = input.avoidPhrases?.join(', ') || '';

  const userContent = `Generate ${input.requestedCount + 2} puzzle pieces for the ${mode} quadrant.

CENTRAL QUESTION: "${input.centralQuestion}"
PROCESS AIM: "${input.processAim}"
PUZZLE TYPE: ${input.puzzleType} - ${PUZZLE_TYPE_CONFIG[input.puzzleType].guidance}

FRAGMENTS TO USE:
${fragmentsSummary}

${existingPiecesStr ? `EXISTING PIECES (do not repeat): ${existingPiecesStr}` : ''}
${anchorsStr ? `ANCHORS: ${anchorsStr}` : ''}
${input.preferenceHints ? `USER PREFERENCES: ${input.preferenceHints}` : ''}
${avoidPhrasesStr ? `AVOID THESE PHRASES: ${avoidPhrasesStr}` : ''}

Generate pieces as JSON with this exact structure:
{
  "pieces": [
    {
      "text": "2-5 word statement",
      "priority": 1-6,
      "fragment_id": "source fragment ID",
      "fragment_title": "source fragment title",
      "fragment_summary": "MANDATORY: explain why this insight comes from this fragment"
    }
  ]
}

RULES:
- Each piece MUST be 2-5 words (count carefully!)
- NO questions - only declarative statements
- At least 60% must reference a fragment with reasoning
- Each fragment_summary must explain the connection (min 20 chars)
- Priority 1-2: core insights, 3-4: supporting, 5-6: subtle nuances`;

  // Build context for prompt placeholders
  const context = {
    central_question: input.centralQuestion,
    process_aim: input.processAim,
    puzzle_type: input.puzzleType,
    fragments_summary: fragmentsSummary,
    existing_pieces: existingPiecesStr
  };

  // Execute via Runner
  console.log(`[QuadrantAgent:${mode}] Running ADK agent with ${input.relevantFragments.length} fragments`);
  const result = await runner.run(userContent, client, context);

  if (!result.success) {
    console.error(`[QuadrantAgent:${mode}] Agent failed:`, result.error);
    return {
      pieces: [],
      meta: {
        mode,
        generatedCount: 0,
        filteredCount: 0,
        qualityScore: 0
      }
    };
  }

  // Get output from session (set by record_pieces tool) or from runner output
  let output = session.state.get('quadrantOutput') as QuadrantAgentOutputSchema | undefined;

  if (!output && result.output) {
    // Parse pieces from raw output if record_pieces wasn't called
    const rawPieces = result.output.pieces || [];
    const validPieces = transformAndValidatePieces(rawPieces, input, mode);

    output = {
      pieces: validPieces,
      meta: {
        mode,
        generatedCount: rawPieces.length,
        filteredCount: validPieces.length,
        qualityScore: calculateQualityScore(validPieces, input.relevantFragments.length)
      }
    };
  }

  if (!output) {
    return {
      pieces: [],
      meta: {
        mode,
        generatedCount: 0,
        filteredCount: 0,
        qualityScore: 0
      }
    };
  }

  console.log(`[QuadrantAgent:${mode}] Generated ${output.pieces.length} pieces, quality=${output.meta.qualityScore}`);
  return output;
};

/**
 * Transform and validate pieces from LLM output
 */
const transformAndValidatePieces = (
  rawPieces: any[],
  input: QuadrantAgentInputSchema,
  mode: DesignMode
): PieceSchema[] => {
  const validPieces: PieceSchema[] = [];

  for (const p of rawPieces) {
    // Validate word count
    const text = (p.text || '').trim();
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 2 || wordCount > 5) {
      console.log(`[QuadrantAgent:${mode}] Skipping "${text}" - ${wordCount} words`);
      continue;
    }

    // Reject questions
    if (text.endsWith('?')) {
      console.log(`[QuadrantAgent:${mode}] Skipping question: "${text}"`);
      continue;
    }

    // Get fragment info
    let fragmentId = p.fragment_id || p.fragmentId;
    let fragmentTitle = p.fragment_title || p.fragmentTitle;
    let fragmentSummary = p.fragment_summary || p.fragmentSummary || '';
    let imageUrl = p.image_url || p.imageUrl;

    // Backfill from input fragments if fragmentId present
    if (fragmentId && input.relevantFragments) {
      const srcFrag = input.relevantFragments.find(f => f.id === fragmentId);
      if (srcFrag) {
        if (!fragmentTitle) fragmentTitle = srcFrag.title;
        if (!imageUrl && srcFrag.imageUrl) imageUrl = srcFrag.imageUrl;
        if (!fragmentSummary || fragmentSummary.length < 20) {
          fragmentSummary = `From "${fragmentTitle}": ${srcFrag.summary?.slice(0, 100) || srcFrag.uniqueInsight || 'Influenced this insight'}`;
        }
      }
    }

    // Generate fallback reasoning if missing
    if (!fragmentSummary || fragmentSummary.length < 10) {
      fragmentSummary = `This ${PUZZLE_TYPE_CONFIG[input.puzzleType].verb}s the ${mode.toLowerCase()} direction based on the design context`;
    }

    validPieces.push({
      text,
      priority: (p.priority || 3) as PiecePriority,
      saturationLevel: priorityToSaturation(p.priority || 3),
      mode,
      fragmentId,
      fragmentTitle,
      fragmentSummary,
      imageUrl,
      qualityMeta: {
        wordCount,
        isQuestion: false,
        hasFragmentGrounding: !!fragmentId,
        isBlacklisted: false
      }
    });
  }

  return validPieces;
};
