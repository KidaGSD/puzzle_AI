/**
 * Base Quadrant Agent - Shared schema and prompt template for all 4 quadrant agents
 *
 * KEY CONSTRAINT: Generates STATEMENTS (陈述式), NOT questions.
 * Each piece is a short insight/answer, not a prompt to the user.
 */

import {
  DesignMode,
  PuzzleType,
  QuadrantAgentInput,
  QuadrantAgentOutput,
  QuadrantAgentPiece,
  PiecePriority,
  SaturationLevel,
} from "../../domain/models";
import { LLMClient } from "../adkClient";
import { priorityToSaturation } from "../../constants/colors";
import {
  filterValidPieces,
  calculateQualityScore,
  isBlacklistedPhrase,
} from "./outputValidation";

// ========== Mode Descriptions ==========

export const MODE_DESCRIPTIONS: Record<DesignMode, { focus: string; aspects: string[] }> = {
  FORM: {
    focus: "Visual structure, shape, composition, spatial relationships",
    aspects: ["geometric vs organic", "visual weight", "layering", "proportion", "texture"],
  },
  MOTION: {
    focus: "Movement, animation, transitions, rhythm, timing",
    aspects: ["speed & pacing", "easing curves", "entrance/exit", "micro-interactions", "flow"],
  },
  EXPRESSION: {
    focus: "Emotional tone, personality, brand voice, atmosphere",
    aspects: ["mood", "voice & tone", "warmth vs cool", "premium vs accessible", "energy level"],
  },
  FUNCTION: {
    focus: "Purpose, utility, user value, practical constraints",
    aspects: ["primary use case", "target audience", "accessibility", "platform", "constraints"],
  },
};

// ========== Statement Format Guide ==========

/**
 * Format guidance for AI - shows what FORMAT to follow
 * NOTE: These demonstrate structure, NOT content to copy
 * Actual content must come from analyzing user's fragments
 */
export const STATEMENT_FORMAT_GUIDE = {
  // Questions are WRONG format - never generate these
  badFormat: [
    "How does X work?",
    "What's the Y?",
    "Should we Z?",
    "Which option?",
  ],
  // These patterns show the FORMAT - 2-5 word declarative statements
  // DO NOT copy these words - generate your own from fragment content
  formatPatterns: [
    "2 words: Adjective + Noun",
    "3 words: Noun + Preposition + Noun",
    "4 words: Adjective + Noun + Verb + Noun",
    "5 words: Noun + As + Adjective + Noun + Noun",
  ],
};

// ========== Puzzle Type Specific Instructions ==========

const PUZZLE_TYPE_INSTRUCTIONS: Record<PuzzleType, { verb: string; guidance: string }> = {
  CLARIFY: {
    verb: "clarify",
    guidance: "Make vague concepts concrete. State what IS, not what to explore.",
  },
  EXPAND: {
    verb: "expand",
    guidance: "Introduce fresh perspectives. State new angles and possibilities.",
  },
  REFINE: {
    verb: "refine",
    guidance: "Help prioritize. State what's essential and what to commit to.",
  },
};

// ========== Removed Hardcoded Examples ==========
// NOTE: Hardcoded MODE_STATEMENT_EXAMPLES were REMOVED because:
// 1. AI was copying them verbatim instead of reasoning from fragments
// 2. "Glass Morphism as Metaphor" appearing in outputs was from these examples
// 3. Real insights must come from analyzing fragment content, not examples
//
// Now the AI MUST derive insights from the actual fragments provided.

// ========== Build Prompt ==========

export const buildQuadrantPrompt = (input: QuadrantAgentInput): string => {
  const modeInfo = MODE_DESCRIPTIONS[input.mode];
  const puzzleInfo = PUZZLE_TYPE_INSTRUCTIONS[input.puzzle_type];

  // Build fragment context with IDs for referencing
  let fragmentSection = "";
  if (input.relevant_fragments.length > 0) {
    fragmentSection = `\n=== CANVAS FRAGMENTS (cite these in your output!) ===\n${input.relevant_fragments
      .slice(0, 5)
      .map((f, i) => {
        const isImage = f.imageUrl ? true : false;
        if (isImage) {
          return `  ${i + 1}. [IMAGE] ID: "${f.id}" | Title: "${f.title}" | Description: "${f.summary}" | ImageURL: "${f.imageUrl}"`;
        }
        return `  ${i + 1}. ID: "${f.id}" | Title: "${f.title}" | Summary: "${f.summary}" [${f.tags?.join(", ") || "no tags"}]`;
      })
      .join("\n")}`;
  }

  // Build existing pieces context
  let existingSection = "";
  if (input.existing_pieces.length > 0) {
    existingSection = `\nExisting ${input.mode} pieces (avoid duplicates):\n${input.existing_pieces
      .map((p) => `  - "${p.text}" (priority ${p.priority})`)
      .join("\n")}`;
  }

  return `You are the ${input.mode} Quadrant Agent for a design thinking puzzle app.

=== CRITICAL RULE #1: TITLE LENGTH (MANDATORY) ===
EVERY piece title MUST be EXACTLY 2-5 WORDS. COUNT THE WORDS BEFORE OUTPUTTING.

WORD COUNT EXAMPLES:
  ✓ "Warm analog textures" = 3 words (VALID)
  ✓ "Organic minimalism" = 2 words (VALID)
  ✓ "Mobile-first responsive design" = 3 words (VALID)
  ✓ "Calm confident presence" = 3 words (VALID)
  ✗ "Earthy elegance meets modern simplicity" = 5+ words (TOO LONG - REJECT)
  ✗ "Clean minimalist approach with organic elements" = 6 words (TOO LONG - REJECT)
  ✗ "Warmth" = 1 word (TOO SHORT - REJECT)

=== CRITICAL RULE #2: STATEMENTS ONLY ===
Generate SHORT STATEMENTS, NOT questions.
Each piece is an INSIGHT or ANSWER, not a prompt.
NEVER end with a question mark (?).

BAD FORMAT (questions - do NOT generate):
${STATEMENT_FORMAT_GUIDE.badFormat.map((b) => `  ✗ "${b}"`).join("\n")}

GOOD FORMAT (declarative statements - 2-5 words):
${STATEMENT_FORMAT_GUIDE.formatPatterns.map((p) => `  Pattern: ${p}`).join("\n")}

Generate YOUR OWN statements based on fragment content. Do NOT copy any examples.

=== CONTEXT ===
Puzzle type: ${input.puzzle_type} (${puzzleInfo.guidance})
Mode: ${input.mode} - ${modeInfo.focus}
Aspects to consider: ${modeInfo.aspects.join(", ")}
Central question: ${input.central_question}
Process aim: ${input.process_aim}
Anchors: ${input.anchors.map((a) => `${a.type}: ${a.text}`).join(" | ") || "none"}
${fragmentSection}
${existingSection}
${input.preference_hints ? `\nPreference hints: ${input.preference_hints}` : ""}

=== TASK ===
Generate ${input.requested_count} pieces for the ${input.mode} quadrant.
Total characters across all pieces: max ${input.max_total_chars}.

Priority assignment:
- Priority 1-2: Core insights (anchor to central question, placed closest to center)
- Priority 3-4: Supporting insights (expand on core ideas)
- Priority 5-6: Subtle/detailed insights (nuances, placed further out)

⚠️ CRITICAL: EVERY piece MUST derive from the fragments above.
DO NOT invent generic design advice. Extract SPECIFIC insights from the fragment content.
If analyzing an image fragment, describe what you observe (colors, shapes, mood, objects).
If analyzing text, pull out key concepts and terminology the user provided.

=== OUTPUT FORMAT ===
Return ONLY valid JSON:
{
  "pieces": [
    {
      "text": "Your short statement here",
      "priority": 1,
      "saturation_level": "high",
      "fragment_id": "frag-123",
      "fragment_title": "Brand Color Analysis",
      "fragment_summary": "The warm earth tones in this fragment suggest organic, grounded aesthetics",
      "image_url": "https://example.com/image.jpg"
    },
    {
      "text": "Another insight",
      "priority": 3,
      "saturation_level": "medium",
      "fragment_id": "frag-456",
      "fragment_title": "Typography Reference",
      "fragment_summary": "The serif fonts in this fragment convey traditional elegance"
    },
    ...
  ]
}

═══════════════════════════════════════════════════════════════════════════════
⚠️ CRITICAL - REASONING REQUIREMENTS (MANDATORY FOR EVERY PIECE):
═══════════════════════════════════════════════════════════════════════════════

RULE: EVERY piece MUST have a "fragment_summary" field with your reasoning.
This is MANDATORY even if no fragment influenced the piece.

1. saturation_level: "high" for priority 1-2, "medium" for 3-4, "low" for 5-6

2. IF a fragment influenced this insight:
   - fragment_id: Copy the EXACT ID from the fragments list above
   - fragment_title: Copy the EXACT title from the fragments list
   - fragment_summary: REQUIRED - "The [specific element] in this fragment suggests [your reasoning]"
   - image_url: If IMAGE fragment, include the URL

3. IF no fragment influenced this insight:
   - fragment_summary: REQUIRED - "Based on the ${input.puzzle_type} goal, this explores [your reasoning]"
   - Do NOT include fragment_id or fragment_title

4. AT LEAST 60% of pieces should cite a fragment (when fragments are provided)

EXAMPLE WITH FRAGMENT (shows fragment_id, fragment_title, AND fragment_summary):
{
  "text": "Warm analog textures",
  "priority": 2,
  "saturation_level": "high",
  "fragment_id": "frag-123",
  "fragment_title": "Brand Color Palette",
  "fragment_summary": "The earthy browns and greens in this mood board suggest natural warmth"
}

EXAMPLE WITHOUT FRAGMENT (still has fragment_summary with reasoning!):
{
  "text": "Clean minimalist lines",
  "priority": 4,
  "saturation_level": "medium",
  "fragment_summary": "Based on the ${input.puzzle_type} goal, this explores contrast to existing organic themes"
}

⚠️ PIECES WITHOUT fragment_summary WILL BE REJECTED`;
};

// ========== Fallback Reasoning Generator ==========

/**
 * Generate fallback reasoning for pieces that don't have fragment_summary
 */
const generateFallbackReasoning = (
  puzzleType: PuzzleType,
  mode: DesignMode,
  pieceText: string,
  fragments: Array<{ id: string; title: string; summary?: string }>,
  fragmentId?: string
): string => {
  // If piece has fragment reference, look it up and generate reasoning
  if (fragmentId) {
    const frag = fragments.find(f => f.id === fragmentId);
    if (frag) {
      return `Inspired by "${frag.title}" - this fragment's content suggested this ${mode.toLowerCase()} direction`;
    }
  }

  // Generate reasoning based on puzzle type
  const typeVerb: Record<PuzzleType, string> = {
    CLARIFY: 'clarifies',
    EXPAND: 'explores new angles for',
    REFINE: 'helps narrow down',
  };

  const modeAspect: Record<DesignMode, string> = {
    FORM: 'visual structure',
    MOTION: 'movement and timing',
    EXPRESSION: 'emotional tone',
    FUNCTION: 'practical application',
  };

  return `This ${typeVerb[puzzleType]} the ${modeAspect[mode]} by suggesting "${pieceText}" as a direction`;
};

// ========== Title Length Validation ==========

/**
 * Truncate title to max 5 words while preserving meaning
 */
const truncateTitle = (text: string, maxWords: number = 5): string => {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;

  // Take first maxWords words
  const truncated = words.slice(0, maxWords).join(" ");
  console.log(`[QuadrantAgent] Truncated title: "${text}" → "${truncated}"`);
  return truncated;
};

/**
 * Ensure title is at least 2 words
 */
const padTitle = (text: string, mode: string): string => {
  const words = text.trim().split(/\s+/);
  if (words.length >= 2) return text;

  // Add a generic qualifier based on mode if only 1 word
  const qualifiers: Record<string, string> = {
    FORM: "approach",
    MOTION: "flow",
    EXPRESSION: "feel",
    FUNCTION: "focus",
  };
  return `${text} ${qualifiers[mode] || "insight"}`;
};

// ========== Run Agent ==========

export const runQuadrantAgent = async (
  input: QuadrantAgentInput,
  client: LLMClient
): Promise<QuadrantAgentOutput> => {
  try {
    const prompt = buildQuadrantPrompt(input);
    const raw = await client.generate(prompt, 0.7);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as QuadrantAgentOutput;

    // Validate and fix saturation levels + title length + ensure reasoning exists
    const pieces = parsed.pieces.map((p) => {
      // Enforce 2-5 word title length
      let title = truncateTitle(p.text, 5);
      title = padTitle(title, input.mode);

      // CRITICAL: Accept both snake_case (AI output) and camelCase (interface)
      let fragmentId = p.fragment_id || (p as any).fragmentId;
      let fragmentTitle = p.fragment_title || (p as any).fragmentTitle;
      let fragmentSummary = p.fragment_summary || (p as any).fragmentSummary;
      let imageUrl = p.image_url || (p as any).imageUrl;

      // ═══════════════════════════════════════════════════════════════════════
      // FORCED BACKFILL: If fragment_id exists, ensure all fields are populated
      // This prevents blank preview popups when AI omits some fields
      // ═══════════════════════════════════════════════════════════════════════
      if (fragmentId) {
        const sourceFrag = input.relevant_fragments.find(f => f.id === fragmentId);
        console.log(`[QuadrantAgent] Looking up fragment ${fragmentId}, found:`, sourceFrag ? {
          id: sourceFrag.id,
          type: sourceFrag.type,
          title: sourceFrag.title,
          hasImageUrl: !!sourceFrag.imageUrl,
          imageUrl: sourceFrag.imageUrl?.slice(0, 50),
        } : 'NOT FOUND');

        if (sourceFrag) {
          // Backfill missing title
          if (!fragmentTitle) {
            fragmentTitle = sourceFrag.title || sourceFrag.summary?.slice(0, 30) || "Fragment";
            console.log(`[QuadrantAgent] Backfilled fragment_title for ${fragmentId}: "${fragmentTitle}"`);
          }
          // Backfill missing imageUrl for IMAGE fragments
          // Check both imageUrl field and if type is IMAGE
          if (!imageUrl) {
            if (sourceFrag.imageUrl) {
              imageUrl = sourceFrag.imageUrl;
              console.log(`[QuadrantAgent] Backfilled image_url from imageUrl field for ${fragmentId}`);
            } else if (sourceFrag.type === 'IMAGE') {
              // For IMAGE type fragments, the summary might contain the URL (legacy format)
              console.log(`[QuadrantAgent] Fragment ${fragmentId} is IMAGE type but no imageUrl field found. Type: ${sourceFrag.type}`);
            }
          }
          // Backfill missing summary
          if (!fragmentSummary) {
            fragmentSummary = `From "${fragmentTitle}": ${sourceFrag.summary?.slice(0, 100) || "This fragment influenced this insight"}`;
            console.log(`[QuadrantAgent] Backfilled fragment_summary for ${fragmentId}`);
          }
        }
      }

      // CRITICAL: Ensure every piece has reasoning even without fragment
      if (!fragmentSummary) {
        fragmentSummary = generateFallbackReasoning(
          input.puzzle_type,
          input.mode,
          title,
          input.relevant_fragments,
          fragmentId
        );
        console.log(`[QuadrantAgent] Generated fallback reasoning for "${title}"`);
      }

      return {
        ...p,
        text: title,
        saturation_level: priorityToSaturation(p.priority as PiecePriority),
        // Normalize to snake_case for consistency
        fragment_id: fragmentId,
        fragment_title: fragmentTitle,
        fragment_summary: fragmentSummary,
        image_url: imageUrl,
      };
    });

    // Filter out any pieces that end with ?
    let validPieces = pieces.filter((p) => !p.text.trim().endsWith("?"));

    // ========== Phase 4: Output Validation ==========
    // Filter out blacklisted/generic phrases and validate fragment grounding
    validPieces = validPieces.filter((p) => {
      // Reject if matches known hardcoded examples
      if (isBlacklistedPhrase(p.text)) {
        console.warn(`[${input.mode}QuadrantAgent] Rejected blacklisted phrase: "${p.text}"`);
        return false;
      }
      return true;
    });

    // Run full validation and log quality score
    const filteredPieces = filterValidPieces(validPieces, input.relevant_fragments, input.mode);
    const qualityScore = calculateQualityScore(filteredPieces, input.relevant_fragments);
    console.log(`[${input.mode}QuadrantAgent] Quality score: ${qualityScore}/100, pieces: ${filteredPieces.length}`);

    if (filteredPieces.length === 0) {
      // Fallback if all pieces were filtered out
      console.warn(`[${input.mode}QuadrantAgent] All pieces filtered, using fallback`);
      return getFallbackOutput(input);
    }

    return { pieces: filteredPieces };
  } catch (error) {
    console.error(`[${input.mode}QuadrantAgent] Error:`, error);
    return getFallbackOutput(input);
  }
};

// ========== Fallback ==========

/**
 * Generate fallback output when AI fails - uses ACTUAL fragment content
 * instead of hardcoded examples
 */
const getFallbackOutput = (input: QuadrantAgentInput): QuadrantAgentOutput => {
  const fragments = input.relevant_fragments;
  const modeAspect = MODE_DESCRIPTIONS[input.mode];

  // Try to extract real content from fragments
  const pieces: QuadrantAgentPiece[] = [];

  if (fragments.length > 0) {
    // Use fragment titles/summaries to create fragment-grounded pieces
    fragments.slice(0, 2).forEach((frag, index) => {
      const title = frag.title || "Reference";
      const summary = frag.summary || "";
      const isImage = !!frag.imageUrl;

      // Create a piece title from fragment content
      const pieceText = isImage
        ? `Visual: ${title.slice(0, 30)}`
        : summary.length > 0
          ? `${summary.split(/[.!?]/)[0].trim().slice(0, 40)}...`
          : `Explore ${title}`;

      // Truncate to 2-5 words
      const words = pieceText.split(/\s+/).slice(0, 4).join(" ");

      pieces.push({
        text: words || `${input.mode.toLowerCase()} direction`,
        priority: index === 0 ? 2 : 4,
        saturation_level: index === 0 ? "high" : "medium",
        fragment_id: frag.id,
        fragment_title: title,
        fragment_summary: isImage
          ? `From image "${title}": Visual reference for ${input.mode.toLowerCase()} exploration`
          : `From "${title}": ${summary.slice(0, 80)}`,
        // CRITICAL: Include image_url for IMAGE fragments
        image_url: frag.imageUrl,
      });
    });
  }

  // If no fragments, use minimal fallback that indicates AI couldn't generate
  if (pieces.length === 0) {
    pieces.push({
      text: `Explore ${modeAspect.aspects[0] || input.mode.toLowerCase()}`,
      priority: 3,
      saturation_level: "medium",
      fragment_summary: `Fallback suggestion for ${input.mode} exploration. Add more fragments for better insights.`,
    });
  }

  return { pieces };
};

// ========== Timeout Wrapper ==========

export const runQuadrantAgentWithTimeout = async (
  input: QuadrantAgentInput,
  client: LLMClient,
  timeoutMs: number = 15000
): Promise<QuadrantAgentOutput> => {
  const timeoutPromise = new Promise<QuadrantAgentOutput>((_, reject) =>
    setTimeout(() => reject(new Error(`${input.mode} agent timed out`)), timeoutMs)
  );

  try {
    return await Promise.race([runQuadrantAgent(input, client), timeoutPromise]);
  } catch (error) {
    console.warn(`[${input.mode}QuadrantAgent] Timeout or error, using fallback`);
    return getFallbackOutput(input);
  }
};
