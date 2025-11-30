import { Project } from "../domain/models";
import { createContextStore, createEmptyProjectStore } from "./contextStore";
import { createEventBus } from "./eventBus";
import { attachOrchestrator } from "../ai/orchestrator";
import { attachOrchestratorStub } from "../ai/orchestratorStub";
import { createLocalStorageAdapter } from "./adapters/localStorageAdapter";

const defaultProject: Project = {
  id: "demo-project",
  title: "Sci-Fi Animation Concept",
  processAim: "Explore the tension between analog warmth and digital coldness.",
};

const adapter = typeof window !== "undefined" ? createLocalStorageAdapter() : undefined;

export const contextStore = createContextStore(createEmptyProjectStore(defaultProject), adapter);

export const eventBus = createEventBus();

// Attach orchestrator (fallbacks to mock if no API key)
let detachOrchestrator: (() => void) | null = null;
export const ensureOrchestrator = () => {
  if (!detachOrchestrator) {
    detachOrchestrator = attachOrchestrator(eventBus, contextStore);
  }
  return detachOrchestrator;
};

// Legacy stub (optional, only if orchestrator not desired)
export const attachStub = () => attachOrchestratorStub(eventBus, contextStore);

// Auto-attach orchestrator in browser runtime so eventBus always has subscribers.
if (typeof window !== "undefined") {
  ensureOrchestrator();
}
