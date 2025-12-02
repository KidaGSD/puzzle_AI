/**
 * PreGen Pool Tool - ADK FunctionTool for managing pre-generated pieces
 *
 * Tracks used texts and fragment counts to prevent repetition.
 * Provides getNextPiece logic that skips duplicates/over-quota fragments.
 */

import { FunctionTool } from "../../../../adk-typescript/src/tools/FunctionTool";
import { ToolContext } from "../../../../adk-typescript/src/tools/ToolContext";
import { PieceSchema, PreGenPoolToolResponse } from "../schemas/puzzleSchemas";
import { DesignMode } from "../../../domain/models";

/**
 * Session state keys for pool tracking
 */
const POOL_STATE_KEYS = {
  usedTexts: 'preGenPool_usedTexts',
  usedFragmentCounts: 'preGenPool_fragmentCounts',
  pool: 'preGenPool_pieces'
};

/**
 * Max pieces per fragment in a session
 */
const MAX_PIECES_PER_FRAGMENT = 2;

/**
 * Enqueue pieces to the pre-gen pool after filtering
 */
export const enqueuePieces = async (
  params: {
    mode: DesignMode;
    pieces: PieceSchema[];
  },
  context: ToolContext
): Promise<PreGenPoolToolResponse> => {
  try {
    const session = context.invocationContext.session;

    // Get current state
    const usedTexts = new Set<string>(session.state.get(POOL_STATE_KEYS.usedTexts, []));
    const fragmentCounts: Record<string, number> = session.state.get(POOL_STATE_KEYS.usedFragmentCounts, {});
    const pool: Record<DesignMode, PieceSchema[]> = session.state.get(POOL_STATE_KEYS.pool, {
      FORM: [],
      MOTION: [],
      EXPRESSION: [],
      FUNCTION: []
    });

    let enqueuedCount = 0;
    let skippedCount = 0;

    for (const piece of params.pieces) {
      const normalizedText = piece.text.toLowerCase().trim();

      // Skip if text already used
      if (usedTexts.has(normalizedText)) {
        skippedCount++;
        continue;
      }

      // Skip if fragment over quota
      if (piece.fragmentId) {
        const currentCount = fragmentCounts[piece.fragmentId] || 0;
        if (currentCount >= MAX_PIECES_PER_FRAGMENT) {
          skippedCount++;
          continue;
        }
      }

      // Add to pool
      if (!pool[params.mode]) {
        pool[params.mode] = [];
      }
      pool[params.mode].push(piece);
      enqueuedCount++;
    }

    // Update state
    session.state.set(POOL_STATE_KEYS.pool, pool);

    const totalPoolSize = Object.values(pool).reduce((sum, pieces) => sum + pieces.length, 0);

    return {
      success: true,
      data: {
        enqueuedCount,
        skippedCount,
        currentPoolSize: totalPoolSize
      }
    };
  } catch (error) {
    return {
      success: false,
      error: `Enqueue failed: ${(error as Error).message}`
    };
  }
};

/**
 * Get next piece from pool, marking it as used
 */
export const getNextPiece = async (
  params: {
    mode: DesignMode;
  },
  context: ToolContext
): Promise<{ success: boolean; piece?: PieceSchema; remaining: number }> => {
  try {
    const session = context.invocationContext.session;

    // Get current state
    const usedTexts = new Set<string>(session.state.get(POOL_STATE_KEYS.usedTexts, []));
    const fragmentCounts: Record<string, number> = session.state.get(POOL_STATE_KEYS.usedFragmentCounts, {});
    const pool: Record<DesignMode, PieceSchema[]> = session.state.get(POOL_STATE_KEYS.pool, {
      FORM: [],
      MOTION: [],
      EXPRESSION: [],
      FUNCTION: []
    });

    const modePool = pool[params.mode] || [];

    // Find first piece that isn't already used and fragment not over quota
    let selectedPiece: PieceSchema | undefined;
    let selectedIndex = -1;

    for (let i = 0; i < modePool.length; i++) {
      const piece = modePool[i];
      const normalizedText = piece.text.toLowerCase().trim();

      // Skip if already used
      if (usedTexts.has(normalizedText)) continue;

      // Skip if fragment over quota
      if (piece.fragmentId) {
        const count = fragmentCounts[piece.fragmentId] || 0;
        if (count >= MAX_PIECES_PER_FRAGMENT) continue;
      }

      selectedPiece = piece;
      selectedIndex = i;
      break;
    }

    if (!selectedPiece) {
      return { success: true, remaining: 0 };
    }

    // Mark as used
    const normalizedText = selectedPiece.text.toLowerCase().trim();
    usedTexts.add(normalizedText);
    if (selectedPiece.fragmentId) {
      fragmentCounts[selectedPiece.fragmentId] = (fragmentCounts[selectedPiece.fragmentId] || 0) + 1;
    }

    // Remove from pool
    modePool.splice(selectedIndex, 1);

    // Update state
    session.state.set(POOL_STATE_KEYS.usedTexts, Array.from(usedTexts));
    session.state.set(POOL_STATE_KEYS.usedFragmentCounts, fragmentCounts);
    session.state.set(POOL_STATE_KEYS.pool, pool);

    return {
      success: true,
      piece: selectedPiece,
      remaining: modePool.length
    };
  } catch (error) {
    return { success: false, remaining: 0 };
  }
};

/**
 * Get all pieces for a mode without consuming them
 */
export const peekPieces = async (
  params: {
    mode: DesignMode;
    limit?: number;
  },
  context: ToolContext
): Promise<{ success: boolean; pieces: PieceSchema[] }> => {
  try {
    const session = context.invocationContext.session;
    const pool: Record<DesignMode, PieceSchema[]> = session.state.get(POOL_STATE_KEYS.pool, {
      FORM: [],
      MOTION: [],
      EXPRESSION: [],
      FUNCTION: []
    });

    const modePool = pool[params.mode] || [];
    const limit = params.limit || modePool.length;

    return {
      success: true,
      pieces: modePool.slice(0, limit)
    };
  } catch (error) {
    return { success: false, pieces: [] };
  }
};

/**
 * Clear the pool for a fresh session
 */
export const clearPool = async (
  params: {},
  context: ToolContext
): Promise<{ success: boolean }> => {
  try {
    const session = context.invocationContext.session;

    session.state.set(POOL_STATE_KEYS.usedTexts, []);
    session.state.set(POOL_STATE_KEYS.usedFragmentCounts, {});
    session.state.set(POOL_STATE_KEYS.pool, {
      FORM: [],
      MOTION: [],
      EXPRESSION: [],
      FUNCTION: []
    });

    return { success: true };
  } catch (error) {
    return { success: false };
  }
};

/**
 * Get pool statistics
 */
export const getPoolStats = async (
  params: {},
  context: ToolContext
): Promise<{
  success: boolean;
  stats: {
    perMode: Record<DesignMode, number>;
    totalUsedTexts: number;
    fragmentUsage: Record<string, number>;
  };
}> => {
  try {
    const session = context.invocationContext.session;

    const usedTexts = session.state.get(POOL_STATE_KEYS.usedTexts, []) as string[];
    const fragmentCounts = session.state.get(POOL_STATE_KEYS.usedFragmentCounts, {}) as Record<string, number>;
    const pool = session.state.get(POOL_STATE_KEYS.pool, {}) as Record<DesignMode, PieceSchema[]>;

    return {
      success: true,
      stats: {
        perMode: {
          FORM: pool.FORM?.length || 0,
          MOTION: pool.MOTION?.length || 0,
          EXPRESSION: pool.EXPRESSION?.length || 0,
          FUNCTION: pool.FUNCTION?.length || 0
        },
        totalUsedTexts: usedTexts.length,
        fragmentUsage: fragmentCounts
      }
    };
  } catch (error) {
    return {
      success: false,
      stats: {
        perMode: { FORM: 0, MOTION: 0, EXPRESSION: 0, FUNCTION: 0 },
        totalUsedTexts: 0,
        fragmentUsage: {}
      }
    };
  }
};

/**
 * Create ADK FunctionTools for pool operations
 */
export const createPreGenPoolTools = (): FunctionTool[] => {
  return [
    new FunctionTool({
      name: 'enqueue_pieces',
      description: 'Add pre-generated pieces to the pool after filtering',
      fn: enqueuePieces,
      functionDeclaration: {
        name: 'enqueue_pieces',
        description: 'Enqueue pieces to the pre-gen pool, skipping duplicates',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'],
              description: 'The quadrant mode for these pieces'
            },
            pieces: {
              type: 'array',
              description: 'Pieces to enqueue'
            }
          },
          required: ['mode', 'pieces']
        }
      }
    }),
    new FunctionTool({
      name: 'get_next_piece',
      description: 'Get the next available piece from the pool',
      fn: getNextPiece,
      functionDeclaration: {
        name: 'get_next_piece',
        description: 'Get and consume the next piece for a mode',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION'],
              description: 'The quadrant mode'
            }
          },
          required: ['mode']
        }
      }
    }),
    new FunctionTool({
      name: 'peek_pieces',
      description: 'View pieces in pool without consuming them',
      fn: peekPieces,
      functionDeclaration: {
        name: 'peek_pieces',
        description: 'Preview pieces in pool for a mode',
        parameters: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['FORM', 'MOTION', 'EXPRESSION', 'FUNCTION']
            },
            limit: {
              type: 'number',
              description: 'Max pieces to return'
            }
          },
          required: ['mode']
        }
      }
    }),
    new FunctionTool({
      name: 'clear_pool',
      description: 'Clear all pieces and usage tracking',
      fn: clearPool,
      functionDeclaration: {
        name: 'clear_pool',
        description: 'Reset the pool for a new session',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    }),
    new FunctionTool({
      name: 'get_pool_stats',
      description: 'Get current pool statistics',
      fn: getPoolStats,
      functionDeclaration: {
        name: 'get_pool_stats',
        description: 'Get counts and usage stats for the pool',
        parameters: {
          type: 'object',
          properties: {}
        }
      }
    })
  ];
};
