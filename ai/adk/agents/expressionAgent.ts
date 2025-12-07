/**
 * ExpressionAgent - EXPRESSION Quadrant Specialist
 *
 * Evidence Targets (from FinalAILogic.md):
 * - emotional hierarchy, tone spectrum (traditional/modern, playful/serious)
 * - cultural cues, voice, mood
 * - warmth vs cool, premium vs accessible, energy level
 *
 * Special Rules:
 * - If mood words without priority, pick top emotions concretely ("warm ceremonial calm")
 * - If conflicting, choose or exclude ("no ironic sarcasm")
 * - Connect to palette/form: how expression influences color/iconography
 */

import { PuzzleType, Anchor, PiecePriority } from "../../../domain/models";
import { PieceSchema, QuadrantAgentOutputSchema } from "../schemas/puzzleSchemas";
import { LLMClient } from "../../adkClient";
import { EnrichedFragment } from "./quadrantManagerAgent";
import { priorityToSaturation } from "../../../constants/colors";

// ========== Expression-Specific Configuration ==========

const EXPRESSION_EVIDENCE_TARGETS = [
  'emotion', 'mood', 'tone', 'personality', 'voice', 'feeling', 'atmosphere',
  'warmth', 'energy', 'calm', 'bold', 'quiet', 'playful', 'serious', 'cultural',
  'traditional', 'modern', 'premium', 'accessible', 'zen', 'ceremonial', 'spirit'
];

const EXPRESSION_FORBIDDEN_PREFIXES = [
  'define', 'explore', 'clarify', 'focus', 'understand', 'set', 'outline',
  'establish', 'determine', 'consider', 'identify', 'address'
];

// ========== Input/Output Types ==========

export interface ExpressionAgentInput {
  processAim: string;
  puzzleType: PuzzleType;
  centralQuestion: string;
  fragments: EnrichedFragment[];
  anchors: Anchor[];
  preferenceHints?: string;
  avoidPhrases?: string[];
}

// ========== Prompt Builder ==========

const buildExpressionPrompt = (input: ExpressionAgentInput): string => {
  const fragmentContext = input.fragments.map((f, i) => {
    const features: string[] = [];
    if (f.keywords?.length) features.push(`Keywords: ${f.keywords.slice(0, 6).join(', ')}`);
    if (f.themes?.length) features.push(`Themes: ${f.themes.slice(0, 4).join(', ')}`);
    if (f.mood) features.push(`Mood: ${f.mood}`);
    if (f.palette?.length) features.push(`Palette: ${f.palette.join(', ')}`);
    if (f.uniqueInsight) features.push(`Insight: ${f.uniqueInsight}`);

    if (f.type === 'IMAGE') {
      return `${i + 1}. [IMAGE] "${f.title}" | ${features.join(' | ')} | URL: ${f.imageUrl}`;
    }
    return `${i + 1}. "${f.title}" | Summary: ${f.summary} | ${features.join(' | ')}`;
  }).join('\n');

  const anchorsStr = input.anchors.map(a => `${a.type}: "${a.text}"`).join('; ');
  const avoidStr = input.avoidPhrases?.length ? `\nAVOID THESE PHRASES: ${input.avoidPhrases.join(', ')}` : '';

  return `You are the EXPRESSION Quadrant Agent - specialist in emotional tone, personality, and mood.

=== YOUR FOCUS ===
Generate insights about EXPRESSION aspects:
- Emotional hierarchy, mood priority
- Tone spectrum: traditional/modern, playful/serious
- Cultural cues, voice, personality
- Warmth vs cool, premium vs accessible
- Energy level, atmosphere

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
3. CONCRETE: Use mood/emotion words with concrete qualifiers
4. GROUNDING: At least 60% must cite a fragment with reasoning

=== FORBIDDEN (instant rejection) ===
- Starting with: Define, Explore, Clarify, Focus, Understand, Set, Outline
- Generic phrases: "emotional tone", "mood direction", "expression style"
- Abstract only: must include specific mood/emotion terms

=== EXPRESSION-SPECIFIC RULES ===
- If mood words without priority, pick top emotions concretely:
  "calm" → "warm ceremonial calm", "bold" → "confident bold energy"
- If conflicting emotions, choose or exclude:
  "playful + serious" → pick dominant: "playful confident warmth" OR "no ironic sarcasm"
- Connect to palette/form: how expression influences color/iconography:
  "warm amber glow" (emotion + color), "soft zen presence" (mood + form)
- Use cultural/contextual terms when present:
  "ceremonial", "ritual", "traditional", "modern", "heritage"
${avoidStr}

=== OUTPUT FORMAT (JSON) ===
{
  "pieces": [
    {
      "text": "2-5 word statement with mood/emotion term",
      "priority": 1-6,
      "fragment_id": "source fragment ID",
      "fragment_title": "source fragment title",
      "fragment_summary": "REQUIRED: How this fragment's [specific emotional/tonal element] inspired this (15-30 words)"
    }
  ]
}

=== GOOD EXAMPLES (expression patterns) ===
- "Warm ceremonial calm" (temperature + cultural + emotion)
- "Modern confident quiet" (era + personality + mood)
- "Soft zen presence" (texture-mood + cultural + state)
- "Bold playful energy" (intensity + personality + feeling)
- "Traditional warmth spirit" (heritage + emotion + essence)

Generate 8-10 pieces for the EXPRESSION quadrant.`;
};

// ========== Validation ==========

const isValidExpressionPiece = (text: string): boolean => {
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);

  if (words.length < 2 || words.length > 5) return false;
  if (EXPRESSION_FORBIDDEN_PREFIXES.some(p => normalized.startsWith(p + ' '))) return false;
  if (normalized.endsWith('?')) return false;

  const abstractOnly = new Set(['expression', 'mood', 'approach', 'direction', 'quality', 'style', 'element', 'aspect', 'tone']);
  const hasConcreteWord = words.some(w => !abstractOnly.has(w) && w.length > 2);
  if (!hasConcreteWord) return false;

  return true;
};

// ========== Agent Runner ==========

export const runExpressionAgent = async (
  input: ExpressionAgentInput,
  client: LLMClient
): Promise<QuadrantAgentOutputSchema> => {
  console.log(`[ExpressionAgent] Starting with ${input.fragments.length} fragments`);

  if (input.fragments.length === 0) {
    console.warn('[ExpressionAgent] No fragments provided');
    return {
      pieces: [],
      meta: { mode: 'EXPRESSION', generatedCount: 0, filteredCount: 0, qualityScore: 0 }
    };
  }

  try {
    const prompt = buildExpressionPrompt(input);
    const response = await client.generate(prompt, 0.75);
    const cleaned = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const rawPieces = parsed.pieces || [];
    const validPieces: PieceSchema[] = [];

    for (const p of rawPieces) {
      const text = (p.text || '').trim();

      if (!isValidExpressionPiece(text)) {
        console.log(`[ExpressionAgent] Rejected invalid: "${text}"`);
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
            fragmentSummary = `From "${srcFrag.title}": ${srcFrag.uniqueInsight || srcFrag.mood || srcFrag.summary?.slice(0, 80) || 'Emotional tone reference'}`;
          }
          // CRITICAL: Pull imageUrl from source fragment if it's an IMAGE type
          if (!imageUrl && srcFrag.type === 'IMAGE' && srcFrag.imageUrl) {
            imageUrl = srcFrag.imageUrl;
          }
        }
      }

      if (!fragmentSummary || fragmentSummary.length < 10) {
        fragmentSummary = `This EXPRESSION insight captures the emotional tone for ${input.processAim.split(' ').slice(0, 4).join(' ')}`;
      }

      validPieces.push({
        text,
        priority: (p.priority || 3) as PiecePriority,
        saturationLevel: priorityToSaturation(p.priority || 3),
        mode: 'EXPRESSION',
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

    console.log(`[ExpressionAgent] Generated ${validPieces.length} pieces, quality=${qualityScore}`);

    return {
      pieces: validPieces,
      meta: {
        mode: 'EXPRESSION',
        generatedCount: rawPieces.length,
        filteredCount: validPieces.length,
        qualityScore
      }
    };
  } catch (error) {
    console.error('[ExpressionAgent] Error:', error);
    return {
      pieces: [],
      meta: { mode: 'EXPRESSION', generatedCount: 0, filteredCount: 0, qualityScore: 0 }
    };
  }
};

export default { runExpressionAgent };
