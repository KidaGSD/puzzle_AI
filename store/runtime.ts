import { Project } from "../domain/models";
import { createContextStore, createEmptyProjectStore } from "./contextStore";
import { createEventBus } from "./eventBus";
import { createPuzzleSync, PuzzleSyncAdapter } from "./puzzleSync";
import { attachOrchestrator, setMascotCallback } from "../ai/orchestrator";
import { attachOrchestratorStub } from "../ai/orchestratorStub";
import { MascotProposal } from "../ai/agents/mascotAgent";
import { MATCHA_PROJECT, loadMockFragments } from "../services/mockDataLoader";

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

// AUTO-INITIALIZE: Load mock data at module load time
// This ensures fragments are available before any React component renders
console.log('[runtime] Auto-initializing mock data...');
initializeMockData();

export const eventBus = createEventBus();

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
