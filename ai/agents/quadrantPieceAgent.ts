import { DesignMode, PuzzleType, FragmentType } from "../../domain/models";
import { LLMClient } from "../adkClient";

// Fragment info passed to agent
export interface FragmentContext {
  id: string;
  type: FragmentType;
  content: string;
  summary?: string;
  tags?: string[];
}

export interface QuadrantPieceInput {
  processAim: string;
  mode: DesignMode;
  // puzzleType comes from the SESSION, not per-piece
  puzzleType: PuzzleType;
  puzzle: { id: string; centralQuestion: string; type?: PuzzleType };
  anchors: Array<{ type: string; text: string }>;
  existingPiecesForMode: Array<{
    text: string;
    userAnnotation?: string;
    status: string;
  }>;
  preferenceHint?: string;
  // Fragment context for grounding AI suggestions
  fragments?: FragmentContext[];
  // @deprecated - use puzzleType instead
  category?: PuzzleType | "CONNECT";
}

export interface QuadrantPieceOutput {
  pieces: Array<{
    mode: DesignMode;
    // ═══════════════════════════════════════════════════════════
    // PIECE TITLE (shown ON the piece - 2-5 words, 陈述式)
    // ═══════════════════════════════════════════════════════════
    text: string;
    internalNote?: string;

    // ═══════════════════════════════════════════════════════════
    // SOURCE FRAGMENT REFERENCE (for summary popup - NOT the title!)
    // ═══════════════════════════════════════════════════════════
    fragmentId?: string;           // Links to canvas fragment
    fragmentTitle?: string;        // Original title from canvas
    fragmentSummary?: string;      // AI summary of how fragment influenced this insight
    imageUrl?: string;             // If derived from image fragment

    // Priority for visual positioning and color saturation
    priority?: 1 | 2 | 3 | 4 | 5 | 6;

    // @deprecated fields kept for backwards compatibility
    category?: PuzzleType | "CONNECT";
    title?: string;
    content?: string;
  }>;
}

const buildPrompt = (input: QuadrantPieceInput) => {
  const existing = input.existingPiecesForMode.map(p => p.text).join(" | ");
  const puzzleType = input.puzzleType;

  // Build fragment context section with IDs for referencing
  let fragmentSection = "";
  const fragmentList: { id: string; title: string; summary: string }[] = [];

  if (input.fragments && input.fragments.length > 0) {
    const textFragments = input.fragments.filter(f => f.type === "TEXT");
    const imageFragments = input.fragments.filter(f => f.type === "IMAGE");

    if (textFragments.length > 0) {
      fragmentSection += `\nText fragments from canvas (can be referenced in output):\n`;
      textFragments.slice(0, 5).forEach((f, i) => {
        const title = f.summary?.slice(0, 30) || "Untitled";
        const summary = f.summary || f.content.slice(0, 100);
        fragmentSection += `  ${i + 1}. ID: "${f.id}", Title: "${title}", Summary: "${summary}"\n`;
        fragmentList.push({ id: f.id, title, summary });
      });
    }

    if (imageFragments.length > 0) {
      fragmentSection += `\nImage fragments from canvas (can be referenced in output):\n`;
      imageFragments.slice(0, 3).forEach((f, i) => {
        const title = f.summary?.slice(0, 30) || "Image";
        fragmentSection += `  ${i + 1}. ID: "${f.id}", Title: "${title}", Description: "${f.summary || 'Image'}"\n`;
        fragmentList.push({ id: f.id, title, summary: f.summary || "Image" });
      });
    }
  }

  return `You are the Quadrant Piece Agent for a design thinking puzzle app.

=== CRITICAL REQUIREMENTS ===

1. PIECE TITLE (text field):
   - MUST be 2-5 words ONLY (not more, not fewer)
   - MUST be 陈述式 (declarative statement), NOT a question
   - NEVER end with a question mark (?)

   BAD (do NOT generate):
     ✗ "How does the visual layout reinforce gentle awakening?" (question)
     ✗ "What's the dominant visual weight?" (question)
     ✗ "The design should incorporate warm analog textures" (too long - 8 words)
     ✗ "Clean" (too short - 1 word)

   GOOD (follow this style - 2-5 words):
     ✓ "Warm analog textures" (3 words)
     ✓ "Light visual weight" (3 words)
     ✓ "Gradual transitions creating calm" (4 words)
     ✓ "Minimalist form language" (3 words)
     ✓ "Playful yet professional tone" (4 words)

2. SOURCE FRAGMENT REFERENCE (optional):
   - If your insight is derived from a canvas fragment, include:
     - fragmentId: the fragment's ID (from list below)
     - fragmentTitle: original title from canvas
     - fragmentSummary: 1-2 sentence explanation of how this fragment influenced the insight

3. PRIORITY ASSIGNMENT (1-6):
   - P1-P2: Core insights, most relevant to central question
   - P3-P4: Supporting insights, add depth
   - P5-P6: Subtle/nuanced insights, for exploration

4. WORD COUNT → SHAPE:
   - 2-3 words: Will be placed on TALL shapes
   - 4-5 words: Will be placed on WIDE shapes
   - Mix your outputs to have variety in shapes

PUZZLE SESSION TYPE: ${puzzleType}
Mode/Quadrant: ${input.mode} (${getModeDescription(input.mode)})
Process aim: ${input.processAim}
Central question: ${input.puzzle.centralQuestion}
Anchors: ${input.anchors.map(a => `${a.type}:${a.text}`).join(" | ") || "none"}
Existing pieces: ${existing || "none"}
${fragmentSection}

TASK: Generate 1-3 SHORT STATEMENT pieces for the ${input.mode} quadrant.
Each statement should ${getPuzzleTypeInstruction(puzzleType)}

Examples for ${puzzleType} ${input.mode}:
${getPuzzleTypeExamples(puzzleType, input.mode)}

Return JSON with this structure:
{
  "pieces": [
    {
      "mode": "${input.mode}",
      "text": "2-5 word statement",
      "priority": 1-6,
      "fragmentId": "optional-fragment-id",
      "fragmentTitle": "optional-fragment-title",
      "fragmentSummary": "optional-1-2-sentence-explanation"
    }
  ]
}`;
};

// Helper descriptions for better prompts
const getModeDescription = (mode: DesignMode): string => {
  const descriptions: Record<DesignMode, string> = {
    FORM: "visual shape, structure, composition",
    MOTION: "movement, animation, transitions",
    EXPRESSION: "emotion, personality, tone",
    FUNCTION: "purpose, utility, interaction",
  };
  return descriptions[mode];
};

const getPuzzleTypeInstruction = (puzzleType: PuzzleType): string => {
  const instructions: Record<PuzzleType, string> = {
    CLARIFY: "sharpen vague statements and make concepts concrete",
    EXPAND: "introduce fresh perspectives and explore new angles",
    REFINE: "help converge, choose, and prioritize among existing ideas",
  };
  return instructions[puzzleType];
};

const getPuzzleTypeExamples = (puzzleType: PuzzleType, mode: DesignMode): string => {
  // STATEMENT examples (陈述式) - NOT questions
  const examples: Record<PuzzleType, Record<DesignMode, string[]>> = {
    CLARIFY: {
      FORM: [
        "Geometric foundation with organic accents",
        "Light visual weight, airy composition",
      ],
      MOTION: [
        "Calm, deliberate motion flow",
        "Gradual transitions, natural pacing",
      ],
      EXPRESSION: [
        "Calm confidence over excitement",
        "Professional warmth, not coldness",
      ],
      FUNCTION: [
        "Mobile-first, desktop-enhanced",
        "Creative professionals as audience",
      ],
    },
    EXPAND: {
      FORM: [
        "Glass morphism as depth metaphor",
        "Layered transparency revealing structure",
      ],
      MOTION: [
        "Breathing animations for living feel",
        "Physics-based spring interactions",
      ],
      EXPRESSION: [
        "Playful moments within serious context",
        "Nostalgic references to analog tools",
      ],
      FUNCTION: [
        "Offline-first for reliability",
        "Voice control as alternative input",
      ],
    },
    REFINE: {
      FORM: [
        "Rounded corners as signature element",
        "Two-column layout as primary structure",
      ],
      MOTION: [
        "Fade transitions only, no sliding",
        "200ms as standard duration",
      ],
      EXPRESSION: [
        "Helpful guide over neutral tool",
        "Encouraging tone in empty states",
      ],
      FUNCTION: [
        "Search as primary navigation",
        "Export to PDF as must-have",
      ],
    },
  };
  return examples[puzzleType][mode].map((e, i) => `  ${i + 1}. "${e}"`).join("\n");
};

export const runQuadrantPieceAgent = async (
  input: QuadrantPieceInput,
  client: LLMClient,
): Promise<QuadrantPieceOutput> => {
  try {
    const raw = await client.generate(buildPrompt(input), 0.6);
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    // Fallback with puzzleType-aware statements
    const fallbackText = getFallbackStatement(input.puzzleType, input.mode);

    return {
      pieces: [
        {
          mode: input.mode,
          text: fallbackText,
        },
      ],
    };
  }
};

// Fallback STATEMENTS when AI fails (陈述式)
const getFallbackStatement = (puzzleType: PuzzleType, mode: DesignMode): string => {
  const fallbacks: Record<PuzzleType, Record<DesignMode, string>> = {
    CLARIFY: {
      FORM: "Core visual quality defined",
      MOTION: "Motion energy as gentle flow",
      EXPRESSION: "Single word feeling captured",
      FUNCTION: "Target audience identified",
    },
    EXPAND: {
      FORM: "Alternative visual approach",
      MOTION: "Unexpected movement possibility",
      EXPRESSION: "Contrasting emotion for depth",
      FUNCTION: "New use case considered",
    },
    REFINE: {
      FORM: "Essential visual element chosen",
      MOTION: "Priority motion effect selected",
      EXPRESSION: "Core feeling doubled down",
      FUNCTION: "Must-have feature confirmed",
    },
  };
  return fallbacks[puzzleType][mode];
};
