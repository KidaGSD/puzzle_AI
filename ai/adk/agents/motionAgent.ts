/**
 * MotionAgent - MOTION Quadrant Specialist
 *
 * Evidence Targets (from FinalAILogic.md):
 * - pacing (slow/fast), rhythm, verbs (pour, whisk, bloom)
 * - transition style (fade/snap/bloom), stability vs dynamism
 * - speed, easing curves, entrance/exit, micro-interactions
 *
 * Special Rules:
 * - If motion words without direction, pick style ("slow pour bloom")
 * - If ritual cues (pour/whisk), expand into motion qualities
 * - If many verbs: pick strongest, deprioritize conflicting energy
 * - Connect to form: how motion influences typography/icon
 */

import { PuzzleType, Anchor, PiecePriority } from "../../../domain/models";
import { PieceSchema, QuadrantAgentOutputSchema } from "../schemas/puzzleSchemas";
import { LLMClient } from "../../adkClient";
import { EnrichedFragment } from "./quadrantManagerAgent";
import { priorityToSaturation } from "../../../constants/colors";

// ========== Motion-Specific Configuration ==========

const MOTION_EVIDENCE_TARGETS = [
  'movement', 'animation', 'transition', 'rhythm', 'pacing', 'flow',
  'pour', 'whisk', 'bloom', 'fade', 'snap', 'ease', 'timing', 'speed',
  'dynamic', 'slow', 'fast', 'glide', 'hover', 'drift', 'settle', 'rise'
];

const MOTION_FORBIDDEN_PREFIXES = [
  'define', 'explore', 'clarify', 'focus', 'understand', 'set', 'outline',
  'establish', 'determine', 'consider', 'identify', 'address'
];

// ========== Input/Output Types ==========

export interface MotionAgentInput {
  processAim: string;
  puzzleType: PuzzleType;
  centralQuestion: string;
  fragments: EnrichedFragment[];
  anchors: Anchor[];
  preferenceHints?: string;
  avoidPhrases?: string[];
}

// ========== Prompt Builder ==========

const buildMotionPrompt = (input: MotionAgentInput): string => {
  const fragmentContext = input.fragments.map((f, i) => {
    const features: string[] = [];
    if (f.keywords?.length) features.push(`Keywords: ${f.keywords.slice(0, 6).join(', ')}`);
    if (f.themes?.length) features.push(`Themes: ${f.themes.slice(0, 4).join(', ')}`);
    if (f.mood) features.push(`Mood: ${f.mood}`);
    if (f.uniqueInsight) features.push(`Insight: ${f.uniqueInsight}`);

    if (f.type === 'IMAGE') {
      return `${i + 1}. [IMAGE] "${f.title}" | ${features.join(' | ')} | URL: ${f.imageUrl}`;
    }
    return `${i + 1}. "${f.title}" | Summary: ${f.summary} | ${features.join(' | ')}`;
  }).join('\n');

  const anchorsStr = input.anchors.map(a => `${a.type}: "${a.text}"`).join('; ');
  const avoidStr = input.avoidPhrases?.length ? `\nAVOID THESE PHRASES: ${input.avoidPhrases.join(', ')}` : '';

  return `You are the MOTION Quadrant Agent - specialist in movement, animation, and rhythm.

=== YOUR FOCUS ===
Generate insights about MOTION aspects:
- Pacing (slow/fast), rhythm, timing
- Verbs: pour, whisk, bloom, fade, snap
- Transition styles: fade, snap, bloom, ease
- Stability vs dynamism
- Entrance/exit, micro-interactions

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
3. CONCRETE: Use motion verbs and rhythm terms from fragments
4. GROUNDING: At least 60% must cite a fragment with reasoning

=== FORBIDDEN (instant rejection) ===
- Starting with: Define, Explore, Clarify, Focus, Understand, Set, Outline
- Generic phrases: "motion quality", "animation approach", "movement style"
- Abstract only: must include at least one concrete verb or rhythm term

=== MOTION-SPECIFIC RULES ===
- If motion words without direction, pick a style:
  "movement" → "slow drift settle", "animation" → "soft fade bloom"
- If ritual cues (pour, whisk, steam), expand into motion qualities:
  "pour" → "slow pour bloom", "whisk" → "rapid whisk swirl"
- If many verbs: pick strongest motion cue, note conflicting energy:
  "steady hover pause" vs "dynamic snap entrance"
- Connect to form: how motion influences typography/icon animation
${avoidStr}

=== OUTPUT FORMAT (JSON) ===
{
  "pieces": [
    {
      "text": "2-5 word statement with motion verb",
      "priority": 1-6,
      "fragment_id": "source fragment ID",
      "fragment_title": "source fragment title",
      "fragment_summary": "REQUIRED: How this fragment's [specific motion/rhythm element] inspired this (15-30 words)"
    }
  ]
}

=== GOOD EXAMPLES (motion patterns) ===
- "Slow pour bloom" (pacing + verb + transition)
- "Steady hover pause" (stability + action + rhythm)
- "Soft fade entrance" (easing + transition + timing)
- "Rapid whisk energy" (speed + verb + feeling)
- "Gentle drift settle" (easing + motion + endpoint)

Generate 8-10 pieces for the MOTION quadrant.`;
};

// ========== Validation ==========

const isValidMotionPiece = (text: string): boolean => {
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  if (words.length < 2 || words.length > 5) return false;
  if (MOTION_FORBIDDEN_PREFIXES.some(p => normalized.startsWith(p + ' '))) return false;
  if (normalized.endsWith('?')) return false;

  const abstractOnly = new Set(['motion', 'movement', 'approach', 'direction', 'quality', 'style', 'element', 'aspect']);
  const hasConcreteWord = words.some(w => !abstractOnly.has(w) && w.length > 2);
  if (!hasConcreteWord) return false;

  return true;
};

// ========== Agent Runner ==========

export const runMotionAgent = async (
  input: MotionAgentInput,
  client: LLMClient
): Promise<QuadrantAgentOutputSchema> => {
  console.log(`[MotionAgent] Starting with ${input.fragments.length} fragments`);

  if (input.fragments.length === 0) {
    console.warn('[MotionAgent] No fragments provided');
    return {
      pieces: [],
      meta: { mode: 'MOTION', generatedCount: 0, filteredCount: 0, qualityScore: 0 }
    };
  }

  try {
    const prompt = buildMotionPrompt(input);
    const response = await client.generate(prompt, 0.75);
    const cleaned = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const rawPieces = parsed.pieces || [];
    const validPieces: PieceSchema[] = [];

    for (const p of rawPieces) {
      const text = (p.text || '').trim();

      if (!isValidMotionPiece(text)) {
        console.log(`[MotionAgent] Rejected invalid: "${text}"`);
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
            fragmentSummary = `From "${srcFrag.title}": ${srcFrag.uniqueInsight || srcFrag.summary?.slice(0, 80) || 'Motion/rhythm reference'}`;
          }
          // CRITICAL: Pull imageUrl from source fragment if it's an IMAGE type
          if (!imageUrl && srcFrag.type === 'IMAGE' && srcFrag.imageUrl) {
            imageUrl = srcFrag.imageUrl;
          }
        }
      }

      if (!fragmentSummary || fragmentSummary.length < 10) {
        fragmentSummary = `This MOTION insight captures the rhythm and timing direction for ${input.processAim.split(' ').slice(0, 4).join(' ')}`;
      }

      validPieces.push({
        text,
        priority: (p.priority || 3) as PiecePriority,
        saturationLevel: priorityToSaturation(p.priority || 3),
        mode: 'MOTION',
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

    console.log(`[MotionAgent] Generated ${validPieces.length} pieces, quality=${qualityScore}`);

    return {
      pieces: validPieces,
      meta: {
        mode: 'MOTION',
        generatedCount: rawPieces.length,
        filteredCount: validPieces.length,
        qualityScore
      }
    };
  } catch (error) {
    console.error('[MotionAgent] Error:', error);
    return {
      pieces: [],
      meta: { mode: 'MOTION', generatedCount: 0, filteredCount: 0, qualityScore: 0 }
    };
  }
};

export default { runMotionAgent };
