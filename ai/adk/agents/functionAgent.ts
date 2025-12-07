/**
 * FunctionAgent - FUNCTION Quadrant Specialist
 *
 * Evidence Targets (from FinalAILogic.md):
 * - audience, context of use (mobile/print)
 * - accessibility, platform constraints
 * - jobs-to-be-done, goals
 *
 * Special Rules:
 * - If no usage context, set primary ("mobile-first legibility")
 * - If many functional notes, pick primary job ("primary: menu legibility")
 * - Connect to form/motion: how function shapes choices
 */

import { PuzzleType, Anchor, PiecePriority } from "../../../domain/models";
import { PieceSchema, QuadrantAgentOutputSchema } from "../schemas/puzzleSchemas";
import { LLMClient } from "../../adkClient";
import { EnrichedFragment } from "./quadrantManagerAgent";
import { priorityToSaturation } from "../../../constants/colors";

// ========== Function-Specific Configuration ==========

const FUNCTION_EVIDENCE_TARGETS = [
  'audience', 'user', 'purpose', 'context', 'accessibility', 'platform',
  'constraint', 'mobile', 'responsive', 'legibility', 'usability', 'goal',
  'job', 'print', 'screen', 'packaging', 'menu', 'navigation', 'retail'
];

const FUNCTION_FORBIDDEN_PREFIXES = [
  'define', 'explore', 'clarify', 'focus', 'understand', 'set', 'outline',
  'establish', 'determine', 'consider', 'identify', 'address'
];

// ========== Input/Output Types ==========

export interface FunctionAgentInput {
  processAim: string;
  puzzleType: PuzzleType;
  centralQuestion: string;
  fragments: EnrichedFragment[];
  anchors: Anchor[];
  preferenceHints?: string;
  avoidPhrases?: string[];
}

// ========== Prompt Builder ==========

const buildFunctionPrompt = (input: FunctionAgentInput): string => {
  const fragmentContext = input.fragments.map((f, i) => {
    const features: string[] = [];
    if (f.keywords?.length) features.push(`Keywords: ${f.keywords.slice(0, 6).join(', ')}`);
    if (f.themes?.length) features.push(`Themes: ${f.themes.slice(0, 4).join(', ')}`);
    if (f.uniqueInsight) features.push(`Insight: ${f.uniqueInsight}`);

    if (f.type === 'IMAGE') {
      return `${i + 1}. [IMAGE] "${f.title}" | ${features.join(' | ')} | URL: ${f.imageUrl}`;
    }
    return `${i + 1}. "${f.title}" | Summary: ${f.summary} | ${features.join(' | ')}`;
  }).join('\n');

  const anchorsStr = input.anchors.map(a => `${a.type}: "${a.text}"`).join('; ');
  const avoidStr = input.avoidPhrases?.length ? `\nAVOID THESE PHRASES: ${input.avoidPhrases.join(', ')}` : '';

  return `You are the FUNCTION Quadrant Agent - specialist in purpose, audience, and practical constraints.

=== YOUR FOCUS ===
Generate insights about FUNCTION aspects:
- Target audience, user context
- Purpose, jobs-to-be-done, goals
- Platform: mobile, print, screen, packaging
- Accessibility, legibility, usability
- Constraints, practical requirements

=== CONTEXT ===
Central Question: "${input.centralQuestion}"
Process Aim: "${input.processAim}"
Puzzle Type: ${input.puzzleType}
${anchorsStr ? `Anchors: ${anchorsStr}` : ''}
${input.preferenceHints ? `User Preferences: ${input.preferenceHints}` : ''}

=== FRAGMENTS TO ANALYZE ===
${fragmentContext}

=== CRITICAL OUTPUT RULES ===
1. LENGTH: Each piece MUST be exactly 2-5 words (count carefully!)
2. FORMAT: Declarative statements only, NO questions
3. CONCRETE: Use audience/platform/context terms from fragments
4. GROUNDING: At least 60% must cite a fragment with reasoning

=== FORBIDDEN (instant rejection) ===
- Starting with: Define, Explore, Clarify, Focus, Understand, Set, Outline
- Generic phrases: "function quality", "purpose direction", "utility approach"
- Abstract only: must include specific audience/platform/constraint terms

=== FUNCTION-SPECIFIC RULES ===
- If no usage context, set a primary:
  "design" → "mobile-first legibility", "brand" → "packaging shelf pop"
- If many functional notes, pick primary job and note others:
  "primary: menu legibility" over "secondary: icon scalability"
- Connect to form/motion: how function shapes design choices:
  "touch-friendly spacing" (function + form), "quick-scan hierarchy" (function + motion)
- Audience specificity when present:
  "busy professionals", "first-time visitors", "mobile shoppers"
${avoidStr}

=== OUTPUT FORMAT (JSON) ===
{
  "pieces": [
    {
      "text": "2-5 word statement with audience/platform/context term",
      "priority": 1-6,
      "fragment_id": "source fragment ID",
      "fragment_title": "source fragment title",
      "fragment_summary": "REQUIRED: How this fragment's [specific functional element] inspired this (15-30 words)"
    }
  ]
}

=== GOOD EXAMPLES (function patterns) ===
- "Mobile-first legibility" (platform + primary job)
- "Packaging shelf pop" (context + goal)
- "Touch-friendly spacing" (interaction + form)
- "Quick-scan hierarchy" (behavior + structure)
- "Retail visibility focus" (context + priority)

Generate 8-10 pieces for the FUNCTION quadrant.`;
};

// ========== Validation ==========

const isValidFunctionPiece = (text: string): boolean => {
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  if (words.length < 2 || words.length > 5) return false;
  if (FUNCTION_FORBIDDEN_PREFIXES.some(p => normalized.startsWith(p + ' '))) return false;
  if (normalized.endsWith('?')) return false;

  const abstractOnly = new Set(['function', 'purpose', 'approach', 'direction', 'quality', 'style', 'element', 'aspect', 'utility']);
  const hasConcreteWord = words.some(w => !abstractOnly.has(w) && w.length > 2);
  if (!hasConcreteWord) return false;

  return true;
};

// ========== Agent Runner ==========

export const runFunctionAgent = async (
  input: FunctionAgentInput,
  client: LLMClient
): Promise<QuadrantAgentOutputSchema> => {
  console.log(`[FunctionAgent] Starting with ${input.fragments.length} fragments`);

  if (input.fragments.length === 0) {
    console.warn('[FunctionAgent] No fragments provided');
    return {
      pieces: [],
      meta: { mode: 'FUNCTION', generatedCount: 0, filteredCount: 0, qualityScore: 0 }
    };
  }

  try {
    const prompt = buildFunctionPrompt(input);
    const response = await client.generate(prompt, 0.75);
    const cleaned = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const rawPieces = parsed.pieces || [];
    const validPieces: PieceSchema[] = [];

    for (const p of rawPieces) {
      const text = (p.text || '').trim();

      if (!isValidFunctionPiece(text)) {
        console.log(`[FunctionAgent] Rejected invalid: "${text}"`);
        continue;
      }

      let fragmentId = p.fragment_id || p.fragmentId;
      let fragmentTitle = p.fragment_title || p.fragmentTitle;
      let fragmentSummary = p.fragment_summary || p.fragmentSummary || '';
      let imageUrl = p.image_url || p.imageUrl;

      if (fragmentId) {
        const srcFrag = input.fragments.find(f => f.id === fragmentId);
        if (srcFrag) {
          if (!fragmentTitle) fragmentTitle = srcFrag.title;
          if (!fragmentSummary || fragmentSummary.length < 15) {
            fragmentSummary = `From "${srcFrag.title}": ${srcFrag.uniqueInsight || srcFrag.summary?.slice(0, 80) || 'Functional context reference'}`;
          }
          // CRITICAL: Pull imageUrl from source fragment if it's an IMAGE type
          if (!imageUrl && srcFrag.type === 'IMAGE' && srcFrag.imageUrl) {
            imageUrl = srcFrag.imageUrl;
          }
        }
      }

      if (!fragmentSummary || fragmentSummary.length < 10) {
        fragmentSummary = `This FUNCTION insight captures the practical purpose for ${input.processAim.split(' ').slice(0, 4).join(' ')}`;
      }

      validPieces.push({
        text,
        priority: (p.priority || 3) as PiecePriority,
        saturationLevel: priorityToSaturation(p.priority || 3),
        mode: 'FUNCTION',
        fragmentId,
        fragmentTitle,
        fragmentSummary,
        imageUrl,
        qualityMeta: {
          wordCount: text.split(/\s+/).length,
          isQuestion: false,
          hasFragmentGrounding: !!fragmentId,
          isBlacklisted: false
        }
      });
    }

    const groundedCount = validPieces.filter(p => p.fragmentId).length;
    const groundingRate = validPieces.length > 0 ? groundedCount / validPieces.length : 0;
    const qualityScore = Math.round(
      (groundingRate * 50) +
      (validPieces.length >= 4 ? 30 : validPieces.length * 7.5) +
      (validPieces.every(p => p.fragmentSummary && p.fragmentSummary.length > 15) ? 20 : 10)
    );

    console.log(`[FunctionAgent] Generated ${validPieces.length} pieces, quality=${qualityScore}`);

    return {
      pieces: validPieces,
      meta: {
        mode: 'FUNCTION',
        generatedCount: rawPieces.length,
        filteredCount: validPieces.length,
        qualityScore
      }
    };
  } catch (error) {
    console.error('[FunctionAgent] Error:', error);
    return {
      pieces: [],
      meta: { mode: 'FUNCTION', generatedCount: 0, filteredCount: 0, qualityScore: 0 }
    };
  }
};

export default { runFunctionAgent };
