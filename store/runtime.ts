import { Project } from "../domain/models";
import { createContextStore, createEmptyProjectStore } from "./contextStore";
import { createEventBus } from "./eventBus";
import { attachOrchestrator, setMascotCallback } from "../ai/orchestrator";
import { attachOrchestratorStub } from "../ai/orchestratorStub";
import { MascotProposal } from "../ai/agents/mascotAgent";

const defaultProject: Project = {
  id: "demo-project",
  title: "Sci-Fi Animation Concept",
  processAim: "Explore the tension between analog warmth and digital coldness.",
};

export const contextStore = createContextStore(createEmptyProjectStore(defaultProject));

export const eventBus = createEventBus();

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
