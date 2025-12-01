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

// ========== Statement Examples (Good vs Bad) ==========

/**
 * Examples to guide AI to generate STATEMENTS, not questions
 */
export const STATEMENT_EXAMPLES = {
  bad: [
    "How does the digital experience reflect the awakening?",
    "What's the dominant visual weight - heavy or light?",
    "Should transitions feel instant or gradual?",
    "Which emotions best describe what you want?",
  ],
  good: [
    "Digital experience as gentle awakening",
    "Light visual weight with breathing space",
    "Gradual transitions creating calm flow",
    "Warmth balanced with professional clarity",
    "Minimalist form language",
    "Organic curves over sharp geometry",
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

// ========== Mode-Specific Statement Examples ==========

const MODE_STATEMENT_EXAMPLES: Record<PuzzleType, Record<DesignMode, string[]>> = {
  CLARIFY: {
    FORM: [
      "Geometric foundation with organic accents",
      "Light visual weight, airy composition",
      "Card-based layout with generous whitespace",
    ],
    MOTION: [
      "Slow, deliberate transitions (300ms+)",
      "Ease-out curves for natural deceleration",
      "Minimal motion, content-focused",
    ],
    EXPRESSION: [
      "Calm confidence, not excitement",
      "Professional warmth without corporate coldness",
      "Understated premium quality",
    ],
    FUNCTION: [
      "Mobile-first, desktop-enhanced",
      "Primary audience: creative professionals",
      "Quick task completion as core value",
    ],
  },
  EXPAND: {
    FORM: [
      "Glass morphism as depth metaphor",
      "Asymmetric balance creating visual tension",
      "Layered transparency revealing structure",
    ],
    MOTION: [
      "Breathing animations for living interface",
      "Staggered reveals building anticipation",
      "Physics-based spring animations",
    ],
    EXPRESSION: [
      "Playful moments within serious context",
      "Unexpected delight in routine interactions",
      "Nostalgic references to analog tools",
    ],
    FUNCTION: [
      "Offline-first for unreliable connections",
      "Voice control as alternative input",
      "Integration with existing workflow tools",
    ],
  },
  REFINE: {
    FORM: [
      "Rounded corners (8px) as signature element",
      "Two-column layout as primary structure",
      "Blue-gray palette as final direction",
    ],
    MOTION: [
      "Fade transitions only, no sliding",
      "200ms duration as standard timing",
      "Loading states over skeletons",
    ],
    EXPRESSION: [
      "Helpful guide over neutral tool",
      "Encouraging tone in empty states",
      "Subtle celebration of milestones",
    ],
    FUNCTION: [
      "Search as primary navigation pattern",
      "Three-step wizard for onboarding",
      "Export to PDF as must-have feature",
    ],
  },
};

// ========== Build Prompt ==========

export const buildQuadrantPrompt = (input: QuadrantAgentInput): string => {
  const modeInfo = MODE_DESCRIPTIONS[input.mode];
  const puzzleInfo = PUZZLE_TYPE_INSTRUCTIONS[input.puzzle_type];
  const examples = MODE_STATEMENT_EXAMPLES[input.puzzle_type][input.mode];

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

=== CRITICAL RULE ===
Generate SHORT STATEMENTS, NOT questions.
Each piece is an INSIGHT or ANSWER, not a prompt.
NEVER end with a question mark (?).

BAD examples (DO NOT generate):
${STATEMENT_EXAMPLES.bad.map((b) => `  ✗ "${b}"`).join("\n")}

GOOD examples (follow this style):
${STATEMENT_EXAMPLES.good.map((g) => `  ✓ "${g}"`).join("\n")}

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

Examples for ${input.puzzle_type} ${input.mode}:
${examples.map((e, i) => `  ${i + 1}. "${e}"`).join("\n")}

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

CRITICAL - FRAGMENT CITATION REQUIREMENTS:
1. saturation_level: "high" for priority 1-2, "medium" for 3-4, "low" for 5-6
2. You MUST cite source fragments when your insight is influenced by them:
   - fragment_id: Copy the exact ID from the fragments list above
   - fragment_title: Copy the exact title from the fragments list
   - fragment_summary: 1 sentence explaining HOW this fragment influenced your insight
3. For IMAGE fragments, also include image_url with the URL from the fragment
4. If no specific fragment influenced an insight, you may omit the fragment fields
5. At least 50% of your pieces should cite relevant fragments when fragments are provided`;
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

    // Validate and fix saturation levels
    const pieces = parsed.pieces.map((p) => ({
      ...p,
      saturation_level: priorityToSaturation(p.priority as PiecePriority),
    }));

    // Filter out any pieces that end with ?
    const validPieces = pieces.filter((p) => !p.text.trim().endsWith("?"));

    if (validPieces.length === 0) {
      // Fallback if all pieces were questions
      return getFallbackOutput(input);
    }

    return { pieces: validPieces };
  } catch (error) {
    console.error(`[${input.mode}QuadrantAgent] Error:`, error);
    return getFallbackOutput(input);
  }
};

// ========== Fallback ==========

const getFallbackOutput = (input: QuadrantAgentInput): QuadrantAgentOutput => {
  const examples = MODE_STATEMENT_EXAMPLES[input.puzzle_type][input.mode];
  const fallbackPieces: QuadrantAgentPiece[] = [
    { text: examples[0] || "Core insight", priority: 2, saturation_level: "high" },
    { text: examples[1] || "Supporting detail", priority: 4, saturation_level: "medium" },
  ];
  return { pieces: fallbackPieces };
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
