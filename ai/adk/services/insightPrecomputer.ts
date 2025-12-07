/**
 * InsightPrecomputer - Pre-generates puzzle insights in background
 *
 * Runs periodically or when context changes.
 * Results ready for instant puzzle creation.
 *
 * Uses Pro model for strategic reasoning tasks.
 */

import { Fragment, DesignMode, PuzzleType, Anchor } from "../../../domain/models";
import { LLMClient, createProClient, JsonSchema } from "../../adkClient";
import { contextCollector, FragmentFeature } from "./contextCollector";

// ========== Types ==========

export interface PotentialQuestion {
  question: string;
  puzzleType: PuzzleType;
  primaryModes: DesignMode[];
  confidence: number;
  reasoning: string;
}

export interface EnrichedFragment {
  id: string;
  title: string;
  summary: string;
  type: 'TEXT' | 'IMAGE';
  keywords: string[];
  themes: string[];
  mood?: string;
  palette?: string[];
  objects?: string[];
  uniqueInsight?: string;
  imageUrl?: string;
}

export interface PrecomputedInsights {
  potentialQuestions: PotentialQuestion[];
  modeAssignments: Record<DesignMode, EnrichedFragment[]>;
  preferenceHints: Record<DesignMode, string>;
  timestamp: number;
  fragmentCount: number;
  isStale: boolean;
}

// ========== Schemas ==========

const QUESTION_GENERATION_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'Central question for a puzzle' },
          puzzleType: { type: 'string', enum: ['CLARIFY', 'EXPAND', 'REFINE'] },
          primaryModes: {
            type: 'array',
            items: { type: 'string', enum: ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'] }
          },
          confidence: { type: 'number', description: '0-1 confidence score' },
          reasoning: { type: 'string', description: 'Why this question is valuable' }
        },
        required: ['question', 'puzzleType', 'primaryModes', 'confidence']
      }
    }
  },
  required: ['questions']
};

// ========== InsightPrecomputer Class ==========

export class InsightPrecomputer {
  private insights: PrecomputedInsights | null = null;
  private proClient: LLMClient;
  private computing: boolean = false;
  private recomputeTimer: ReturnType<typeof setInterval> | null = null;
  private readonly RECOMPUTE_INTERVAL_MS = 15000; // 15 seconds (faster refresh)
  private readonly STALE_THRESHOLD_MS = 300000; // 5 minutes (longer validity)

  constructor() {
    this.proClient = createProClient();
    console.log('[InsightPrecomputer] Initialized with Pro model');
  }

  // ========== Public API ==========

  /**
   * Start periodic recomputation
   */
  startPeriodicRecompute(fragmentsGetter: () => Fragment[], processAim: string): void {
    if (this.recomputeTimer) {
      clearInterval(this.recomputeTimer);
    }

    // Initial computation
    this.recompute(fragmentsGetter(), processAim);

    // Periodic recomputation
    this.recomputeTimer = setInterval(() => {
      const fragments = fragmentsGetter();
      if (contextCollector.isReady && fragments.length > 0) {
        this.recompute(fragments, processAim);
      }
    }, this.RECOMPUTE_INTERVAL_MS);

    console.log(`[InsightPrecomputer] Started periodic recompute every ${this.RECOMPUTE_INTERVAL_MS / 1000}s`);
  }

  /**
   * Stop periodic recomputation
   */
  stopPeriodicRecompute(): void {
    if (this.recomputeTimer) {
      clearInterval(this.recomputeTimer);
      this.recomputeTimer = null;
    }
    console.log('[InsightPrecomputer] Stopped periodic recompute');
  }

  /**
   * Force immediate recomputation
   */
  async recompute(fragments: Fragment[], processAim: string): Promise<void> {
    if (this.computing) {
      console.log('[InsightPrecomputer] Already computing, skipping');
      return;
    }

    if (!contextCollector.isReady) {
      console.log('[InsightPrecomputer] Context not ready, skipping');
      return;
    }

    this.computing = true;
    const startTime = Date.now();
    console.log(`[InsightPrecomputer] Starting recomputation for ${fragments.length} fragments...`);

    try {
      // Step 1: Build enriched fragments from context collector
      const enrichedFragments = this.buildEnrichedFragments(fragments);

      // Step 2: Assign fragments to modes
      const modeAssignments = this.assignFragmentsToModes(enrichedFragments);

      // Step 3: Generate potential questions (uses Pro model)
      const potentialQuestions = await this.generatePotentialQuestions(
        enrichedFragments,
        processAim
      );

      // Step 4: Build preference hints (placeholder for now)
      const preferenceHints = this.buildPreferenceHints();

      this.insights = {
        potentialQuestions,
        modeAssignments,
        preferenceHints,
        timestamp: Date.now(),
        fragmentCount: fragments.length,
        isStale: false
      };

      const duration = Date.now() - startTime;
      console.log(`[InsightPrecomputer] Recomputation complete in ${duration}ms: ${potentialQuestions.length} questions`);

    } catch (error) {
      console.error('[InsightPrecomputer] Recomputation failed:', error);
    } finally {
      this.computing = false;
    }
  }

  /**
   * Get precomputed insights (instant access)
   */
  getInsights(): PrecomputedInsights | null {
    if (!this.insights) return null;

    // Mark as stale if too old
    const age = Date.now() - this.insights.timestamp;
    if (age > this.STALE_THRESHOLD_MS) {
      this.insights.isStale = true;
    }

    return this.insights;
  }

  /**
   * Check if insights are ready
   */
  get isReady(): boolean {
    return this.insights !== null && !this.insights.isStale;
  }

  // ========== Internal Methods ==========

  /**
   * Build enriched fragments from context collector cache
   */
  private buildEnrichedFragments(fragments: Fragment[]): EnrichedFragment[] {
    return fragments.map(f => {
      const features = contextCollector.getFeatures(f.id);

      return {
        id: f.id,
        title: f.title || f.summary?.slice(0, 30) || 'Untitled',
        summary: f.summary || f.content?.slice(0, 100) || '',
        type: f.type === 'IMAGE' ? 'IMAGE' : 'TEXT',
        keywords: features?.keywords || f.tags || [],
        themes: features?.themes || [],
        mood: features?.mood,
        palette: features?.palette,
        objects: features?.objects,
        uniqueInsight: features?.uniqueInsight,
        imageUrl: f.type === 'IMAGE' ? f.content : undefined
      };
    });
  }

  /**
   * Assign fragments to modes based on relevance scores
   */
  private assignFragmentsToModes(
    fragments: EnrichedFragment[]
  ): Record<DesignMode, EnrichedFragment[]> {
    const modes: DesignMode[] = ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'];
    const assignments: Record<DesignMode, EnrichedFragment[]> = {
      FORM: [],
      MOTION: [],
      EXPRESSION: [],
      FUNCTION: []
    };

    // Get relevance from context collector
    for (const mode of modes) {
      const relevantIds = contextCollector.getFragmentsForMode(mode);

      // Take top 6 fragments per mode
      const topFragments = relevantIds
        .slice(0, 6)
        .map(id => fragments.find(f => f.id === id))
        .filter((f): f is EnrichedFragment => f !== undefined);

      assignments[mode] = topFragments;
    }

    // Ensure each mode has at least 2 fragments if possible
    for (const mode of modes) {
      if (assignments[mode].length < 2) {
        // Add any unassigned fragments
        for (const fragment of fragments) {
          const isAssigned = modes.some(m =>
            assignments[m].some(f => f.id === fragment.id)
          );
          if (!isAssigned) {
            assignments[mode].push(fragment);
            if (assignments[mode].length >= 2) break;
          }
        }
      }
    }

    console.log(`[InsightPrecomputer] Mode assignments: FORM=${assignments.FORM.length}, MOTION=${assignments.MOTION.length}, EXPRESSION=${assignments.EXPRESSION.length}, FUNCTION=${assignments.FUNCTION.length}`);

    return assignments;
  }

  /**
   * Generate potential central questions using Pro model
   */
  private async generatePotentialQuestions(
    fragments: EnrichedFragment[],
    processAim: string
  ): Promise<PotentialQuestion[]> {
    if (fragments.length === 0) {
      return [];
    }

    // Build fragment summary for prompt
    const fragmentSummary = fragments.slice(0, 10).map(f => {
      const details = [
        `"${f.title}"`,
        f.keywords.length > 0 ? `keywords: ${f.keywords.slice(0, 5).join(', ')}` : '',
        f.themes.length > 0 ? `themes: ${f.themes.slice(0, 3).join(', ')}` : '',
        f.mood ? `mood: ${f.mood}` : '',
        f.uniqueInsight ? `insight: ${f.uniqueInsight}` : ''
      ].filter(Boolean).join('; ');
      return `- ${details}`;
    }).join('\n');

    const prompt = `You are a design strategist. Analyze these fragments and generate 3-5 potential central questions for a design puzzle session.

Process Aim: "${processAim}"

Fragments:
${fragmentSummary}

Generate questions that:
1. Are grounded in the fragments (cite specific concepts)
2. Help clarify design direction
3. Are actionable (team can work through them)
4. Range from tactical to strategic

For each question, specify:
- puzzleType: CLARIFY (define fundamentals), EXPAND (explore possibilities), REFINE (narrow choices)
- primaryModes: Which quadrants are most relevant (FORM, MOTION, EXPRESSION, FUNCTION)
- confidence: 0-1 score based on fragment coverage
- reasoning: Brief explanation of why this question matters`;

    try {
      const result = await this.proClient.generateStructured<{
        questions: Array<{
          question: string;
          puzzleType: PuzzleType;
          primaryModes: DesignMode[];
          confidence: number;
          reasoning?: string;
        }>;
      }>(prompt, QUESTION_GENERATION_SCHEMA, 0.7);

      return (result.questions || []).map(q => ({
        question: q.question,
        puzzleType: q.puzzleType || 'CLARIFY',
        primaryModes: q.primaryModes || ['FORM', 'EXPRESSION'],
        confidence: q.confidence || 0.5,
        reasoning: q.reasoning || ''
      }));

    } catch (error) {
      console.error('[InsightPrecomputer] Question generation failed:', error);
      // Return a default question as fallback
      return [{
        question: `How should ${processAim.slice(0, 30)} feel to users?`,
        puzzleType: 'CLARIFY',
        primaryModes: ['EXPRESSION', 'FUNCTION'],
        confidence: 0.3,
        reasoning: 'Fallback question based on process aim'
      }];
    }
  }

  /**
   * Build preference hints from user profile (placeholder)
   */
  private buildPreferenceHints(): Record<DesignMode, string> {
    // TODO: Integrate with preferenceProfile from store
    return {
      FORM: '',
      MOTION: '',
      EXPRESSION: '',
      FUNCTION: ''
    };
  }
}

// Singleton instance
export const insightPrecomputer = new InsightPrecomputer();
