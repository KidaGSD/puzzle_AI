import { Project, PuzzleSessionState, UIEvent } from "../domain/models";
import { createContextStore, createEmptyProjectStore } from "./contextStore";
import { createEventBus } from "./eventBus";
import { createPuzzleSync, PuzzleSyncAdapter } from "./puzzleSync";
import { attachOrchestrator, setMascotCallback } from "../ai/orchestrator";
import { attachOrchestratorStub } from "../ai/orchestratorStub";
import { MascotProposal } from "../ai/agents/mascotAgent";
import { MATCHA_PROJECT, loadMockFragments } from "../services/mockDataLoader";
import { usePuzzleSessionStateStore, setEventBusRef } from "./puzzleSessionStateStore";
import { useGameStore, setEventBusRefForGameStore } from "./puzzleSessionStore";
import { useSettingsStore } from "./settingsStore";
// Background AI Services
import { serviceManager, PrecomputedInsights, EnrichedFragment } from "../ai/adk/services";

// ========== Session Recovery Constants ==========
const SESSION_STORAGE_KEY = 'puzzle_session_recovery';
const SESSION_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

// Use the matcha brand project as default
const defaultProject: Project = MATCHA_PROJECT;

export const contextStore = createContextStore(createEmptyProjectStore(defaultProject));

/**
 * Initialize mock data - loads random 6 images + text fragments
 * Call this on app startup to populate the canvas with demo content
 */
export const initializeMockData = () => {
  const fragments = loadMockFragments(defaultProject.id);

  // Clear existing fragments and add new mock data
  contextStore.setState((draft) => {
    draft.fragments = fragments;
  });

  console.log(`[runtime] Initialized ${fragments.length} mock fragments (6 images + text)`);
  return fragments;
};

/**
 * Refresh mock data with new random selection
 */
export const refreshMockData = () => {
  return initializeMockData();
};

/**
 * Clear all mock data from store
 * Call this when mock mode is turned OFF
 */
export const clearMockData = () => {
  contextStore.setState((draft) => {
    draft.fragments = [];
  });
  console.log('[runtime] Cleared mock data from store');
};

// AUTO-INITIALIZE: Load mock data only if mock mode is ON
// Check persisted settings to determine initial state
const checkAndInitializeMockData = () => {
  // Get persisted mock mode setting
  const isMockMode = useSettingsStore.getState().isMockMode;

  if (isMockMode) {
    console.log('[runtime] Mock mode ON - loading mock data...');
    initializeMockData();
  } else {
    console.log('[runtime] Mock mode OFF - starting with empty canvas');
  }
};

checkAndInitializeMockData();

export const eventBus = createEventBus();

// Set eventBus reference for stores to use
setEventBusRef(eventBus);
setEventBusRefForGameStore(eventBus);

// ========== Background AI Services ==========

let aiServicesStarted = false;

/**
 * Initialize background AI services
 * Call this on app mount to start context collection
 */
export const initializeAIServices = () => {
  if (aiServicesStarted) {
    console.log('[runtime] AI services already started');
    return;
  }

  console.log('[runtime] Starting background AI services...');
  serviceManager.start(eventBus, contextStore);
  aiServicesStarted = true;
  console.log('[runtime] Background AI services started');
};

/**
 * Stop background AI services
 * Call this on app unmount
 */
export const stopAIServices = () => {
  if (!aiServicesStarted) return;

  console.log('[runtime] Stopping background AI services...');
  serviceManager.stop();
  aiServicesStarted = false;
};

/**
 * Check if AI services are ready (context collected)
 */
export const isAIReady = (): boolean => {
  return serviceManager.isReady();
};

/**
 * Get AI service status
 */
export const getAIStatus = () => {
  return serviceManager.getStatus();
};

/**
 * Get precomputed insights for instant puzzle generation
 */
export const getPrecomputedInsights = (): PrecomputedInsights | null => {
  return serviceManager.getPrecomputedInsights();
};

/**
 * Get enriched fragments ready for puzzle generation
 */
export const getEnrichedFragments = (): EnrichedFragment[] | null => {
  return serviceManager.getEnrichedFragments();
};

/**
 * Force immediate recomputation of AI insights
 */
export const forceAIRecompute = async (): Promise<void> => {
  await serviceManager.forceRecompute();
};

// Puzzle session sync adapter - bridges visual layer to domain layer
let puzzleSyncInstance: PuzzleSyncAdapter | null = null;

export const ensurePuzzleSync = (): PuzzleSyncAdapter => {
  if (!puzzleSyncInstance) {
    puzzleSyncInstance = createPuzzleSync({
      contextStore,
      eventBus,
    });
    console.log('[runtime] PuzzleSync adapter attached');
  }
  return puzzleSyncInstance;
};

export const getPuzzleSyncInstance = (): PuzzleSyncAdapter | null => puzzleSyncInstance;

// Mascot proposal callback - delegates to orchestrator's module-level callback
// This provides a single point of registration for UI components
let mascotProposalCallback: ((proposal: MascotProposal) => void) | null = null;

export const setMascotProposalListener = (callback: (proposal: MascotProposal) => void) => {
  mascotProposalCallback = callback;
  // Also set it in the orchestrator module
  setMascotCallback(callback);
};

// Kept for backwards compatibility, but now orchestrator calls directly
export const notifyMascotProposal = (proposal: MascotProposal) => {
  if (mascotProposalCallback) {
    mascotProposalCallback(proposal);
  }
};

// Attach orchestrator (fallbacks to mock if no API key)
let detachOrchestrator: (() => void) | null = null;
export const ensureOrchestrator = () => {
  console.log('[runtime] ensureOrchestrator called, current state:', !!detachOrchestrator);
  if (!detachOrchestrator) {
    console.log('[runtime] Attaching new orchestrator...');
    detachOrchestrator = attachOrchestrator(eventBus, contextStore);
    console.log('[runtime] Orchestrator attached, detach function:', !!detachOrchestrator);
  } else {
    console.log('[runtime] Orchestrator already attached, reusing');
  }
  return detachOrchestrator;
};

// Legacy stub (optional, only if orchestrator not desired)
export const attachStub = () => attachOrchestratorStub(eventBus, contextStore);

// ========== Puzzle Session State Sync ==========

let puzzleSessionStateUnsubscribe: (() => void) | null = null;

/**
 * Listen for PUZZLE_SESSION_GENERATED events and update the session state store
 */
export const ensurePuzzleSessionStateSync = () => {
  if (puzzleSessionStateUnsubscribe) {
    console.log('[runtime] Puzzle session state sync already attached');
    return puzzleSessionStateUnsubscribe;
  }

  puzzleSessionStateUnsubscribe = eventBus.subscribe((event: UIEvent) => {
    if (event.type === 'PUZZLE_SESSION_GENERATED') {
      const payload = event.payload as { sessionState: PuzzleSessionState; errors?: string[] };
      console.log('[runtime] PUZZLE_SESSION_GENERATED received, updating session state store');

      if (payload.sessionState) {
        usePuzzleSessionStateStore.getState().setSessionState(payload.sessionState);
      }

      if (payload.errors && payload.errors.length > 0) {
        console.warn('[runtime] Session generation had errors:', payload.errors);
      }
    }

    if (event.type === 'PUZZLE_SESSION_STARTED') {
      console.log('[runtime] PUZZLE_SESSION_STARTED, setting generating state');
      usePuzzleSessionStateStore.getState().setGenerating(true);
    }
  });

  console.log('[runtime] Puzzle session state sync attached');
  return puzzleSessionStateUnsubscribe;
};

/**
 * Start a new puzzle session with pre-generation
 * @param puzzleType - The type of puzzle (CLARIFY, EXPAND, REFINE)
 * @param existingPuzzleId - Optional existing puzzle ID to reuse (prevents duplicate cards)
 * @param centralQuestion - Optional central question for the puzzle
 */
export const startPuzzleSession = (
  puzzleType: 'CLARIFY' | 'EXPAND' | 'REFINE' = 'CLARIFY',
  existingPuzzleId?: string,
  centralQuestion?: string
) => {
  console.log(`[runtime] ⚡ Starting puzzle session with type: ${puzzleType}, existingId: ${existingPuzzleId || 'none'}`);

  // Clear existing session
  usePuzzleSessionStateStore.getState().clearSession();

  // Emit event to trigger multi-agent pre-generation
  console.log(`[runtime] ⚡ Emitting PUZZLE_SESSION_STARTED event...`);
  eventBus.emitType('PUZZLE_SESSION_STARTED', {
    puzzleType,
    puzzleId: existingPuzzleId, // Pass existing ID to prevent duplicates
    centralQuestion,
    anchors: [], // Could be passed from UI
  });
  console.log(`[runtime] ⚡ PUZZLE_SESSION_STARTED event emitted`);
};

// ========== Session Recovery (P3) ==========

interface SessionRecoveryData {
  sessionState: PuzzleSessionState;
  anchors: { starting: any; solution: any };
  pieces: any[];
  preGeneratedPieces: any;
  savedAt: number;
}

/**
 * Save current session to localStorage for recovery on page refresh
 */
export const saveSessionToStorage = (): void => {
  try {
    const sessionStore = usePuzzleSessionStateStore.getState();
    const gameStore = useGameStore.getState();

    const sessionState = sessionStore.sessionState;
    if (!sessionState) {
      console.log('[runtime] No active session to save');
      return;
    }

    const toSave: SessionRecoveryData = {
      sessionState,
      anchors: sessionStore.anchors,
      pieces: gameStore.pieces,
      preGeneratedPieces: sessionStore.preGeneratedPieces,
      savedAt: Date.now(),
    };

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(toSave));
    console.log('[runtime] Session saved to localStorage');
  } catch (error) {
    console.warn('[runtime] Failed to save session:', error);
  }
};

/**
 * Restore session from localStorage if available and not too old
 * @returns true if session was restored, false otherwise
 */
export const restoreSessionFromStorage = (): boolean => {
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!saved) {
      console.log('[runtime] No saved session found');
      return false;
    }

    const parsed: SessionRecoveryData = JSON.parse(saved);

    // Check if session is not too old
    if (Date.now() - parsed.savedAt > SESSION_MAX_AGE_MS) {
      console.log('[runtime] Saved session expired, clearing');
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }

    const sessionStore = usePuzzleSessionStateStore.getState();
    const gameStore = useGameStore.getState();

    // Restore session state
    sessionStore.setSessionState(parsed.sessionState);

    // Restore anchors
    if (parsed.anchors.starting) {
      sessionStore.updateAnchor('STARTING', parsed.anchors.starting.text);
    }
    if (parsed.anchors.solution) {
      sessionStore.updateAnchor('SOLUTION', parsed.anchors.solution.text);
    }

    // Restore pre-generated pieces pool
    if (parsed.preGeneratedPieces) {
      // Directly set preGeneratedPieces (need to access store setter)
      usePuzzleSessionStateStore.setState({
        preGeneratedPieces: parsed.preGeneratedPieces,
      });
    }

    // Restore placed pieces
    if (parsed.pieces && parsed.pieces.length > 0) {
      parsed.pieces.forEach((piece: any) => {
        gameStore.addPiece(piece);
      });
    }

    console.log(`[runtime] Session restored from localStorage (${parsed.pieces?.length || 0} pieces)`);
    return true;
  } catch (error) {
    console.warn('[runtime] Failed to restore session:', error);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return false;
  }
};

/**
 * Clear saved session from localStorage
 */
export const clearSessionStorage = (): void => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  console.log('[runtime] Session storage cleared');
};

/**
 * Enable auto-save on relevant events
 */
export const enableSessionAutoSave = (): (() => void) => {
  const unsubscribe = eventBus.subscribe((event: UIEvent) => {
    const autoSaveEvents = ['PIECE_PLACED', 'PIECE_DELETED', 'PUZZLE_SESSION_GENERATED'];

    if (autoSaveEvents.includes(event.type)) {
      // Debounce auto-save to avoid excessive writes
      setTimeout(() => {
        saveSessionToStorage();
      }, 500);
    }

    // Clear storage when session ends
    if (event.type === 'PUZZLE_SESSION_COMPLETED') {
      clearSessionStorage();
    }
  });

  console.log('[runtime] Session auto-save enabled');
  return unsubscribe;
};
