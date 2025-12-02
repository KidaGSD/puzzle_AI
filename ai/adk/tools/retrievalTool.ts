/**
 * Retrieval Tool - ADK FunctionTool for intelligent fragment selection
 *
 * Implements relevance + diversity scoring for fragment selection.
 * Replaces fixed 6/4 sampling with scored, elastic budgets.
 */

import { FunctionTool } from "../../../../adk-typescript/src/tools/FunctionTool";
import { ToolContext } from "../../../../adk-typescript/src/tools/ToolContext";
import { RetrievalResultSchema, RetrievalScoreSchema, RetrievalToolResponse } from "../schemas/puzzleSchemas";
import { Fragment, DesignMode } from "../../../domain/models";
import { FragmentRanker, RankerConfig } from "../../retrieval/fragmentRanker";

/**
 * Default ranker configuration
 */
const DEFAULT_RANKER_CONFIG: RankerConfig = {
  totalTarget: 24,
  perQuadrant: 6,
  maxTextPerQuadrant: 4,
  maxImagePerQuadrant: 2,
  maxPerTag: 2,
  maxPerFragment: 2
};

/**
 * Rank and select fragments based on relevance, diversity, and novelty
 */
export const rankFragments = async (
  params: {
    processAim: string;
    centralQuestion?: string;
    config?: Partial<RankerConfig>;
    usedFragmentCounts?: Record<string, number>;
  },
  context: ToolContext
): Promise<RetrievalToolResponse> => {
  try {
    const session = context.invocationContext.session;
    const fragments = session.state.get('fragments', []) as Fragment[];

    if (fragments.length === 0) {
      return {
        success: false,
        error: 'No fragments available for ranking'
      };
    }

    const config = { ...DEFAULT_RANKER_CONFIG, ...params.config };
    const ranker = new FragmentRanker(config);

    // Apply novelty boost based on usage counts
    const usedCounts = params.usedFragmentCounts || {};

    const result = await ranker.rankAndSelect(fragments, params.processAim);

    // Convert to schema format
    const globalScores: RetrievalScoreSchema[] = result.global.map(r => ({
      fragmentId: r.fragment.id,
      relevanceScore: r.relevanceScore,
      diversityScore: r.diversityScore,
      noveltyScore: calculateNoveltyScore(r.fragment.id, usedCounts),
      totalScore: r.totalScore,
      reasons: r.reasons || []
    }));

    const perModeScores = new Map<DesignMode, RetrievalScoreSchema[]>();
    result.perMode.forEach((rankings, mode) => {
      perModeScores.set(mode, rankings.map(r => ({
        fragmentId: r.fragment.id,
        relevanceScore: r.relevanceScore,
        diversityScore: r.diversityScore,
        noveltyScore: calculateNoveltyScore(r.fragment.id, usedCounts),
        totalScore: r.totalScore,
        reasons: r.reasons || []
      })));
    });

    // Calculate stats
    const textCount = result.global.filter(r => r.fragment.type !== 'IMAGE').length;
    const imageCount = result.global.filter(r => r.fragment.type === 'IMAGE').length;
    const avgRelevance = result.global.reduce((sum, r) => sum + r.relevanceScore, 0) / result.global.length;
    const avgDiversity = result.global.reduce((sum, r) => sum + r.diversityScore, 0) / result.global.length;

    return {
      success: true,
      data: {
        global: globalScores,
        perMode: perModeScores,
        stats: {
          totalFragments: fragments.length,
          selectedCount: result.global.length,
          textCount,
          imageCount,
          avgRelevance,
          avgDiversity
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Fragment ranking failed: ${(error as Error).message}`
    };
  }
};

/**
 * Calculate novelty score based on usage history
 * High score = underused, low score = overused
 */
const calculateNoveltyScore = (
  fragmentId: string,
  usedCounts: Record<string, number>
): number => {
  const count = usedCounts[fragmentId] || 0;
  // Exponential decay: 1.0 at 0 uses, ~0.5 at 1 use, ~0.25 at 2 uses
  return Math.exp(-count * 0.7);
};

/**
 * Get fragments optimized for a specific quadrant/mode
 */
export const getFragmentsForMode = async (
  params: {
    mode: DesignMode;
    processAim: string;
    centralQuestion?: string;
    limit?: number;
    usedFragmentCounts?: Record<string, number>;
  },
  context: ToolContext
): Promise<RetrievalToolResponse> => {
  try {
    const session = context.invocationContext.session;
    const fragments = session.state.get('fragments', []) as Fragment[];
    const limit = params.limit || 6;

    // Mode-specific feature emphasis
    const modeFeatureWeights: Record<DesignMode, { tags: string[]; boost: number }> = {
      FORM: { tags: ['structure', 'composition', 'layout', 'shape', 'geometric', 'visual'], boost: 1.5 },
      MOTION: { tags: ['animation', 'transition', 'rhythm', 'flow', 'timing', 'movement'], boost: 1.5 },
      EXPRESSION: { tags: ['mood', 'emotion', 'tone', 'voice', 'personality', 'feeling'], boost: 1.5 },
      FUNCTION: { tags: ['purpose', 'utility', 'audience', 'constraint', 'accessibility', 'use'], boost: 1.5 }
    };

    const weights = modeFeatureWeights[params.mode];
    const usedCounts = params.usedFragmentCounts || {};

    // Score each fragment for this mode
    const scored = fragments.map(f => {
      let score = 0;
      const reasons: string[] = [];

      // Base relevance from tags
      const fragTags = (f.tags || []).map(t => t.toLowerCase());
      const matchingTags = weights.tags.filter(wt => fragTags.some(ft => ft.includes(wt)));
      if (matchingTags.length > 0) {
        score += matchingTags.length * weights.boost;
        reasons.push(`Matches ${params.mode} tags: ${matchingTags.join(', ')}`);
      }

      // Content relevance (simple keyword match)
      const content = (f.content || '').toLowerCase();
      const aimWords = params.processAim.toLowerCase().split(/\s+/);
      const contentMatches = aimWords.filter(w => w.length > 3 && content.includes(w));
      if (contentMatches.length > 0) {
        score += contentMatches.length * 0.5;
        reasons.push(`Content matches aim: ${contentMatches.slice(0, 3).join(', ')}`);
      }

      // Novelty bonus
      const novelty = calculateNoveltyScore(f.id, usedCounts);
      score += novelty * 2;
      if (novelty > 0.8) {
        reasons.push('High novelty (underused)');
      }

      // Type balance bonus
      if (f.type === 'IMAGE') {
        score += 0.5; // Slight bonus for variety
        reasons.push('Image diversity');
      }

      return {
        fragment: f,
        totalScore: score,
        relevanceScore: score / 5, // Normalize
        diversityScore: novelty,
        reasons
      };
    });

    // Sort by score and take top
    scored.sort((a, b) => b.totalScore - a.totalScore);
    const selected = scored.slice(0, limit);

    return {
      success: true,
      data: {
        global: selected.map(s => ({
          fragmentId: s.fragment.id,
          relevanceScore: s.relevanceScore,
          diversityScore: s.diversityScore,
          noveltyScore: s.diversityScore,
          totalScore: s.totalScore,
          reasons: s.reasons
        })),
        perMode: new Map([[params.mode, selected.map(s => ({
          fragmentId: s.fragment.id,
          relevanceScore: s.relevanceScore,
          diversityScore: s.diversityScore,
          noveltyScore: s.diversityScore,
          totalScore: s.totalScore,
          reasons: s.reasons
        }))]]),
        stats: {
          totalFragments: fragments.length,
          selectedCount: selected.length,
          textCount: selected.filter(s => s.fragment.type !== 'IMAGE').length,
          imageCount: selected.filter(s => s.fragment.type === 'IMAGE').length,
          avgRelevance: selected.reduce((sum, s) => sum + s.relevanceScore, 0) / selected.length,
          avgDiversity: selected.reduce((sum, s) => sum + s.diversityScore, 0) / selected.length
        }
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Mode-specific retrieval failed: ${(error as Error).message}`
    };
  }
};

/**
 * Create ADK FunctionTools for retrieval operations
 */
export const createRetrievalTools = (): FunctionTool[] => {
  return [
    new FunctionTool({
      name: 'rank_fragments',
      description: 'Rank and select fragments based on relevance, diversity, and novelty',
      fn: rankFragments,
      functionDeclaration: {
        name: 'rank_fragments',
        description: 'Score and select fragments for puzzle generation',
        parameters: {
          type: 'object',
          properties: {
            processAim: {
              type: 'string',
              description: 'The overall process aim to match against'
            },
            centralQuestion: {
              type: 'string',
              description: 'Optional central question for additional relevance scoring'
            },
            config: {
              type: 'object',
              description: 'Optional ranker configuration overrides'
            },
            usedFragmentCounts: {
              type: 'object',
              description: 'Map of fragment ID to usage count for novelty scoring'
            }
          },
          required: ['processAim']
        }
      }
    }),
    new FunctionTool({
      name: 'get_fragments_for_mode',
      description: 'Get fragments optimized for a specific quadrant mode',
      fn: getFragmentsForMode,
      functionDeclaration: {
        name: 'get_fragments_for_mode',
        description: 'Select fragments best suited for a specific quadrant',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'],
              description: 'The quadrant mode to optimize for'
            },
            processAim: {
              type: 'string',
              description: 'The overall process aim'
            },
            centralQuestion: {
              type: 'string',
              description: 'Optional central question'
            },
            limit: {
              type: 'number',
              description: 'Maximum fragments to return (default 6)'
            },
            usedFragmentCounts: {
              type: 'object',
              description: 'Usage counts for novelty scoring'
            }
          },
          required: ['mode', 'processAim']
        }
      }
    })
  ];
};
