/**
 * Feature Store Tool - ADK FunctionTool for fragment feature extraction and caching
 *
 * Wraps the existing fragmentFeatureStore with ADK tool interface.
 * Provides cached access to extracted features (keywords, themes, uniqueInsight).
 */

import { SimpleFunctionTool as FunctionTool, ToolContext } from "../types/adkTypes";
import { initFeatureStore } from "../../stores/fragmentFeatureStore";
import { FragmentFeatureSchema, FeatureStoreToolResponse } from "../schemas/puzzleSchemas";
import { Fragment } from "../../../domain/models";
import { LLMClient } from "../../adkClient";

/**
 * Get or extract features for fragments
 * Uses caching to minimize API calls
 */
export const getFragmentFeatures = async (
  params: { fragmentIds: string[]; forceRefresh?: boolean },
  context: ToolContext
): Promise<FeatureStoreToolResponse> => {
  try {
    const session = context.invocationContext.session;
    const fragments = session.state.get('fragments', []) as Fragment[];
    const client = session.state.get('llmClient') as LLMClient | undefined;

    if (!client) {
      return {
        success: false,
        error: 'LLM client not found in session state'
      };
    }

    const store = initFeatureStore(client);
    const results: FragmentFeatureSchema[] = [];
    let cacheHits = 0;
    let newExtractions = 0;

    for (const fragId of params.fragmentIds) {
      const fragment = fragments.find(f => f.id === fragId);
      if (!fragment) continue;

      // Check cache first
      const cached = store.getCachedFeatures(fragId);
      if (cached && !params.forceRefresh && cached.analysisStatus === 'complete') {
        results.push({
          fragmentId: fragId,
          analysisStatus: cached.analysisStatus || 'analyzed',
          updatedAt: cached.updatedAt || Date.now(),
          keywords: cached.combinedKeywords,
          themes: cached.textFeatures?.themes,
          entities: cached.textFeatures?.entities,
          sentiment: cached.textFeatures?.sentiment,
          palette: cached.imageFeatures?.colors,
          objects: cached.imageFeatures?.objects,
          mood: cached.imageFeatures?.mood,
          uniqueInsight: cached.uniqueInsight
        });
        cacheHits++;
      } else {
        // Extract features using getFeatures (which handles caching internally)
        const features = await store.getFeatures(fragment);
        results.push({
          fragmentId: fragId,
          analysisStatus: features.analysisStatus || 'analyzed',
          updatedAt: features.updatedAt || Date.now(),
          keywords: features.combinedKeywords,
          themes: features.textFeatures?.themes,
          entities: features.textFeatures?.entities,
          sentiment: features.textFeatures?.sentiment,
          palette: features.imageFeatures?.colors,
          objects: features.imageFeatures?.objects,
          mood: features.imageFeatures?.mood,
          uniqueInsight: features.uniqueInsight
        });
        newExtractions++;
      }
    }

    return {
      success: true,
      data: {
        features: results,
        cacheHits,
        newExtractions
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Feature extraction failed: ${(error as Error).message}`
    };
  }
};

/**
 * Create the ADK FunctionTool for feature store operations
 */
export const createFeatureStoreTool = (): FunctionTool => {
  return new FunctionTool({
    name: 'get_fragment_features',
    description: 'Extract and cache features (keywords, themes, uniqueInsight) from fragments',
    fn: getFragmentFeatures,
    functionDeclaration: {
      name: 'get_fragment_features',
      description: 'Get cached or extract new features for given fragment IDs',
      parameters: {
        type: 'object',
        properties: {
          fragmentIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of fragments to analyze'
          },
          forceRefresh: {
            type: 'boolean',
            description: 'Force re-extraction even if cached'
          }
        },
        required: ['fragmentIds']
      }
    }
  });
};

/**
 * Summarize features for a set of fragments
 */
export const summarizeFragmentFeatures = async (
  params: { fragmentIds: string[] },
  context: ToolContext
): Promise<{ success: boolean; summary: string }> => {
  const featuresResponse = await getFragmentFeatures(
    { fragmentIds: params.fragmentIds },
    context
  );

  if (!featuresResponse.success || !featuresResponse.data) {
    return { success: false, summary: '' };
  }

  const features = featuresResponse.data.features;
  const allKeywords = new Set<string>();
  const allThemes = new Set<string>();
  const insights: string[] = [];

  for (const f of features) {
    f.keywords?.forEach(k => allKeywords.add(k));
    f.themes?.forEach(t => allThemes.add(t));
    if (f.uniqueInsight) insights.push(f.uniqueInsight);
  }

  const summary = [
    `Keywords: ${Array.from(allKeywords).slice(0, 10).join(', ')}`,
    `Themes: ${Array.from(allThemes).slice(0, 5).join(', ')}`,
    insights.length > 0 ? `Insights: ${insights.slice(0, 3).join('; ')}` : ''
  ].filter(Boolean).join(' | ');

  return { success: true, summary };
};

export const createSummarizeFeaturesTool = (): FunctionTool => {
  return new FunctionTool({
    name: 'summarize_fragment_features',
    description: 'Get a concise summary of features across multiple fragments',
    fn: summarizeFragmentFeatures,
    functionDeclaration: {
      name: 'summarize_fragment_features',
      description: 'Summarize keywords, themes, and insights from fragments',
      parameters: {
        type: 'object',
        properties: {
          fragmentIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of fragments to summarize'
          }
        },
        required: ['fragmentIds']
      }
    }
  });
};
