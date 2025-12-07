/**
 * FormAgent - FORM Quadrant Specialist
 *
 * Evidence Targets (from FinalAILogic.md):
 * - shape/silhouette, structure/layout, texture/material
 * - composition, weight, balance, pattern
 * - geometric vs organic, visual weight, layering, proportion
 *
 * Special Rules:
 * - If ambiguous adjectives ("clean", "simple"), force concrete interpretation
 * - If image fragments: pull palette/shapes/objects ("bamboo steam curve")
 * - If dense fragments (>=6), surface prioritizing/exclusion ("no busy filigree")
 * - Connect to expression: how form reflects mood
 */

import { PuzzleType, Anchor, PiecePriority } from "../../../domain/models";
import { PieceSchema, QuadrantAgentOutputSchema } from "../schemas/puzzleSchemas";
import { LLMClient } from "../../adkClient";
import { EnrichedFragment } from "./quadrantManagerAgent";
import { priorityToSaturation } from "../../../constants/colors";

// ========== Form-Specific Configuration ==========

const FORM_EVIDENCE_TARGETS = [
  'shape', 'silhouette', 'structure', 'layout', 'texture', 'material',
  'composition', 'weight', 'balance', 'pattern', 'geometric', 'organic',
  'visual weight', 'layering', 'proportion', 'grid', 'line', 'surface'
];

const FORM_FORBIDDEN_PREFIXES = [
  'define', 'explore', 'clarify', 'focus', 'understand', 'set', 'outline',
  'establish', 'determine', 'consider', 'identify', 'address'
];

// ========== Input/Output Types ==========

export interface FormAgentInput {
  processAim: string;
  puzzleType: PuzzleType;
  centralQuestion: string;
  fragments: EnrichedFragment[];
  anchors: Anchor[];
  preferenceHints?: string;
  avoidPhrases?: string[];
}

// ========== Prompt Builder ==========

const buildFormPrompt = (input: FormAgentInput): string => {
  const fragmentContext = input.fragments.map((f, i) => {
    const features: string[] = [];
    if (f.keywords?.length) features.push(`Keywords: ${f.keywords.slice(0, 6).join(', ')}`);
    if (f.themes?.length) features.push(`Themes: ${f.themes.slice(0, 4).join(', ')}`);
    if (f.palette?.length) features.push(`Palette: ${f.palette.join(', ')}`);
    if (f.objects?.length) features.push(`Objects: ${f.objects.join(', ')}`);
    if (f.uniqueInsight) features.push(`Insight: ${f.uniqueInsight}`);

    if (f.type === 'IMAGE') {
      return `${i + 1}. [IMAGE] "${f.title}" | ${features.join(' | ')} | URL: ${f.imageUrl}`;
    }
    return `${i + 1}. "${f.title}" | Summary: ${f.summary} | ${features.join(' | ')}`;
  }).join('\n');

  const anchorsStr = input.anchors.map(a => `${a.type}: "${a.text}"`).join('; ');
  const avoidStr = input.avoidPhrases?.length ? `\nAVOID THESE PHRASES: ${input.avoidPhrases.join(', ')}` : '';

  return `You are the FORM Quadrant Agent - specialist in visual structure, shape, and composition.

=== YOUR FOCUS ===
Generate insights about FORM aspects:
- Shape/silhouette, structure/layout
- Texture/material, composition
- Weight, balance, pattern
- Geometric vs organic forms
- Visual weight, layering, proportion

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
3. CONCRETE: Use specific nouns from fragments (materials, shapes, textures)
4. GROUNDING: At least 60% must cite a fragment with reasoning

=== FORBIDDEN (instant rejection) ===
- Starting with: Define, Explore, Clarify, Focus, Understand, Set, Outline
- Generic phrases: "visual direction", "design approach", "form quality"
- Abstract only: must include at least one concrete noun

=== FORM-SPECIFIC RULES ===
- If fragment has ambiguous adjectives ("clean", "simple"), make concrete:
  "clean" → "stark white grid", "simple" → "single line silhouette"
- If IMAGE fragment: extract palette/shapes/objects as concrete terms
  e.g., "bamboo steam curve", "brass circular motif", "matcha gradient softness"
- If many fragments (6+): pick strongest form elements, note exclusions
  e.g., "bold geometric focus", "no busy filigree"
- Connect to mood when relevant: how the form reflects emotion
${avoidStr}

=== OUTPUT FORMAT (JSON) ===
{
  "pieces": [
    {
      "text": "2-5 word statement with concrete noun",
      "priority": 1-6,
      "fragment_id": "source fragment ID",
      "fragment_title": "source fragment title",
      "fragment_summary": "REQUIRED: How this fragment's [specific visual element] inspired this form insight (15-30 words)"
    }
  ]
}

=== GOOD EXAMPLES (form patterns) ===
- "Soft geometric grid" (shape + structure)
- "Bamboo steam curve" (material + motion-form)
- "Brass matcha gradient" (material + color)
- "Heavy rounded silhouette" (weight + shape)
- "Layered organic texture" (structure + material)

Generate 8-10 pieces for the FORM quadrant.`;
};

// ========== Validation ==========

const isValidFormPiece = (text: string): boolean => {
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  // Check word count
  if (words.length < 2 || words.length > 5) return false;

  // Check forbidden prefixes
  if (FORM_FORBIDDEN_PREFIXES.some(p => normalized.startsWith(p + ' '))) return false;

  // Check not a question
  if (normalized.endsWith('?')) return false;

  // Check for at least one concrete noun (not all abstract)
  const abstractOnly = new Set(['visual', 'design', 'approach', 'direction', 'quality', 'style', 'element', 'aspect']);
  const hasConcreteWord = words.some(w => !abstractOnly.has(w) && w.length > 2);
  if (!hasConcreteWord) return false;

  return true;
};

// ========== Agent Runner ==========

export const runFormAgent = async (
  input: FormAgentInput,
  client: LLMClient
): Promise<QuadrantAgentOutputSchema> => {
  console.log(`[FormAgent] Starting with ${input.fragments.length} fragments`);

  if (input.fragments.length === 0) {
    console.warn('[FormAgent] No fragments provided');
    return {
      pieces: [],
      meta: { mode: 'FORM', generatedCount: 0, filteredCount: 0, qualityScore: 0 }
    };
  }

  try {
    const prompt = buildFormPrompt(input);
    const response = await client.generate(prompt, 0.75);
    const cleaned = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const rawPieces = parsed.pieces || [];
    const validPieces: PieceSchema[] = [];

    for (const p of rawPieces) {
      const text = (p.text || '').trim();

      if (!isValidFormPiece(text)) {
        console.log(`[FormAgent] Rejected invalid: "${text}"`);
        continue;
      }

      // Get fragment info
      let fragmentId = p.fragment_id || p.fragmentId;
      let fragmentTitle = p.fragment_title || p.fragmentTitle;
      let fragmentSummary = p.fragment_summary || p.fragmentSummary || '';
      let imageUrl = p.image_url || p.imageUrl;

      // Backfill from input fragments
      if (fragmentId) {
        const srcFrag = input.fragments.find(f => f.id === fragmentId);
        if (srcFrag) {
          if (!fragmentTitle) fragmentTitle = srcFrag.title;
          if (!fragmentSummary || fragmentSummary.length < 15) {
            fragmentSummary = `From "${srcFrag.title}": ${srcFrag.uniqueInsight || srcFrag.summary?.slice(0, 80) || 'Visual structure reference'}`;
          }
          // CRITICAL: Pull imageUrl from source fragment if it's an IMAGE type
          if (!imageUrl && srcFrag.type === 'IMAGE' && srcFrag.imageUrl) {
            imageUrl = srcFrag.imageUrl;
          }
        }
      }

      // Ensure summary exists
      if (!fragmentSummary || fragmentSummary.length < 10) {
        fragmentSummary = `This FORM insight captures the visual structure direction for ${input.processAim.split(' ').slice(0, 4).join(' ')}`;
      }

      validPieces.push({
        text,
        priority: (p.priority || 3) as PiecePriority,
        saturationLevel: priorityToSaturation(p.priority || 3),
        mode: 'FORM',
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

    // Calculate quality score
    const groundedCount = validPieces.filter(p => p.fragmentId).length;
    const groundingRate = validPieces.length > 0 ? groundedCount / validPieces.length : 0;
    const qualityScore = Math.round(
      (groundingRate * 50) +
      (validPieces.length >= 4 ? 30 : validPieces.length * 7.5) +
      (validPieces.every(p => p.fragmentSummary && p.fragmentSummary.length > 15) ? 20 : 10)
    );

    console.log(`[FormAgent] Generated ${validPieces.length} pieces, quality=${qualityScore}`);

    return {
      pieces: validPieces,
      meta: {
        mode: 'FORM',
        generatedCount: rawPieces.length,
        filteredCount: validPieces.length,
        qualityScore
      }
    };
  } catch (error) {
    console.error('[FormAgent] Error:', error);
    return {
      pieces: [],
      meta: { mode: 'FORM', generatedCount: 0, filteredCount: 0, qualityScore: 0 }
    };
  }
};

export default { runFormAgent };
