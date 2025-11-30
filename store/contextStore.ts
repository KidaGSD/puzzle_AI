import {
  Anchor,
  Cluster,
  Fragment,
  PieceEvent,
  PieceStatus,
  Project,
  ProjectStore,
  Puzzle,
  PuzzlePiece,
  PuzzleSummary,
  UserPreferenceProfile,
  UUID,
} from "../domain/models";

type StoreUpdater = (draft: ProjectStore) => void;

export interface StorageAdapter {
  load(): Promise<ProjectStore | null>;
  save(store: ProjectStore): Promise<void>;
}

export interface ContextStore {
  getState(): ProjectStore;
  setState(updater: StoreUpdater): ProjectStore;
  undo(): ProjectStore | null;
  redo(): ProjectStore | null;
  subscribe(listener: () => void): () => void;
  updateProcessAim(processAim: string): ProjectStore;
  upsertFragment(fragment: Fragment): ProjectStore;
  deleteFragment(fragmentId: UUID): ProjectStore;
  upsertCluster(cluster: Cluster): ProjectStore;
  upsertPuzzle(puzzle: Puzzle): ProjectStore;
  addAnchor(anchor: Anchor): ProjectStore;
  upsertPuzzlePiece(piece: PuzzlePiece): ProjectStore;
  setPieceStatus(pieceId: UUID, status: PieceStatus): ProjectStore;
  addPuzzleSummary(summary: PuzzleSummary): ProjectStore;
  addPieceEvent(event: PieceEvent): ProjectStore;
  setPreferenceProfile(profile: UserPreferenceProfile): ProjectStore;
  labelFragments(fragmentIds: UUID[], puzzleId: UUID): ProjectStore;
  persist(): Promise<void>;
  hydrate(): Promise<ProjectStore>;
}

export const createEmptyProjectStore = (project: Project): ProjectStore => ({
  project,
  fragments: [],
  clusters: [],
  puzzles: [],
  anchors: [],
  puzzlePieces: [],
  puzzleSummaries: [],
  preferenceProfile: {},
  pieceEvents: [],
  agentState: {
    mascot: {
      hasShownOnboarding: false,
      lastReflectionAt: 0,
      reflectionsDisabled: false,
    },
  },
});

const cloneStore = (store: ProjectStore): ProjectStore =>
  typeof structuredClone === "function"
    ? structuredClone(store)
    : JSON.parse(JSON.stringify(store)) as ProjectStore;

export const createContextStore = (
  initialStore: ProjectStore,
  adapter?: StorageAdapter,
): ContextStore => {
  let state = cloneStore(initialStore);
  const history: ProjectStore[] = [];
  const future: ProjectStore[] = [];
  const subscribers = new Set<() => void>();

  const persist = async () => {
    if (adapter) {
      await adapter.save(state);
    }
  };

  const commit = (updater: StoreUpdater): ProjectStore => {
    history.push(cloneStore(state));
    future.length = 0;
    const draft = cloneStore(state);
    updater(draft);
    state = draft;
    subscribers.forEach(fn => fn());
    // Fire and forget persist
    void persist();
    return state;
  };

  const getState = () => state;

  const setState = (updater: StoreUpdater) => {
    const next = commit(updater);
    return next;
  };

  const undo = () => {
    const prev = history.pop();
    if (!prev) return null;
    future.push(cloneStore(state));
    state = prev;
    return state;
  };

  const redo = () => {
    const next = future.pop();
    if (!next) return null;
    history.push(cloneStore(state));
    state = next;
    subscribers.forEach(fn => fn());
    return state;
  };

  const subscribe = (listener: () => void) => {
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  };

  const updateProcessAim = (processAim: string) =>
    setState(draft => {
      draft.project.processAim = processAim;
    });

  const upsertFragment = (fragment: Fragment) =>
    setState(draft => {
      const idx = draft.fragments.findIndex(f => f.id === fragment.id);
      if (idx >= 0) {
        draft.fragments[idx] = fragment;
      } else {
        draft.fragments.push(fragment);
      }
    });

  const deleteFragment = (fragmentId: UUID) =>
    setState(draft => {
      draft.fragments = draft.fragments.filter(f => f.id !== fragmentId);
      draft.clusters = draft.clusters.map(c => ({
        ...c,
        fragmentIds: c.fragmentIds.filter(id => id !== fragmentId),
      }));
    });

  const upsertCluster = (cluster: Cluster) =>
    setState(draft => {
      const idx = draft.clusters.findIndex(c => c.id === cluster.id);
      if (idx >= 0) {
        draft.clusters[idx] = cluster;
      } else {
        draft.clusters.push(cluster);
      }
    });

  const upsertPuzzle = (puzzle: Puzzle) =>
    setState(draft => {
      const idx = draft.puzzles.findIndex(p => p.id === puzzle.id);
      if (idx >= 0) {
        draft.puzzles[idx] = puzzle;
      } else {
        draft.puzzles.push(puzzle);
      }
    });

  const addAnchor = (anchor: Anchor) =>
    setState(draft => {
      draft.anchors.push(anchor);
    });

  const upsertPuzzlePiece = (piece: PuzzlePiece) =>
    setState(draft => {
      const idx = draft.puzzlePieces.findIndex(p => p.id === piece.id);
      if (idx >= 0) {
        draft.puzzlePieces[idx] = piece;
      } else {
        draft.puzzlePieces.push(piece);
      }
    });

  const setPieceStatus = (pieceId: UUID, status: PieceStatus) =>
    setState(draft => {
      const piece = draft.puzzlePieces.find(p => p.id === pieceId);
      if (piece) piece.status = status;
    });

  const addPuzzleSummary = (summary: PuzzleSummary) =>
    setState(draft => {
      draft.puzzleSummaries.push(summary);
    });

  const addPieceEvent = (event: PieceEvent) =>
    setState(draft => {
      draft.pieceEvents.push(event);
    });

  const setPreferenceProfile = (profile: UserPreferenceProfile) =>
    setState(draft => {
      draft.preferenceProfile = profile;
    });

  const labelFragments = (fragmentIds: UUID[], puzzleId: UUID) =>
    setState(draft => {
      draft.fragments = draft.fragments.map(f => {
        if (!fragmentIds.includes(f.id)) return f;
        const labels = new Set(f.labels);
        labels.add(puzzleId);
        return { ...f, labels: Array.from(labels) };
      });
    });

  const hydrate = async (): Promise<ProjectStore> => {
    if (!adapter) return state;
    const loaded = await adapter.load();
    if (!loaded) return state;
    state = cloneStore(loaded);
    history.length = 0;
    future.length = 0;
    subscribers.forEach(fn => fn());
    return state;
  };

  return {
    getState,
    setState,
    undo,
    redo,
    subscribe,
    updateProcessAim,
    upsertFragment,
    deleteFragment,
    upsertCluster,
    upsertPuzzle,
    addAnchor,
    upsertPuzzlePiece,
    setPieceStatus,
    addPuzzleSummary,
    addPieceEvent,
    setPreferenceProfile,
    labelFragments,
    persist,
    hydrate,
  };
};
