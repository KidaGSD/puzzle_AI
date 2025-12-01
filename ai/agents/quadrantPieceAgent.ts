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
    // The question/prompt for the piece
    text: string;
    internalNote?: string;
    // For image-based pieces
    imageUrl?: string;
    fragmentId?: string;
    // @deprecated fields kept for backwards compatibility
    category?: PuzzleType | "CONNECT";
    title?: string;
    content?: string;
  }>;
}

const buildPrompt = (input: QuadrantPieceInput) => {
  const existing = input.existingPiecesForMode.map(p => p.text).join(" | ");
  const puzzleType = input.puzzleType;

  // Build fragment context section
  let fragmentSection = "";
  if (input.fragments && input.fragments.length > 0) {
    const textFragments = input.fragments.filter(f => f.type === "TEXT");
    const imageFragments = input.fragments.filter(f => f.type === "IMAGE");

    if (textFragments.length > 0) {
      fragmentSection += `\nText fragments from canvas:\n`;
      textFragments.slice(0, 5).forEach((f, i) => {
        fragmentSection += `  ${i + 1}. "${f.summary || f.content.slice(0, 100)}" [tags: ${f.tags?.join(", ") || "none"}]\n`;
      });
    }

    if (imageFragments.length > 0) {
      fragmentSection += `\nImage fragments from canvas:\n`;
      imageFragments.slice(0, 3).forEach((f, i) => {
        fragmentSection += `  ${i + 1}. ID: ${f.id}, Description: "${f.summary || 'Image'}" [tags: ${f.tags?.join(", ") || "none"}]\n`;
      });
    }
  }

  return `You are the Quadrant Piece Agent for a design thinking puzzle app.

=== CRITICAL: Generate STATEMENTS, NOT questions ===
Each piece must be a SHORT DECLARATIVE STATEMENT (陈述式).
NEVER generate questions. NEVER end with a question mark (?).

BAD (do NOT generate):
  ✗ "How does the visual layout reinforce gentle awakening?"
  ✗ "What's the dominant visual weight?"
  ✗ "Should transitions feel instant or gradual?"

GOOD (follow this style):
  ✓ "Visual layout as gentle awakening"
  ✓ "Light visual weight with breathing space"
  ✓ "Gradual transitions creating calm flow"
  ✓ "Minimalist form language"

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

Rules:
- Each piece is a SHORT STATEMENT (max 8 words)
- Declarative, not interrogative
- No question marks (?)
- Concise insight or direction

Return JSON: { "pieces": [{ "mode": "${input.mode}", "text": "Your statement here", "fragmentId": "optional-fragment-id" }] }`;
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
