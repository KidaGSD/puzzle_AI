import { ContextStore } from "../store/contextStore";
import { EventBus } from "../store/eventBus";
import { createLLMClient } from "./adkClient";
import { runFragmentContextAgent } from "./agents/fragmentContextAgent";
import { runMascotSelf, runMascotSuggest } from "./agents/mascotAgent";
import { runPuzzleDesignerAgent } from "./agents/puzzleDesignerAgent";
import { runQuadrantPieceAgent, FragmentContext } from "./agents/quadrantPieceAgent";
// Multi-agent system imports
import { runPuzzleSessionAgent, regenerateQuadrant as legacyRegenerateQuadrant } from "./agents/puzzleSessionAgent";
import { runPuzzleSynthesisAgent, PuzzleSynthesisInput } from "./agents/puzzleSynthesisAgent";
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
import { MascotProposal } from "./agents/mascotAgent";
import { useGameStore } from "../store/puzzleSessionStore";
import { COLORS, ALL_SHAPES } from "../constants/puzzleGrid";
import { QuadrantType, PieceCategoryType } from "../types";
import { v4 as uuidv4 } from "uuid";

// Callback type for mascot proposals - passed in to avoid circular dependency
type MascotProposalCallback = (proposal: MascotProposal) => void;

// Feature flag for ADK integration
// Set to true to use new ADK-based workflow, false for legacy
const USE_ADK_WORKFLOW = process.env.USE_ADK_WORKFLOW === 'true' || false;

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
  const client = createLLMClient();

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
      // Build input for synthesis agent
      const synthesisInput: PuzzleSynthesisInput = {
        puzzleId,
        puzzleType,
        centralQuestion: payload.centralQuestion || puzzle?.centralQuestion || "What is the core question?",
        processAim: state.project.processAim,
        anchors: sessionAnchors,
        placedPieces,
      };

      // Run synthesis agent
      const summary = await runPuzzleSynthesisAgent(synthesisInput, client);

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
    const color = COLORS[quadrant];

    const gameStore = useGameStore.getState();

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
    output.pieces.forEach((p) => {
      const pieceId = uuidv4();
      const shape = ALL_SHAPES[Math.floor(Math.random() * ALL_SHAPES.length)];
      // Use text field as the main content (the declarative statement)
      const text = p.text || p.title || "Key insight here";

      // Find a valid position for this piece based on quadrant
      const position = findValidPosition(quadrant, shape, gameStore);

      if (position) {
        // Add to visual layer (puzzleSessionStore) with ALL fragment fields
        gameStore.addPiece({
          id: pieceId,
          quadrant,
          color,
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

        console.log(`[orchestrator] Created visual piece: ${pieceId} at (${position.x}, ${position.y}) - "${text}" (fragment: ${p.fragmentId || 'none'})`);
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

  // ========== Multi-Agent System Handlers ==========

  // Callback for puzzle session state updates
  let puzzleSessionCallback: ((state: PuzzleSessionState) => void) | null = null;

  /**
   * Handle PUZZLE_SESSION_STARTED - triggers full puzzle pre-generation
   * This runs the PuzzleSessionAgent which:
   * 1. Extracts features from fragments (keywords, themes, etc.)
   * 2. Generates central question grounded in fragment features
   * 3. Runs 4 quadrant agents in parallel with feature context
   * 4. Returns pre-generated pieces for all quadrants
   */
  const handlePuzzleSessionStarted = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};

    // Emit loading state
    bus.emitType("AI_LOADING", {
      source: 'puzzle_session',
      message: 'Analyzing fragments...',
    } as AILoadingPayload);

    // ========== Phase 2: Feature Extraction with Caching ==========
    // Use the feature store for cached extraction, reducing API costs
    const featureStore = initFeatureStore(client);

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
      const newPieces = await regenerateQuadrant(
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
        break;
      case "PIECE_EDITED":
        // PIECE_EDITED: user edited piece text
        handlePieceEdited(event);
        break;
      case "PIECE_DELETED":
        // PIECE_DELETED: user removed piece from board
        handlePieceDeleted(event);
        break;
      // Multi-agent system events
      case "PUZZLE_SESSION_STARTED":
        console.log('[orchestrator] handling PUZZLE_SESSION_STARTED');
        safeAsync(() => handlePuzzleSessionStarted(event), "PUZZLE_SESSION_STARTED");
        break;
      case "PUZZLE_SESSION_COMPLETED":
        console.log('[orchestrator] handling PUZZLE_SESSION_COMPLETED');
        safeAsync(() => handlePuzzleSessionCompleted(event), "PUZZLE_SESSION_COMPLETED");
        break;
      case "QUADRANT_REGENERATE":
        console.log('[orchestrator] handling QUADRANT_REGENERATE');
        safeAsync(() => handleQuadrantRegenerate(event), "QUADRANT_REGENERATE");
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
