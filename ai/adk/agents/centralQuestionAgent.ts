/**
 * Central Question Agent - ADK LlmAgent for generating puzzle central questions
 *
 * Features:
 * - Feature-grounded prompt (keywords, themes from fragments)
 * - Validation tool (length, open-ended check)
 * - Dedup check against previous puzzles
 * - Retry on validation failure
 */

import {
  LlmAgent,
  Runner,
  SimpleSession,
  SimpleFunctionTool as FunctionTool,
  ToolContext
} from "../types/adkTypes";
import { PuzzleType, Fragment } from "../../../domain/models";
import { FragmentFeatureSchema } from "../schemas/puzzleSchemas";

// ========== Output Schema ==========

const QUESTION_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    question: {
      type: 'string',
      description: 'The central question (10-15 words)'
    },
    reasoning: {
      type: 'string',
      description: 'Why this question captures the design challenge'
    },
    keyThemes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Key themes this question addresses'
    }
  },
  required: ['question', 'reasoning']
};

// ========== Validation Tool ==========

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  suggestions: string[];
}

const validateQuestion = async (
  params: { question: string; processAim: string },
  context: ToolContext
): Promise<ValidationResult> => {
  const errors: string[] = [];
  const suggestions: string[] = [];
  const question = params.question.trim();

  // Check length (10-15 words)
  const wordCount = question.split(/\s+/).length;
  if (wordCount < 8) {
    errors.push(`Too short: ${wordCount} words (need 10-15)`);
    suggestions.push('Add more context or specificity');
  } else if (wordCount > 18) {
    errors.push(`Too long: ${wordCount} words (need 10-15)`);
    suggestions.push('Focus on the core question');
  }

  // Must be a question
  if (!question.endsWith('?')) {
    errors.push('Must end with a question mark');
    suggestions.push('Rephrase as an open-ended question');
  }

  // Should be open-ended (not yes/no)
  const closedPatterns = [
    /^(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\s/i,
    /^(isn't|aren't|wasn't|weren't|don't|doesn't|didn't|can't|couldn't|won't|wouldn't|shouldn't|hasn't|haven't|hadn't)\s/i
  ];
  for (const pattern of closedPatterns) {
    if (pattern.test(question)) {
      errors.push('Question appears closed-ended (yes/no)');
      suggestions.push('Start with "How", "What", "Why", or "In what ways"');
      break;
    }
  }

  // Should relate to design/process aim
  const aimWords = params.processAim.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const questionLower = question.toLowerCase();
  const aimMatches = aimWords.filter(w => questionLower.includes(w));
  if (aimMatches.length === 0 && aimWords.length > 0) {
    suggestions.push(`Consider incorporating theme from aim: "${aimWords.slice(0, 3).join(', ')}"`);
  }

  // Store validation result in session
  const session = context.invocationContext.session;
  session.state.set('questionValidation', { isValid: errors.length === 0, errors, suggestions });

  return {
    isValid: errors.length === 0,
    errors,
    suggestions
  };
};

const createValidateQuestionTool = (): FunctionTool => {
  return new FunctionTool({
    name: 'validate_question',
    description: 'Validate a central question for length, format, and quality',
    fn: validateQuestion,
    functionDeclaration: {
      name: 'validate_question',
      description: 'Check if question meets requirements',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'The question to validate' },
          processAim: { type: 'string', description: 'The process aim for relevance check' }
        },
        required: ['question', 'processAim']
      }
    }
  });
};

// ========== Dedup Tool ==========

const checkDuplicate = async (
  params: { question: string; previousQuestions: string[] },
  context: ToolContext
): Promise<{ isDuplicate: boolean; similarTo?: string }> => {
  const newQ = params.question.toLowerCase();

  for (const prevQ of params.previousQuestions) {
    const prevLower = prevQ.toLowerCase();

    // Exact match
    if (newQ === prevLower) {
      return { isDuplicate: true, similarTo: prevQ };
    }

    // High word overlap (>70%)
    const newWords = new Set(newQ.split(/\s+/).filter(w => w.length > 3));
    const prevWords = prevLower.split(/\s+/).filter(w => w.length > 3);
    const matches = prevWords.filter(w => newWords.has(w));
    if (prevWords.length > 0 && matches.length / prevWords.length > 0.7) {
      return { isDuplicate: true, similarTo: prevQ };
    }
  }

  return { isDuplicate: false };
};

const createCheckDuplicateTool = (): FunctionTool => {
  return new FunctionTool({
    name: 'check_duplicate',
    description: 'Check if question is too similar to previous puzzles',
    fn: checkDuplicate,
    functionDeclaration: {
      name: 'check_duplicate',
      description: 'Dedup check against previous questions',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          previousQuestions: { type: 'array', items: { type: 'string' } }
        },
        required: ['question', 'previousQuestions']
      }
    }
  });
};

// ========== Agent Factory ==========

const buildCentralQuestionInstruction = (puzzleType: PuzzleType): string => {
  const typeGuidance: Record<PuzzleType, string> = {
    CLARIFY: 'Focus on making vague concepts concrete. Ask what something IS or MEANS.',
    EXPAND: 'Focus on exploring new possibilities. Ask about fresh perspectives or alternatives.',
    REFINE: 'Focus on prioritization and commitment. Ask what is essential or what to choose.'
  };

  return `You are a Central Question Generator for a design thinking puzzle app.

=== YOUR ROLE ===
Generate a single, compelling central question that will guide the design exploration.
The question should capture the core design challenge based on the fragments provided.

=== PUZZLE TYPE: ${puzzleType} ===
${typeGuidance[puzzleType]}

=== REQUIREMENTS ===
1. LENGTH: 10-15 words (not shorter, not longer)
2. FORMAT: Must be a question ending with "?"
3. OPEN-ENDED: Start with "How", "What", "Why", or "In what ways" - NOT yes/no questions
4. GROUNDED: Draw from the fragment themes and keywords provided
5. INSPIRING: Should spark creative exploration across all four quadrants (Form, Motion, Expression, Function)

=== GOOD EXAMPLES (structure, not content) ===
- "How might we balance playful interaction with professional credibility in the interface?"
- "What visual language best captures both innovation and trustworthiness for users?"
- "In what ways can motion design reinforce the core emotional journey?"

=== BAD EXAMPLES (avoid) ===
- "What is the design?" (too vague)
- "Should we use blue?" (yes/no, too specific)
- "How can we make it better?" (too generic)
- Questions longer than 15 words

Return your response as JSON with "question" and "reasoning" fields.`;
};

export interface CentralQuestionInput {
  processAim: string;
  puzzleType: PuzzleType;
  fragments: Fragment[];
  fragmentFeatures?: FragmentFeatureSchema[];
  previousQuestions?: string[];
}

export interface CentralQuestionOutput {
  question: string;
  reasoning: string;
  keyThemes: string[];
  isValid: boolean;
  retryCount: number;
}

/**
 * Run Central Question Agent with validation and retry
 */
export const runCentralQuestionAgent = async (
  input: CentralQuestionInput,
  client: { generate: (prompt: string, temperature?: number) => Promise<string> }
): Promise<CentralQuestionOutput> => {
  const maxRetries = 2;
  let retryCount = 0;

  // Build feature summary from fragments
  const featureSummary = buildFeatureSummary(input.fragments, input.fragmentFeatures);

  // Create session
  const session = new SimpleSession({
    id: `central_question_${Date.now()}`,
    appName: 'puzzle_app',
    userId: 'user',
    state: {
      processAim: input.processAim,
      previousQuestions: input.previousQuestions || []
    }
  });

  // Create agent
  const agent = new LlmAgent({
    name: 'central_question',
    model: 'gemini-2.0-flash',
    description: 'Generate central questions for design puzzles',
    instruction: buildCentralQuestionInstruction(input.puzzleType),
    outputSchema: QUESTION_OUTPUT_SCHEMA,
    tools: [createValidateQuestionTool(), createCheckDuplicateTool()],
    generateContentConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 512
    }
  });

  const runner = new Runner({ agent, session });

  // Build user content
  const userContent = `Generate a central question for this design puzzle.

PROCESS AIM: "${input.processAim}"
PUZZLE TYPE: ${input.puzzleType}

FRAGMENT INSIGHTS:
${featureSummary}

${input.previousQuestions && input.previousQuestions.length > 0
    ? `PREVIOUS QUESTIONS (avoid similarity):\n${input.previousQuestions.map(q => `- "${q}"`).join('\n')}`
    : ''}

Generate the central question as JSON: { "question": "...", "reasoning": "...", "keyThemes": [...] }`;

  while (retryCount <= maxRetries) {
    const result = await runner.run(userContent, client, {});

    if (!result.success) {
      console.error('[CentralQuestionAgent] Generation failed:', result.error);
      retryCount++;
      continue;
    }

    const output = result.output;
    if (!output || !output.question) {
      console.warn('[CentralQuestionAgent] No question in output, retrying');
      retryCount++;
      continue;
    }

    // Validate the question
    const toolContext: ToolContext = {
      invocationContext: {
        session,
        incrementLlmCallCount: () => {}
      }
    };

    const validation = await validateQuestion(
      { question: output.question, processAim: input.processAim },
      toolContext
    );

    if (!validation.isValid) {
      console.log(`[CentralQuestionAgent] Validation failed: ${validation.errors.join(', ')}`);
      retryCount++;

      // Add feedback for next attempt
      session.state.set('lastErrors', validation.errors);
      session.state.set('lastSuggestions', validation.suggestions);
      continue;
    }

    // Check for duplicates
    const dupCheck = await checkDuplicate(
      { question: output.question, previousQuestions: input.previousQuestions || [] },
      toolContext
    );

    if (dupCheck.isDuplicate) {
      console.log(`[CentralQuestionAgent] Duplicate detected, similar to: ${dupCheck.similarTo}`);
      retryCount++;
      continue;
    }

    // Success!
    console.log(`[CentralQuestionAgent] Generated: "${output.question}"`);
    return {
      question: output.question,
      reasoning: output.reasoning || '',
      keyThemes: output.keyThemes || [],
      isValid: true,
      retryCount
    };
  }

  // Fallback question
  console.warn('[CentralQuestionAgent] Max retries exceeded, using fallback');
  return {
    question: `What is the core design direction for ${input.processAim.split(' ').slice(0, 3).join(' ')}?`,
    reasoning: 'Fallback question after validation failures',
    keyThemes: [],
    isValid: false,
    retryCount
  };
};

/**
 * Build feature summary from fragments
 */
const buildFeatureSummary = (
  fragments: Fragment[],
  features?: FragmentFeatureSchema[]
): string => {
  const lines: string[] = [];
  const allKeywords = new Set<string>();
  const allThemes = new Set<string>();

  for (let i = 0; i < Math.min(fragments.length, 6); i++) {
    const f = fragments[i];
    const feat = features?.find(ft => ft.fragmentId === f.id);

    // Collect keywords/themes
    feat?.keywords?.forEach(k => allKeywords.add(k));
    feat?.themes?.forEach(t => allThemes.add(t));

    const title = f.title || f.summary?.slice(0, 30) || 'Fragment';
    const insight = feat?.uniqueInsight || f.summary?.slice(0, 80) || '';

    if (f.type === 'IMAGE') {
      lines.push(`- [IMAGE] "${title}": ${feat?.mood || 'Visual reference'}${insight ? ` - ${insight}` : ''}`);
    } else {
      lines.push(`- "${title}": ${insight || f.summary?.slice(0, 80) || 'No summary'}`);
    }
  }

  const keywordStr = Array.from(allKeywords).slice(0, 10).join(', ');
  const themeStr = Array.from(allThemes).slice(0, 5).join(', ');

  return `
FRAGMENTS:
${lines.join('\n')}

KEY THEMES: ${themeStr || 'Not extracted'}
KEYWORDS: ${keywordStr || 'Not extracted'}
`.trim();
};

export default {
  runCentralQuestionAgent
};
