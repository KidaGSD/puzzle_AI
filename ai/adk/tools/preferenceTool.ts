/**
 * Preference Tool - ADK FunctionTool for user preference tracking and hints
 *
 * Tracks user behavior (place, edit, discard, connect) and provides
 * hints to improve AI suggestions based on patterns.
 */

import { SimpleFunctionTool as FunctionTool, ToolContext } from "../types/adkTypes";
import { DesignMode, PuzzleType } from "../../../domain/models";
import { PreferenceHintsSchema } from "../schemas/puzzleSchemas";

// ========== Types ==========

export interface PreferenceStats {
  suggested: number;
  placed: number;
  edited: number;
  discarded: number;
  connected: number;
}

export interface PreferenceProfile {
  [key: string]: PreferenceStats; // key = `${puzzleType}_${mode}`
}

// ========== Session State Keys ==========

const PREFERENCE_STATE_KEY = 'preferenceProfile';

// ========== Read Preference Hints ==========

/**
 * Generate hints from preference profile for a specific mode/puzzleType
 */
export const readPreferenceHints = async (
  params: { mode: DesignMode; puzzleType: PuzzleType },
  context: ToolContext
): Promise<PreferenceHintsSchema> => {
  const session = context.invocationContext.session;
  const profile = session.state.get(PREFERENCE_STATE_KEY, {}) as PreferenceProfile;

  const key = `${params.puzzleType}_${params.mode}`;
  const stats = profile[key];

  const hints: string[] = [];
  let suggestedLength: 'shorter' | 'normal' | 'longer' = 'normal';
  let suggestedDiversity: 'lower' | 'normal' | 'higher' = 'normal';

  if (!stats) {
    return {
      mode: params.mode,
      puzzleType: params.puzzleType,
      hints: '',
      suggestedLength,
      suggestedDiversity
    };
  }

  // Analyze patterns and generate hints

  // High discard rate - suggestions may be too generic or off-topic
  if (stats.discarded > stats.placed && stats.discarded > 2) {
    hints.push('User often discards suggestions; keep concise and highly specific');
    suggestedLength = 'shorter';
    suggestedDiversity = 'higher'; // Try different approaches
  }

  // High edit rate - suggestions are on track but need refinement
  if (stats.edited > stats.placed / 2 && stats.edited > 1) {
    hints.push('User often edits AI suggestions; provide flexible starting points');
  }

  // High connect rate - user likes making connections
  if (stats.connected > stats.placed / 3 && stats.connected > 1) {
    hints.push('User likes connecting pieces; suggest insights that enable relationships');
  }

  // Low placement overall - be more conservative
  if (stats.suggested > 10 && stats.placed < stats.suggested * 0.3) {
    hints.push('Low acceptance rate; focus on core, obvious insights rather than creative leaps');
    suggestedDiversity = 'lower';
  }

  // High placement - user is accepting, can be more adventurous
  if (stats.suggested > 5 && stats.placed > stats.suggested * 0.7) {
    hints.push('High acceptance rate; can suggest more exploratory insights');
    suggestedDiversity = 'higher';
  }

  return {
    mode: params.mode,
    puzzleType: params.puzzleType,
    hints: hints.join('. '),
    suggestedLength,
    suggestedDiversity
  };
};

// ========== Update Preference Stats ==========

export type PreferenceAction = 'suggest' | 'place' | 'edit' | 'discard' | 'connect';

/**
 * Update preference stats after a user action
 */
export const updatePreferenceStats = async (
  params: {
    mode: DesignMode;
    puzzleType: PuzzleType;
    action: PreferenceAction;
    count?: number; // Optional count for batch updates (e.g., suggest 4 pieces)
  },
  context: ToolContext
): Promise<{ success: boolean; updatedStats: PreferenceStats }> => {
  const session = context.invocationContext.session;
  const profile = session.state.get(PREFERENCE_STATE_KEY, {}) as PreferenceProfile;

  const key = `${params.puzzleType}_${params.mode}`;
  if (!profile[key]) {
    profile[key] = {
      suggested: 0,
      placed: 0,
      edited: 0,
      discarded: 0,
      connected: 0
    };
  }

  const count = params.count || 1;
  const actionKey = params.action === 'suggest' ? 'suggested' :
                   params.action === 'place' ? 'placed' :
                   params.action === 'edit' ? 'edited' :
                   params.action === 'discard' ? 'discarded' : 'connected';

  profile[key][actionKey] += count;

  session.state.set(PREFERENCE_STATE_KEY, profile);

  console.log(`[PreferenceTool] Updated ${key}.${actionKey} += ${count}`);

  return {
    success: true,
    updatedStats: profile[key]
  };
};

// ========== Get Profile Summary ==========

/**
 * Get a summary of the preference profile for logging/debugging
 */
export const getProfileSummary = async (
  params: {},
  context: ToolContext
): Promise<{
  success: boolean;
  summary: {
    totalInteractions: number;
    acceptanceRate: number;
    editRate: number;
    topModes: string[];
  };
}> => {
  const session = context.invocationContext.session;
  const profile = session.state.get(PREFERENCE_STATE_KEY, {}) as PreferenceProfile;

  let totalSuggested = 0;
  let totalPlaced = 0;
  let totalEdited = 0;
  const modeScores: Record<string, number> = {};

  for (const [key, stats] of Object.entries(profile)) {
    totalSuggested += stats.suggested;
    totalPlaced += stats.placed;
    totalEdited += stats.edited;

    // Score = placed + edited (user engaged)
    const mode = key.split('_')[1];
    modeScores[mode] = (modeScores[mode] || 0) + stats.placed + stats.edited;
  }

  const totalInteractions = totalPlaced + totalEdited;
  const acceptanceRate = totalSuggested > 0 ? totalPlaced / totalSuggested : 0;
  const editRate = totalPlaced > 0 ? totalEdited / totalPlaced : 0;

  // Sort modes by engagement
  const topModes = Object.entries(modeScores)
    .sort((a, b) => b[1] - a[1])
    .map(([mode]) => mode);

  return {
    success: true,
    summary: {
      totalInteractions,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      editRate: Math.round(editRate * 100) / 100,
      topModes
    }
  };
};

// ========== Reset Profile ==========

/**
 * Reset preference profile for a fresh start
 */
export const resetProfile = async (
  params: {},
  context: ToolContext
): Promise<{ success: boolean }> => {
  const session = context.invocationContext.session;
  session.state.set(PREFERENCE_STATE_KEY, {});
  return { success: true };
};

// ========== Create ADK FunctionTools ==========

export const createPreferenceTools = (): FunctionTool[] => {
  return [
    new FunctionTool({
      name: 'read_preference_hints',
      description: 'Get AI generation hints based on user preference patterns',
      fn: readPreferenceHints,
      functionDeclaration: {
        name: 'read_preference_hints',
        description: 'Analyze preference profile and return generation hints',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'],
              description: 'The quadrant mode'
            },
            puzzleType: {
              type: 'string',
              enum: ['CLARIFY', 'EXPAND', 'REFINE'],
              description: 'The puzzle type'
            }
          },
          required: ['mode', 'puzzleType']
        }
      }
    }),
    new FunctionTool({
      name: 'update_preference_stats',
      description: 'Update preference stats after user action',
      fn: updatePreferenceStats,
      functionDeclaration: {
        name: 'update_preference_stats',
        description: 'Record a user action (suggest, place, edit, discard, connect)',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION']
            },
            puzzleType: {
              type: 'string',
              enum: ['CLARIFY', 'EXPAND', 'REFINE']
            },
            action: {
              type: 'string',
              enum: ['suggest', 'place', 'edit', 'discard', 'connect'],
              description: 'The user action'
            },
            count: {
              type: 'number',
              description: 'Optional count for batch updates'
            }
          },
          required: ['mode', 'puzzleType', 'action']
        }
      }
    }),
    new FunctionTool({
      name: 'get_profile_summary',
      description: 'Get summary of user preference patterns',
      fn: getProfileSummary,
      functionDeclaration: {
        name: 'get_profile_summary',
        description: 'Aggregate stats from preference profile',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    }),
    new FunctionTool({
      name: 'reset_preference_profile',
      description: 'Reset the preference profile',
      fn: resetProfile,
      functionDeclaration: {
        name: 'reset_preference_profile',
        description: 'Clear all preference data for fresh start',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    })
  ];
};
