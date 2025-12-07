import { ContextStore } from "../store/contextStore";
import { EventBus } from "../store/eventBus";
import { createLLMClient, createFlashClient, createProClient, LLMClient } from "./adkClient";
import { runFragmentContextAgent } from "./agents/fragmentContextAgent";
// ADK Mascot Agent (entry point) - migrated to ADK
import { runMascotSelf, runMascotSuggest } from "./adk/agents/mascotAgent";
import { runPuzzleDesignerAgent } from "./agents/puzzleDesignerAgent";
import { runQuadrantPieceAgent, FragmentContext } from "./agents/quadrantPieceAgent";
// Multi-agent system imports
import { runPuzzleSessionAgent, regenerateQuadrant as legacyRegenerateQuadrant } from "./agents/puzzleSessionAgent";
// ADK Synthesis Agent (end stage) - migrated to ADK
import { runSynthesisAgent, SynthesisInput } from "./adk/agents/synthesisAgent";
// Feature extraction for grounded AI reasoning
import {
  extractBatchFeatures,
  summarizeFeatures,
  FragmentFeatures,
} from "./agents/featureExtractionAgent";
// New scalable modules
import { initFeatureStore, getFeatureStore } from "./stores/fragmentFeatureStore";
import { FragmentRanker, toFragmentSummaries, createSelectionContext } from "./retrieval/fragmentRanker";
import { applyDiversityPipeline, logDiversityStats } from "./agents/outputValidation";
// ADK Integration
import {
  startPuzzleSession as adkStartPuzzleSession,
  regenerateQuadrant as adkRegenerateQuadrant,
  synthesizePuzzle as adkSynthesizePuzzle
} from "./adk";
import {
  Fragment,
  UIEvent,
  UIEventType,
  DesignMode,
  PuzzleType,
  UserPreferenceProfile,
  PreferenceStats,
  PuzzleSessionInput,
  PuzzleSessionState,
  FragmentSummary,
  Anchor,
  AIErrorPayload,
  AILoadingPayload,
  Puzzle,
} from "../domain/models";
import { usePuzzleSessionStateStore } from "../store/puzzleSessionStateStore";
import { MascotProposal } from "./adk/agents/mascotAgent";
import { useGameStore } from "../store/puzzleSessionStore";
import { COLORS, ALL_SHAPES, getSequentialShape } from "../constants/puzzleGrid";
import { getSequentialColor } from "../constants/colors";
import { QuadrantType, PieceCategoryType } from "../types";
import { v4 as uuidv4 } from "uuid";

// Callback type for mascot proposals - passed in to avoid circular dependency
type MascotProposalCallback = (proposal: MascotProposal) => void;

// ADK is now the primary workflow - no feature flag needed
// Legacy code kept temporarily for reference but not executed
const USE_ADK_WORKFLOW = true;

type DebouncedFn = (() => void) & { cancel?: () => void };

const debounce = (fn: () => void, delay: number): DebouncedFn => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapper = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, delay);
  };
  wrapper.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return wrapper;
};

// Module-level callback storage (set from runtime.ts)
let mascotProposalCallback: MascotProposalCallback | null = null;

export const setMascotCallback = (callback: MascotProposalCallback) => {
  mascotProposalCallback = callback;
};

const notifyMascotProposal = (proposal: MascotProposal) => {
  if (mascotProposalCallback) {
    mascotProposalCallback(proposal);
  }
};

/**
 * Sanitize mascot rationale to replace any fragment IDs with titles.
 * This is a safety net in case the AI outputs IDs despite prompt instructions.
 */
const sanitizeMascotRationale = (
  rationale: string,
  fragments: Array<{ id: string; title: string }>
): string => {
  let result = rationale;

  // Replace any fragment IDs with their titles
  fragments.forEach(f => {
    if (f.id && f.title) {
      // Match the exact ID (case-insensitive)
      const idPattern = new RegExp(f.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      result = result.replace(idPattern, `"${f.title}"`);
    }
  });

  // Catch any remaining UUID-like strings (both with and without hyphens)
  // UUID format: 8-4-4-4-12 or 32 hex chars without hyphens
  const uuidWithHyphensPattern = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
  const uuidWithoutHyphensPattern = /\b[a-f0-9]{32}\b/gi;

  result = result.replace(uuidWithHyphensPattern, '[fragment]');
  result = result.replace(uuidWithoutHyphensPattern, '[fragment]');

  return result;
};

export const attachOrchestrator = (bus: EventBus, store: ContextStore) => {
  console.log('[orchestrator] Attaching orchestrator to eventBus...');

  // Tiered client system:
  // - flashClient: Fast/cheap for most tasks (text extraction, piece generation, mascot)
  // - proClient: Complex reasoning (synthesis, central question generation)
  // - imageClient: Image analysis (gemini-3-pro-image)
  const flashClient = createFlashClient();
  const proClient = createProClient();
  const imageClient = createLLMClient('image');
  const client = flashClient; // Default to flash for backward compatibility

  console.log(`[orchestrator] Using tiered models: flash=${flashClient.model}, pro=${proClient.model}, image=${imageClient.model}`);

  const handleFragmentBurst = async () => {
    const state = store.getState();
    const ctxFragments = state.fragments.map(f => ({
      id: f.id,
      type: f.type,
      content: f.content,
      summary: f.summary,
      tags: f.tags,
    }));
    const result = await runFragmentContextAgent(
      {
        processAim: state.project.processAim,
        fragments: ctxFragments,
        existingClusters: state.clusters,
      },
      client,
      state.fragments as Fragment[],
    );
    store.setState(draft => {
      result.fragments.forEach(f => {
        const idx = draft.fragments.findIndex(df => df.id === f.id);
        if (idx >= 0) {
          draft.fragments[idx].summary = f.summary;
          draft.fragments[idx].tags = f.tags;
        }
      });
      if (result.clusters) {
        draft.clusters = result.clusters;
      }
    });
  };

  const debouncedFragments = debounce(handleFragmentBurst, 500);

  const handleMascot = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};

    // Emit loading state
    bus.emitType("AI_LOADING", {
      source: 'mascot',
      message: payload.action === "suggest_puzzle" ? 'Analyzing your canvas...' : 'Thinking about your question...',
    } as AILoadingPayload);

    try {
      // Build fragment details for sanitization (used in both paths)
      const fragmentsForSanitization = state.fragments.slice(0, 5).map(f => ({
        id: f.id,
        title: f.title || f.summary?.slice(0, 30) || "Untitled",
      }));

      if (payload.action === "start_from_my_question") {
        const proposal = await runMascotSelf(
          {
            processAim: state.project.processAim,
            userQuestion: payload.userQuestion || "",
            nearbyFragments: state.fragments.slice(0, 4).map(f => ({ summary: f.summary || f.content, tags: f.tags || [] })),
            puzzleSummaries: state.puzzleSummaries.slice(0, 4).map(s => ({ id: s.puzzleId, title: s.title || "", oneLine: s.oneLine || s.directionStatement })),
            preferenceHints: "", // placeholder from preference profile
          },
          client,
        );
        console.info("[mascot:self]", proposal);

        // Sanitize rationale to replace any IDs with titles
        const sanitizedRationale = sanitizeMascotRationale(
          proposal.rationale || "",
          fragmentsForSanitization
        );

        // Emit success
        bus.emitType("AI_SUCCESS", { source: 'mascot', message: 'Puzzle suggestion ready!' });

        // Notify UI with the proposal (using module-level callback)
        notifyMascotProposal({
          ...proposal,
          rationale: sanitizedRationale,
        });
      } else if (payload.action === "suggest_puzzle") {
        // Pass fragment details for insightful reasoning
        const fragmentDetails = state.fragments.slice(0, 5).map(f => ({
          id: f.id,
          title: f.title || f.summary?.slice(0, 30) || "Untitled",
          summary: f.summary || f.content.slice(0, 100),
          tags: f.tags,
        }));

        const suggestion = await runMascotSuggest(
          {
            processAim: state.project.processAim,
            clusters: state.clusters.map(c => ({ id: c.id, theme: c.theme, fragmentCount: c.fragmentIds.length })),
            puzzleSummaries: state.puzzleSummaries.slice(0, 4).map(s => ({ id: s.puzzleId, title: s.title || "", oneLine: s.oneLine || s.directionStatement })),
            preferenceHints: "",
            fragments: fragmentDetails,
          },
          client,
        );
        console.info("[mascot:suggest]", suggestion);

        // Emit success
        bus.emitType("AI_SUCCESS", { source: 'mascot', message: 'Analysis complete!' });

        // If AI suggests a puzzle, notify UI
        if (suggestion.shouldSuggest && suggestion.centralQuestion) {
          // Sanitize rationale to replace any IDs with titles
          const sanitizedRationale = sanitizeMascotRationale(
            suggestion.rationale || "",
            fragmentDetails
          );

          notifyMascotProposal({
            centralQuestion: suggestion.centralQuestion,
            puzzleType: suggestion.puzzleType || "CLARIFY",
            primaryModes: suggestion.primaryModes || [],
            rationale: sanitizedRationale,
          });
        }
      }
    } catch (error) {
      console.error("[orchestrator] Mascot failed:", error);

      // Emit error state
      bus.emitType("AI_ERROR", {
        source: 'mascot',
        message: 'Mascot couldn\'t process your request. Please try again.',
        recoverable: true,
        retryEventType: 'MASCOT_CLICKED',
        retryPayload: payload,
      } as AIErrorPayload);
    }
  };

  const handlePuzzleFinish = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};
    const puzzleId = payload.puzzleId || state.puzzles[0]?.id;
    if (!puzzleId) return;

    // Emit loading state
    bus.emitType("AI_LOADING", {
      source: 'synthesis',
      message: 'Generating puzzle summary...',
    } as AILoadingPayload);

    // Get puzzle info
    const puzzle = state.puzzles.find(p => p.id === puzzleId);
    const puzzleType: PuzzleType = puzzle?.type || 'CLARIFY';

    // Get anchors from puzzleSessionStateStore (new anchor system)
    const sessionStateStore = usePuzzleSessionStateStore.getState();
    const sessionAnchors = sessionStateStore.getAnchors();

    // Get placed pieces from game store
    const gameStore = useGameStore.getState();
    const placedPieces = gameStore.pieces.map(p => ({
      quadrant: p.quadrant,
      text: p.text || p.title || '',
      content: p.content,
      userAnnotation: undefined, // Future: add user annotations
    }));

    console.info("[orchestrator] PUZZLE_FINISH_CLICKED", {
      puzzleId,
      puzzleType,
      anchors: sessionAnchors.length,
      pieces: placedPieces.length,
    });

    try {
      // Build input for ADK synthesis agent
      const synthesisInput: SynthesisInput = {
        puzzleId,
        puzzleType,
        centralQuestion: payload.centralQuestion || puzzle?.centralQuestion || "What is the core question?",
        processAim: state.project.processAim,
        anchors: sessionAnchors,
        placedPieces,
      };

      // Run ADK synthesis agent (use proClient for complex reasoning)
      const summary = await runSynthesisAgent(synthesisInput, proClient);

      // Store summary
      store.setState(draft => {
        draft.puzzleSummaries = draft.puzzleSummaries.filter(s => s.puzzleId !== puzzleId);
        draft.puzzleSummaries.push(summary);

        // Mark fragments as linked to this puzzle
        if (Array.isArray(payload.fragmentIds)) {
          payload.fragmentIds.forEach((fid: string) => {
            const frag = draft.fragments.find(f => f.id === fid);
            if (!frag) return;
            const labels = new Set(frag.labels || []);
            labels.add(puzzleId);
            frag.labels = Array.from(labels);
          });
        }
      });

      console.info("[orchestrator] puzzle summary stored", summary);

      // Emit success
      bus.emitType("AI_SUCCESS", { source: 'synthesis', message: 'Summary generated!' });

      // Emit event for UI to show popup (handled by runtime.ts or App.tsx)
      bus.emit({
        type: 'PUZZLE_SESSION_COMPLETED',
        payload: {
          puzzleId,
          summary,
        },
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("[orchestrator] puzzle summarize failed", err);

      // Emit error
      bus.emitType("AI_ERROR", {
        source: 'synthesis',
        message: 'Failed to generate puzzle summary.',
        recoverable: true,
        retryEventType: 'PUZZLE_FINISH_CLICKED',
        retryPayload: payload,
      } as AIErrorPayload);
    }
  };

  const handleQuadrantPiece = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};

    // Get current puzzle and its type
    const currentPuzzle = state.puzzles[0];
    const puzzleId = payload.puzzle?.id || currentPuzzle?.id || "p1";
    // Get puzzleType from the SESSION - default to CLARIFY if not set
    const puzzleType: PuzzleType = currentPuzzle?.type || payload.puzzleType || "CLARIFY";
    const existingPieceId = payload.pieceId;

    // Prepare fragment context for AI
    const fragments: FragmentContext[] = state.fragments.slice(0, 8).map(f => ({
      id: f.id,
      type: f.type,
      content: f.content,
      summary: f.summary,
      tags: f.tags,
    }));

    // Build preference hint from profile - now using puzzleType + mode
    const preferenceKey = `${puzzleType}_${payload.mode}`;
    const stats = state.preferenceProfile[preferenceKey];
    let preferenceHint = payload.preferenceHint || "";
    if (stats) {
      if (stats.discarded > stats.placed) {
        preferenceHint += " User often discards this type; keep suggestions concise.";
      }
      if (stats.edited > stats.placed / 2) {
        preferenceHint += " User often edits AI suggestions; provide starting points.";
      }
    }

    console.log(`[orchestrator] PIECE_CREATED: mode=${payload.mode}, puzzleType=${puzzleType}, pieceId=${existingPieceId || 'new'}, fragments=${fragments.length}`);

    const output = await runQuadrantPieceAgent(
      {
        processAim: state.project.processAim,
        mode: payload.mode,
        puzzleType, // Pass session's puzzle type
        puzzle: { id: puzzleId, centralQuestion: currentPuzzle?.centralQuestion || "What is the core question?", type: puzzleType },
        anchors: payload.anchors || [],
        existingPiecesForMode: payload.existingPiecesForMode || [],
        preferenceHint,
        fragments,
      },
      client,
    );

    console.log(`[orchestrator] AI returned ${output.pieces.length} pieces`);

    // Get quadrant info for visual pieces
    const mode = payload.mode as DesignMode;
    const quadrant = mode.toLowerCase() as QuadrantType;

    // Get current attachment count for sequential color/shape
    const gameStore = useGameStore.getState();
    const attachmentCount = gameStore.getQuadrantAttachmentCount(quadrant);

    // If we have an existing piece ID, update it instead of creating new
    if (existingPieceId && output.pieces.length > 0) {
      const firstPiece = output.pieces[0];
      // Use text field as the main content (the question/prompt)
      const text = firstPiece.text || firstPiece.title || "What's the key insight?";

      // Update the visual piece
      gameStore.updatePieceText(existingPieceId, text);

      console.log(`[orchestrator] Updated existing piece: ${existingPieceId} with text: "${text}"`);

      // Store in domain layer
      store.setState(draft => {
        draft.puzzlePieces.push({
          id: existingPieceId,
          puzzleId,
          mode: firstPiece.mode,
          text,
          userAnnotation: "",
          anchorIds: [],
          fragmentLinks: firstPiece.fragmentId ? [{ fragmentId: firstPiece.fragmentId, puzzlePieceId: existingPieceId }] : [],
          source: "AI",
          status: "PLACED",
        });
      });

      return;
    }

    // Otherwise, create new pieces
    output.pieces.forEach((p, index) => {
      const pieceId = uuidv4();
      // Use sequential shape based on current attachment count + index
      const pieceAttachmentIndex = attachmentCount + index;
      const shape = getSequentialShape(pieceAttachmentIndex);
      // Use text field as the main content (the declarative statement)
      const text = p.text || p.title || "Key insight here";

      // Get sequential color for this specific piece
      const pieceColor = getSequentialColor(mode, pieceAttachmentIndex);

      // Find a valid position for this piece based on quadrant
      const position = findValidPosition(quadrant, shape, gameStore);

      if (position) {
        // Add to visual layer (puzzleSessionStore) with ALL fragment fields
        gameStore.addPiece({
          id: pieceId,
          quadrant,
          color: pieceColor,
          position,
          cells: shape,
          text,
          source: 'ai',
          priority: p.priority,
          // ═══════════════════════════════════════════════════════════
          // SOURCE FRAGMENT FIELDS (for summary popup - distinct from title!)
          // ═══════════════════════════════════════════════════════════
          fragmentId: p.fragmentId,
          fragmentTitle: p.fragmentTitle,
          fragmentSummary: p.fragmentSummary,
          imageUrl: p.imageUrl,
        });

        // Increment attachment count for this quadrant
        gameStore.incrementQuadrantAttachment(quadrant);

        console.log(`[orchestrator] Created visual piece #${pieceAttachmentIndex + 1}: ${pieceId} at (${position.x}, ${position.y}) - "${text}" with color ${pieceColor} (fragment: ${p.fragmentId || 'none'})`);
      }

      // Also store in domain layer for persistence
      store.setState(draft => {
        draft.puzzlePieces.push({
          id: pieceId,
          puzzleId,
          mode: p.mode,
          text,
          userAnnotation: "",
          anchorIds: [],
          fragmentLinks: p.fragmentId ? [{ fragmentId: p.fragmentId, puzzlePieceId: pieceId }] : [],
          source: "AI",
          status: "PLACED",
        });
      });
    });
  };

  // Helper to find a valid position for a piece in a quadrant
  const findValidPosition = (
    quadrant: QuadrantType,
    shape: { x: number; y: number }[],
    gameStore: ReturnType<typeof useGameStore.getState>
  ): { x: number; y: number } | null => {
    // Define starting positions based on quadrant (near center card edges)
    const startPositions: Record<QuadrantType, { x: number; y: number; dx: number; dy: number }> = {
      form: { x: -3, y: -2, dx: -1, dy: 0 },       // Left side, move left
      motion: { x: 2, y: -2, dx: 1, dy: 0 },       // Right side, move right
      expression: { x: -3, y: 1, dx: -1, dy: 1 },  // Bottom-left, move down-left
      function: { x: 2, y: 1, dx: 1, dy: 1 },      // Bottom-right, move down-right
    };

    const start = startPositions[quadrant];
    const maxAttempts = 20;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Spiral outward from starting position
      const offsetX = attempt % 5;
      const offsetY = Math.floor(attempt / 5);
      const testPos = {
        x: start.x + start.dx * offsetX,
        y: start.y + start.dy * offsetY,
      };

      if (gameStore.isValidDrop(testPos, shape)) {
        return testPos;
      }
    }

    // Fallback: try positions further out
    for (let x = -8; x <= 8; x++) {
      for (let y = -6; y <= 6; y++) {
        // Skip if not in the right quadrant
        if (quadrant === 'form' && x >= 0) continue;
        if (quadrant === 'motion' && x < 0) continue;
        if (quadrant === 'expression' && (x >= 0 || y < 0)) continue;
        if (quadrant === 'function' && (x < 0 || y < 0)) continue;

        if (gameStore.isValidDrop({ x, y }, shape)) {
          return { x, y };
        }
      }
    }

    return null; // Could not find valid position
  };

  // Helper to create default preference stats
  const createDefaultStats = (): PreferenceStats => ({
    suggested: 0,
    placed: 0,
    edited: 0,
    discarded: 0,
    connected: 0,
  });

  // Helper to get preference key from puzzleType and mode
  const getPreferenceKey = (puzzleType: string, mode: string): string => {
    return `${puzzleType}_${mode}`;
  };

  // Handle piece placed event - update preference profile
  const handlePiecePlaced = (event: UIEvent) => {
    const payload: any = event.payload || {};
    const { mode, source } = payload;
    if (!mode) return;

    // Get puzzleType from current session
    const currentPuzzle = store.getState().puzzles[0];
    const puzzleType = currentPuzzle?.type || "CLARIFY";

    const key = getPreferenceKey(puzzleType, mode);
    console.log(`[orchestrator] PIECE_PLACED: ${key}, source: ${source}`);

    store.setState(draft => {
      if (!draft.preferenceProfile[key]) {
        draft.preferenceProfile[key] = createDefaultStats();
      }
      draft.preferenceProfile[key].placed += 1;

      // If AI-suggested piece was placed, also increment suggested counter
      if (source === 'AI') {
        draft.preferenceProfile[key].suggested += 1;
      }
    });

    // Log piece event
    store.addPieceEvent({
      pieceId: payload.pieceId,
      type: source === 'AI' ? 'CREATE_SUGGESTED' : 'CREATE_USER',
      timestamp: Date.now(),
    });
    store.addPieceEvent({
      pieceId: payload.pieceId,
      type: 'PLACE',
      timestamp: Date.now(),
    });
  };

  // Handle piece edited event - update preference profile
  const handlePieceEdited = (event: UIEvent) => {
    const payload: any = event.payload || {};
    const { pieceId } = payload;
    if (!pieceId) return;

    // Find the piece to get its mode, get puzzleType from session
    const state = store.getState();
    const piece = state.puzzlePieces.find(p => p.id === pieceId);
    if (!piece) return;

    const currentPuzzle = state.puzzles.find(p => p.id === piece.puzzleId) || state.puzzles[0];
    const puzzleType = currentPuzzle?.type || "CLARIFY";

    const key = getPreferenceKey(puzzleType, piece.mode);
    console.log(`[orchestrator] PIECE_EDITED: ${key}`);

    store.setState(draft => {
      if (!draft.preferenceProfile[key]) {
        draft.preferenceProfile[key] = createDefaultStats();
      }
      draft.preferenceProfile[key].edited += 1;
    });

    // Log piece event
    store.addPieceEvent({
      pieceId,
      type: 'EDIT_TEXT',
      timestamp: Date.now(),
    });
  };

  // Handle piece deleted event - update preference profile
  const handlePieceDeleted = (event: UIEvent) => {
    const payload: any = event.payload || {};
    const { pieceId, mode } = payload;
    if (!mode) return;

    // Get puzzleType from current session
    const currentPuzzle = store.getState().puzzles[0];
    const puzzleType = currentPuzzle?.type || "CLARIFY";

    const key = getPreferenceKey(puzzleType, mode);
    console.log(`[orchestrator] PIECE_DELETED: ${key}`);

    store.setState(draft => {
      if (!draft.preferenceProfile[key]) {
        draft.preferenceProfile[key] = createDefaultStats();
      }
      draft.preferenceProfile[key].discarded += 1;
    });

    // Log piece event
    if (pieceId) {
      store.addPieceEvent({
        pieceId,
        type: 'DELETE',
        timestamp: Date.now(),
      });
    }
  };

  // ========== Reactive Replenishment ==========

  // Debounced replenish timers per quadrant
  const replenishTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  const REPLENISH_DEBOUNCE_MS = 500;
  const REPLENISH_BATCH_SIZE = 4;

  /**
   * Handle QUADRANT_REPLENISH_NEEDED - debounced replenishment for a single quadrant
   */
  const handleQuadrantReplenishNeeded = async (event: UIEvent) => {
    const payload: any = event.payload || {};
    const quadrant = payload.quadrant as QuadrantType;

    if (!quadrant) {
      console.error("[orchestrator] QUADRANT_REPLENISH_NEEDED: missing quadrant");
      return;
    }

    // Clear existing timer for this quadrant (debounce)
    if (replenishTimers[quadrant]) {
      clearTimeout(replenishTimers[quadrant]);
    }

    // Set new debounced timer
    replenishTimers[quadrant] = setTimeout(async () => {
      delete replenishTimers[quadrant];
      await executeQuadrantReplenish(quadrant);
    }, REPLENISH_DEBOUNCE_MS);

    console.log(`[orchestrator] QUADRANT_REPLENISH_NEEDED: scheduled replenish for ${quadrant} (debounced ${REPLENISH_DEBOUNCE_MS}ms)`);
  };

  /**
   * Execute the actual replenishment for a quadrant
   */
  const executeQuadrantReplenish = async (quadrant: QuadrantType) => {
    const state = store.getState();
    const sessionStore = usePuzzleSessionStateStore.getState();
    const sessionState = sessionStore.sessionState;

    if (!sessionState) {
      console.log(`[orchestrator] Cannot replenish ${quadrant} - no active session`);
      return;
    }

    // Check if already replenishing
    if (sessionStore.replenishingQuadrants.has(quadrant)) {
      console.log(`[orchestrator] Already replenishing ${quadrant}, skipping`);
      return;
    }

    // Mark as replenishing
    sessionStore.startReplenishing(quadrant);

    console.log(`[orchestrator] Executing replenish for ${quadrant}...`);

    try {
      const mode = quadrant.toUpperCase() as DesignMode;

      // Get existing pieces to avoid duplicates (map to PieceSchema format)
      const existingPiecesRaw = sessionStore.preGeneratedPieces[quadrant]
        .filter(p => !p.used)
        .map(p => ({
          text: p.text || '',
          priority: p.priority || 3,
          saturationLevel: 'HIGH',
          mode,
          fragmentId: p.fragment_id,
          fragmentTitle: p.fragment_title,
          fragmentSummary: p.fragment_summary || '',
          imageUrl: p.image_url,
        }));
      // Cast to PieceSchema[] to satisfy TypeScript
      const existingPieces = existingPiecesRaw as any[];

      // Build anchors from session store
      const sessionAnchors = sessionStore.getAnchors();

      // Use ADK regenerate function with correct signature
      const result = await adkRegenerateQuadrant(
        mode,
        {
          puzzle_type: sessionState.puzzle_type,
          central_question: sessionState.central_question
        },
        state.fragments,
        sessionAnchors,
        existingPieces,
        state.preferenceProfile,
        state.project.processAim,
        client
      );

      // Add pieces to pool - map from PieceSchema to PreGeneratedPiece format
      const piecesToAdd = result.pieces.map(p => ({
        text: p.text,
        priority: p.priority,
        saturation_level: p.saturationLevel,
        fragment_id: p.fragmentId,
        fragment_title: p.fragmentTitle,
        fragment_summary: p.fragmentSummary,
        image_url: p.imageUrl,
        mode,
        used: false,
      }));

      sessionStore.finishReplenishing(quadrant, piecesToAdd);

      console.log(`[orchestrator] Replenished ${quadrant} with ${piecesToAdd.length} new pieces`);

      // Emit success event for UI feedback
      bus.emitType("AI_SUCCESS", {
        source: 'puzzle_session',
        message: `Added ${piecesToAdd.length} new pieces to ${quadrant}`,
      });

    } catch (error) {
      console.error(`[orchestrator] Replenish failed for ${quadrant}:`, error);

      // Remove from replenishing state on error
      sessionStore.finishReplenishing(quadrant, []);

      // Emit error (recoverable) - use valid source type
      bus.emitType("AI_ERROR", {
        source: 'puzzle_session',
        message: `Failed to generate more ${quadrant} pieces`,
        recoverable: true,
        retryEventType: 'QUADRANT_REPLENISH_NEEDED' as any,
        retryPayload: { quadrant },
      } as AIErrorPayload);
    }
  };

  // ========== Multi-Agent System Handlers ==========

  // Callback for puzzle session state updates
  let puzzleSessionCallback: ((state: PuzzleSessionState) => void) | null = null;

  /**
   * Handle PUZZLE_SESSION_STARTED - Thin adapter to ADK workflow
   *
   * This is now the primary handler. It:
   * 1. Maps UI event payload to ADK runner input
   * 2. Calls ADK runner (which handles all AI logic)
   * 3. Maps ADK output back to UI-compatible format
   * 4. Emits events for UI updates
   */
  const handlePuzzleSessionStartedADK = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};

    // Emit loading state
    bus.emitType("AI_LOADING", {
      source: 'puzzle_session',
      message: 'Generating puzzle...',
    } as AILoadingPayload);

    const puzzleType: PuzzleType = payload.puzzleType || "CLARIFY";
    const anchors = payload.anchors || [];
    // Use existing puzzleId if provided (prevents duplicate card creation)
    const existingPuzzleId: string | undefined = payload.puzzleId;

    console.log(`[orchestrator] ⚡⚡⚡ PUZZLE_SESSION_STARTED: type=${puzzleType}, fragments=${state.fragments.length}`);
    console.log(`[orchestrator] ⚡⚡⚡ existingPuzzleId from payload: ${existingPuzzleId || 'NOT PROVIDED'}`);
    console.log(`[orchestrator] ⚡⚡⚡ centralQuestion from payload: ${payload.centralQuestion || 'NOT PROVIDED'}`);

    try {
      // ===== ADK RUNNER CALL =====
      // This single call handles:
      // - Feature extraction
      // - Central question generation
      // - Per-mode fragment retrieval
      // - Quadrant agent execution (real LlmAgent)
      // - Diversity filtering
      // - PreGen pool tracking
      const result = await adkStartPuzzleSession({
        processAim: state.project.processAim,
        puzzleType,
        centralQuestion: payload.centralQuestion,
        existingPuzzleId, // Pass existing ID to prevent duplicate creation
        fragments: state.fragments,
        anchors,
        preferenceProfile: state.preferenceProfile
      }, client);

      // ===== STORE UPDATE =====
      const sessionState = result.sessionState;
      store.addPuzzle({
        id: sessionState.session_id,
        centralQuestion: sessionState.central_question,
        projectId: state.project.id,
        type: sessionState.puzzle_type,
        createdFrom: 'ai_suggested',
        createdAt: Date.now(),
      });

      console.log(`[orchestrator] Puzzle generated: "${sessionState.central_question}" (quality: ${sessionState.quality_score})`);

      // DEBUG: Log pre_gen_pieces from ADK
      console.log(`[orchestrator DEBUG] pre_gen_pieces from ADK:`);
      console.log(`  FORM: ${sessionState.pre_gen_pieces?.FORM?.length || 0} pieces`);
      console.log(`  MOTION: ${sessionState.pre_gen_pieces?.MOTION?.length || 0} pieces`);
      console.log(`  EXPRESSION: ${sessionState.pre_gen_pieces?.EXPRESSION?.length || 0} pieces`);
      console.log(`  FUNCTION: ${sessionState.pre_gen_pieces?.FUNCTION?.length || 0} pieces`);
      if (sessionState.pre_gen_pieces?.FORM?.length) {
        console.log(`  FORM first piece: ${JSON.stringify(sessionState.pre_gen_pieces.FORM[0])}`);
      }

      // ===== OUTPUT MAPPING =====
      // Transform ADK schema to legacy UI format
      const mapPieces = (pieces: any[], mode: DesignMode) =>
        (pieces || []).map(p => ({
          text: p.text,
          priority: p.priority,
          saturation_level: p.saturationLevel,
          fragment_id: p.fragmentId,
          fragment_title: p.fragmentTitle,
          fragment_summary: p.fragmentSummary,
          image_url: p.imageUrl,
          mode,
        }));

      const legacySessionState: PuzzleSessionState = {
        session_id: sessionState.session_id,
        puzzle_type: sessionState.puzzle_type,
        central_question: sessionState.central_question,
        process_aim: state.project.processAim,
        anchors,
        form_pieces: mapPieces(sessionState.pre_gen_pieces.FORM, 'FORM'),
        motion_pieces: mapPieces(sessionState.pre_gen_pieces.MOTION, 'MOTION'),
        expression_pieces: mapPieces(sessionState.pre_gen_pieces.EXPRESSION, 'EXPRESSION'),
        function_pieces: mapPieces(sessionState.pre_gen_pieces.FUNCTION, 'FUNCTION'),
        generation_status: 'completed',
      };

      // DEBUG: Log mapped pieces going to UI
      console.log(`[orchestrator DEBUG] Mapped pieces for UI:`);
      console.log(`  form_pieces: ${legacySessionState.form_pieces.length} - ${legacySessionState.form_pieces.slice(0, 2).map(p => p.text).join(', ')}`);
      console.log(`  motion_pieces: ${legacySessionState.motion_pieces.length} - ${legacySessionState.motion_pieces.slice(0, 2).map(p => p.text).join(', ')}`);
      console.log(`  expression_pieces: ${legacySessionState.expression_pieces.length} - ${legacySessionState.expression_pieces.slice(0, 2).map(p => p.text).join(', ')}`);
      console.log(`  function_pieces: ${legacySessionState.function_pieces.length} - ${legacySessionState.function_pieces.slice(0, 2).map(p => p.text).join(', ')}`);

      // ===== UI NOTIFICATION =====
      if (puzzleSessionCallback) {
        puzzleSessionCallback(legacySessionState);
      }

      bus.emitType("PUZZLE_SESSION_GENERATED" as UIEventType, {
        sessionState: legacySessionState,
        errors: result.errors,
      });

      bus.emitType("AI_SUCCESS", {
        source: 'puzzle_session',
        message: 'Puzzle pieces ready!',
      });

    } catch (error) {
      console.error("[orchestrator] PUZZLE_SESSION_STARTED failed:", error);

      // CRITICAL: Reset generating state so user can retry
      usePuzzleSessionStateStore.getState().setGenerating(false);

      bus.emitType("AI_ERROR", {
        source: 'puzzle_session',
        message: 'Failed to generate puzzle pieces. Please try again.',
        recoverable: true,
        retryEventType: 'PUZZLE_SESSION_STARTED',
        retryPayload: payload,
      } as AIErrorPayload);
    }
  };

  /**
   * Handle PUZZLE_SESSION_STARTED - triggers full puzzle pre-generation (Legacy)
   * This runs the PuzzleSessionAgent which:
   * 1. Extracts features from fragments (keywords, themes, etc.)
   * 2. Generates central question grounded in fragment features
   * 3. Runs 4 quadrant agents in parallel with feature context
   * 4. Returns pre-generated pieces for all quadrants
   */
  const handlePuzzleSessionStartedLegacy = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};

    // Emit loading state
    bus.emitType("AI_LOADING", {
      source: 'puzzle_session',
      message: 'Analyzing fragments...',
    } as AILoadingPayload);

    // ========== Phase 2: Feature Extraction with Caching ==========
    // Use the feature store for cached extraction, reducing API costs
    // Pass imageClient for image analysis (gemini-3-pro-image)
    initFeatureStore(client, imageClient);

    // ═══════════════════════════════════════════════════════════════════════
    // INTELLIGENT FRAGMENT RANKING: Replace fixed 6/4 with scored selection
    // Ranks by relevance, diversity, and novelty - not arbitrary slicing
    // ═══════════════════════════════════════════════════════════════════════
    const allFragments = state.fragments;
    const processAim = state.project.processAim;

    console.log(`[orchestrator] Starting intelligent ranking for ${allFragments.length} fragments`);

    // Use FragmentRanker for diverse, relevant selection
    const ranker = new FragmentRanker({
      totalTarget: 24,       // More fragments for variety
      perQuadrant: 6,
      maxTextPerQuadrant: 4,
      maxImagePerQuadrant: 2,
      maxPerTag: 2,          // Diversity: max 2 per tag
      maxPerFragment: 2,     // Quota: max 2 pieces per fragment
    });

    let rankedSelection: Awaited<ReturnType<typeof ranker.rankAndSelect>> | null = null;
    let fragmentsToAnalyze: Fragment[] = [];

    try {
      rankedSelection = await ranker.rankAndSelect(allFragments, processAim);
      // Collect unique fragments from global + all modes
      const selectedIds = new Set<string>();
      rankedSelection.global.forEach(r => selectedIds.add(r.fragment.id));
      rankedSelection.perMode.forEach(fragments => {
        fragments.forEach(r => selectedIds.add(r.fragment.id));
      });
      fragmentsToAnalyze = allFragments.filter(f => selectedIds.has(f.id));

      console.log(`[orchestrator] Ranked selection: ${fragmentsToAnalyze.length} diverse fragments selected`);
    } catch (err) {
      console.warn("[orchestrator] Ranking failed, using fallback balance:", err);
      // Fallback to simple balance
      const textFragments = allFragments.filter(f => f.type === "TEXT" || f.type === "OTHER");
      const imageFragments = allFragments.filter(f => f.type === "IMAGE");
      fragmentsToAnalyze = [
        ...textFragments.slice(0, 6),
        ...imageFragments.slice(0, 4),
      ].slice(0, 10);
    }

    // Warn if all fragments are images
    const textCount = fragmentsToAnalyze.filter(f => f.type !== "IMAGE").length;
    if (textCount === 0 && fragmentsToAnalyze.length > 0) {
      console.warn("[orchestrator] WARNING: No text fragments! AI reasoning will be limited to image analysis.");
    }

    let extractedFeatures: FragmentFeatures[] = [];
    let featureSummary = "";

    try {
      // Extract features (uses local heuristics + optional LLM)
      extractedFeatures = await extractBatchFeatures(fragmentsToAnalyze, client);
      featureSummary = summarizeFeatures(extractedFeatures);
      console.log(`[orchestrator] Extracted features: ${featureSummary}`);
    } catch (err) {
      console.warn("[orchestrator] Feature extraction failed, continuing without:", err);
    }

    // Update loading message
    bus.emitType("AI_LOADING", {
      source: 'puzzle_session',
      message: 'Generating puzzle pieces...',
    } as AILoadingPayload);

    // ═══════════════════════════════════════════════════════════════════════
    // BUILD FRAGMENT SUMMARIES: Ensure title/summary completeness
    // This is critical for AI to reference fragments properly in outputs
    // ═══════════════════════════════════════════════════════════════════════
    const fragmentsSummary: FragmentSummary[] = fragmentsToAnalyze.map((f, i) => {
      const features = extractedFeatures[i];
      const keywordsStr = features?.combinedKeywords?.slice(0, 5).join(", ") || "";
      const isImage = f.type === "IMAGE";

      // TITLE: Ensure every fragment has a meaningful title
      let title = f.title;
      if (!title || title === "Untitled" || title.length < 2) {
        if (isImage) {
          // For images, use first tag or generic image title
          title = f.tags?.[0] ? `Image: ${f.tags[0]}` : "Visual Reference";
        } else {
          // For text, extract first meaningful words from content
          const contentWords = f.content?.split(/\s+/).slice(0, 5).join(" ") || "";
          title = contentWords.length > 3 ? `${contentWords}...` : (f.summary?.slice(0, 25) || "Fragment");
        }
      }

      // SUMMARY: Ensure meaningful summary
      let enhancedSummary = f.summary;
      if (!enhancedSummary || enhancedSummary.length < 5) {
        if (isImage) {
          enhancedSummary = f.tags?.length
            ? `Image with themes: ${f.tags.slice(0, 3).join(", ")}`
            : "Visual reference for design exploration";
        } else {
          enhancedSummary = f.content?.slice(0, 100) || "Fragment content";
        }
      }

      // Add keywords if available
      const fullSummary = keywordsStr
        ? `${enhancedSummary} [Keywords: ${keywordsStr}]`
        : enhancedSummary;

      const fragSummary: FragmentSummary = {
        id: f.id,
        type: f.type,
        title,
        summary: fullSummary,
        tags: [...(f.tags || []), ...(features?.textFeatures?.themes || [])].slice(0, 6),
        imageUrl: isImage ? f.content : undefined,
      };

      // Debug: log what we're sending
      console.log(`[orchestrator] Fragment ${i}: type=${f.type}, title="${title}", hasImageUrl=${!!fragSummary.imageUrl}`);

      return fragSummary;
    });

    const input: PuzzleSessionInput = {
      process_aim: state.project.processAim,
      fragments_summary: fragmentsSummary,
      previous_puzzle_summaries: state.puzzleSummaries.slice(0, 5),
      preference_profile: state.preferenceProfile,
      puzzle_type: payload.puzzleType || "CLARIFY",
    };

    console.log(`[orchestrator] PUZZLE_SESSION_STARTED: type=${input.puzzle_type}, features=${featureSummary.slice(0, 100)}...`);

    try {
      const result = await runPuzzleSessionAgent(input, client, payload.anchors || []);

      // ═══════════════════════════════════════════════════════════════════════
      // PUZZLE WRITE-BACK: Store puzzle in contextStore with generated title
      // This ensures the puzzle deck shows the central_question as title
      // ═══════════════════════════════════════════════════════════════════════
      const sessionState = result.sessionState;
      const puzzleToStore: Puzzle = {
        id: sessionState.session_id,
        centralQuestion: sessionState.central_question,
        projectId: state.project.id,
        type: sessionState.puzzle_type,
        createdFrom: 'ai_suggested',
        createdAt: Date.now(),
      };
      store.addPuzzle(puzzleToStore);
      console.log(`[orchestrator] Wrote puzzle to contextStore: "${sessionState.central_question}" (${sessionState.session_id})`);

      // Notify UI with pre-generated pieces
      if (puzzleSessionCallback) {
        puzzleSessionCallback(result.sessionState);
      }

      // Emit event with session state for UI consumption
      bus.emitType("PUZZLE_SESSION_GENERATED" as UIEventType, {
        sessionState: result.sessionState,
        errors: result.errors,
      });

      // Emit success state
      bus.emitType("AI_SUCCESS", {
        source: 'puzzle_session',
        message: 'Puzzle pieces ready!',
      });

      console.log(`[orchestrator] Session generated: ${result.sessionState.session_id}`);
    } catch (error) {
      console.error("[orchestrator] PUZZLE_SESSION_STARTED failed:", error);

      // Emit error state with retry option
      bus.emitType("AI_ERROR", {
        source: 'puzzle_session',
        message: 'Failed to generate puzzle pieces. Please try again.',
        recoverable: true,
        retryEventType: 'PUZZLE_SESSION_STARTED',
        retryPayload: payload,
      } as AIErrorPayload);
    }
  };

  /**
   * Handle PUZZLE_SESSION_COMPLETED - aggregate preferences from piece events
   */
  const handlePuzzleSessionCompleted = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};
    const puzzleId = payload.puzzleId;

    console.log(`[orchestrator] PUZZLE_SESSION_COMPLETED: puzzle=${puzzleId}`);

    // Aggregate piece events into preference profile updates
    const recentEvents = state.pieceEvents.filter(
      e => Date.now() - e.timestamp < 30 * 60 * 1000 // Last 30 minutes
    );

    // Group by piece and analyze behavior
    const pieceStats: Record<string, { placed: boolean; edited: boolean; deleted: boolean }> = {};
    for (const evt of recentEvents) {
      if (!pieceStats[evt.pieceId]) {
        pieceStats[evt.pieceId] = { placed: false, edited: false, deleted: false };
      }
      if (evt.type === "PLACE") pieceStats[evt.pieceId].placed = true;
      if (evt.type === "EDIT_TEXT") pieceStats[evt.pieceId].edited = true;
      if (evt.type === "DELETE") pieceStats[evt.pieceId].deleted = true;
    }

    // Update preference profile based on aggregated stats
    const currentPuzzle = state.puzzles.find(p => p.id === puzzleId) || state.puzzles[0];
    const puzzleType = currentPuzzle?.type || "CLARIFY";

    store.setState(draft => {
      for (const [pieceId, stats] of Object.entries(pieceStats)) {
        const piece = draft.puzzlePieces.find(p => p.id === pieceId);
        if (!piece) continue;

        const key = `${puzzleType}_${piece.mode}`;
        if (!draft.preferenceProfile[key]) {
          draft.preferenceProfile[key] = {
            suggested: 0,
            placed: 0,
            edited: 0,
            discarded: 0,
            connected: 0,
          };
        }

        if (stats.placed) draft.preferenceProfile[key].placed += 1;
        if (stats.edited) draft.preferenceProfile[key].edited += 1;
        if (stats.deleted) draft.preferenceProfile[key].discarded += 1;
      }
    });

    console.log(`[orchestrator] Preference profile updated for puzzle ${puzzleId}`);
  };

  /**
   * Handle QUADRANT_REGENERATE - regenerate pieces for a single quadrant
   */
  const handleQuadrantRegenerate = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};
    const mode = payload.mode as "FORM" | "MOTION" | "EXPRESSION" | "FUNCTION";
    const sessionState = payload.sessionState as PuzzleSessionState;

    if (!mode || !sessionState) {
      console.error("[orchestrator] QUADRANT_REGENERATE: missing mode or sessionState");
      return;
    }

    console.log(`[orchestrator] QUADRANT_REGENERATE: mode=${mode}`);

    const fragmentsSummary: FragmentSummary[] = state.fragments.slice(0, 5).map(f => ({
      id: f.id,
      type: f.type,
      title: f.title || f.summary?.slice(0, 30) || "Untitled",
      summary: f.summary || f.content.slice(0, 100),
      tags: f.tags,
      imageUrl: f.type === "IMAGE" ? f.content : undefined,
    }));

    try {
      const newPieces = await legacyRegenerateQuadrant(
        mode,
        sessionState,
        fragmentsSummary,
        state.preferenceProfile,
        client
      );

      // Emit regenerated pieces for UI
      bus.emitType("QUADRANT_REGENERATED" as UIEventType, {
        mode,
        pieces: newPieces,
      });

      console.log(`[orchestrator] Regenerated ${newPieces.length} pieces for ${mode}`);
    } catch (error) {
      console.error(`[orchestrator] QUADRANT_REGENERATE failed for ${mode}:`, error);
    }
  };

  // Helper to safely execute async handlers with error logging
  const safeAsync = (handler: () => Promise<void>, eventType: string) => {
    handler().catch((err) => {
      console.error(`[orchestrator] Error handling ${eventType}:`, err);
      // Could emit an error event here for UI notification
    });
  };

  const unsubscribe = bus.subscribe((event: UIEvent) => {
    console.debug("[orchestrator] event received", event.type);
    switch (event.type as UIEventType) {
      case "FRAGMENT_ADDED":
      case "FRAGMENT_UPDATED":
      case "FRAGMENT_DELETED":
        debouncedFragments();
        break;
      case "MASCOT_CLICKED":
        console.log('[orchestrator] handling MASCOT_CLICKED');
        safeAsync(() => handleMascot(event), "MASCOT_CLICKED");
        break;
      case "PUZZLE_FINISH_CLICKED":
        console.log('[orchestrator] handling PUZZLE_FINISH_CLICKED');
        safeAsync(() => handlePuzzleFinish(event), "PUZZLE_FINISH_CLICKED");
        break;
      case "PIECE_CREATED":
        // PIECE_CREATED with payload { mode, category, puzzle, anchors }
        safeAsync(() => handleQuadrantPiece(event), "PIECE_CREATED");
        break;
      case "PIECE_PLACED":
        // PIECE_PLACED: sync'd from visual layer, update preference profile
        handlePiecePlaced(event);
        // Check if pool needs replenishment after placement
        {
          const payload: any = event.payload || {};
          const mode = payload.mode as DesignMode;
          console.log(`[orchestrator] PIECE_PLACED: mode=${mode}`);
          if (mode) {
            const quadrant = mode.toLowerCase() as QuadrantType;
            console.log(`[orchestrator] Checking replenish for quadrant=${quadrant}`);
            usePuzzleSessionStateStore.getState().checkAndReplenish(quadrant);
          } else {
            console.warn('[orchestrator] PIECE_PLACED: no mode in payload');
          }
        }
        break;
      case "PIECE_EDITED":
        // PIECE_EDITED: user edited piece text
        handlePieceEdited(event);
        break;
      case "PIECE_DELETED":
        // PIECE_DELETED: user removed piece from board
        handlePieceDeleted(event);
        // Check if pool needs replenishment after deletion
        {
          const payload: any = event.payload || {};
          const mode = payload.mode as DesignMode;
          if (mode) {
            const quadrant = mode.toLowerCase() as QuadrantType;
            usePuzzleSessionStateStore.getState().checkAndReplenish(quadrant);
          }
        }
        break;
      // Multi-agent system events - ADK is now the primary workflow
      case "PUZZLE_SESSION_STARTED":
        console.log('[orchestrator] ⚡⚡⚡ handling PUZZLE_SESSION_STARTED via ADK');
        console.log('[orchestrator] ⚡⚡⚡ payload:', JSON.stringify(event.payload));
        safeAsync(() => handlePuzzleSessionStartedADK(event), "PUZZLE_SESSION_STARTED");
        break;
      case "PUZZLE_SESSION_COMPLETED":
        console.log('[orchestrator] handling PUZZLE_SESSION_COMPLETED');
        safeAsync(() => handlePuzzleSessionCompleted(event), "PUZZLE_SESSION_COMPLETED");
        break;
      case "QUADRANT_REGENERATE":
        console.log('[orchestrator] handling QUADRANT_REGENERATE');
        safeAsync(() => handleQuadrantRegenerate(event), "QUADRANT_REGENERATE");
        break;
      case "QUADRANT_REPLENISH_NEEDED":
        console.log('[orchestrator] handling QUADRANT_REPLENISH_NEEDED');
        safeAsync(() => handleQuadrantReplenishNeeded(event), "QUADRANT_REPLENISH_NEEDED");
        break;
      default:
        break;
    }
  });

  console.log('[orchestrator] Subscribed to eventBus, returning cleanup function');

  return () => {
    console.log('[orchestrator] Cleanup: unsubscribing from eventBus');
    unsubscribe();
    debouncedFragments.cancel?.();
  };
};
