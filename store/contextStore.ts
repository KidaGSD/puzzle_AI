import {
  Anchor,
  Cluster,
  Fragment,
  FragmentPuzzleLink,
  PieceEvent,
  PieceStatus,
  Project,
  ProjectStore,
  Puzzle,
  PuzzlePiece,
  PuzzleSummary,
  PuzzleType,
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
  addPuzzle(puzzle: Puzzle): ProjectStore;
  addAnchor(anchor: Anchor): ProjectStore;
  upsertPuzzlePiece(piece: PuzzlePiece): ProjectStore;
  setPieceStatus(pieceId: UUID, status: PieceStatus): ProjectStore;
  addPuzzleSummary(summary: PuzzleSummary): ProjectStore;
  addPieceEvent(event: PieceEvent): ProjectStore;
  setPreferenceProfile(profile: UserPreferenceProfile): ProjectStore;
  labelFragments(fragmentIds: UUID[], puzzleId: UUID): ProjectStore;
  addFragmentPuzzleLink(link: FragmentPuzzleLink): ProjectStore;
  getFragmentPuzzleType(fragmentId: UUID): PuzzleType | null;
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
  fragmentPuzzleLinks: [],
});

const cloneStore = (store: ProjectStore): ProjectStore =>
  typeof structuredClone === "function"
    ? structuredClone(store)
    : JSON.parse(JSON.stringify(store)) as ProjectStore;

/**
 * Generate a default title for a fragment based on its content
 */
const generateDefaultTitle = (fragment: Fragment): string => {
  if (fragment.type === 'IMAGE') {
    return `Image ${new Date().toLocaleDateString()}`;
  }
  if (fragment.type === 'LINK') {
    // Extract domain from URL
    try {
      const url = new URL(fragment.content);
      return `Link: ${url.hostname}`;
    } catch {
      return 'Link Reference';
    }
  }
  if (fragment.type === 'TEXT' && fragment.content) {
    // Take first 4 words
    const words = fragment.content.trim().split(/\s+/).slice(0, 4).join(' ');
    return words.length > 30 ? words.slice(0, 27) + '...' : words || 'Text Fragment';
  }
  return 'Untitled Fragment';
};

/**
 * Generate a default summary for a fragment based on its content
 */
const generateDefaultSummary = (fragment: Fragment): string => {
  if (fragment.type === 'IMAGE') {
    return 'Image content for visual reference';
  }
  if (fragment.type === 'LINK') {
    return `External link: ${fragment.content.slice(0, 100)}`;
  }
  if (fragment.content) {
    // First 150 chars for text content
    return fragment.content.slice(0, 150) + (fragment.content.length > 150 ? '...' : '');
  }
  return '';
};

/**
 * Ensure fragment has complete metadata for AI context
 */
const validateFragment = (fragment: Fragment): Fragment => {
  return {
    ...fragment,
    title: fragment.title || generateDefaultTitle(fragment),
    summary: fragment.summary || generateDefaultSummary(fragment),
    tags: fragment.tags || [],
    labels: fragment.labels || [],
  };
};

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
    // Notify subscribers so UI re-renders
    subscribers.forEach(fn => fn());
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
      // Validate and ensure fragment has complete metadata
      const validatedFragment = validateFragment(fragment);

      const idx = draft.fragments.findIndex(f => f.id === validatedFragment.id);
      if (idx >= 0) {
        // Update existing - preserve AI-generated fields if not provided
        const existing = draft.fragments[idx];
        draft.fragments[idx] = {
          ...existing,
          ...validatedFragment,
          // Keep existing AI summaries/tags if not explicitly provided in update
          summary: fragment.summary || existing.summary || validatedFragment.summary,
          tags: fragment.tags?.length ? fragment.tags : existing.tags || validatedFragment.tags,
        };
      } else {
        draft.fragments.push(validatedFragment);
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

  const addPuzzle = (puzzle: Puzzle) =>
    setState(draft => {
      // Check if puzzle with same ID already exists (deduplication)
      const existingIndex = draft.puzzles.findIndex(p => p.id === puzzle.id);
      if (existingIndex >= 0) {
        // Update existing puzzle instead of adding duplicate
        draft.puzzles[existingIndex] = puzzle;
        console.log(`[contextStore] Updated existing puzzle: ${puzzle.id}`);
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
      // Check if summary for this puzzle already exists (deduplication)
      const existingIndex = draft.puzzleSummaries.findIndex(s => s.puzzleId === summary.puzzleId);
      if (existingIndex >= 0) {
        // Update existing summary instead of adding duplicate
        draft.puzzleSummaries[existingIndex] = summary;
        console.log(`[contextStore] Updated existing puzzle summary: ${summary.puzzleId}`);
      } else {
        draft.puzzleSummaries.push(summary);
      }
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

  /**
   * Add a link between a fragment and a puzzle
   * Used when a piece referencing this fragment is placed on the board
   */
  const addFragmentPuzzleLink = (link: FragmentPuzzleLink) =>
    setState(draft => {
      // Initialize array if it doesn't exist (for backward compatibility)
      if (!draft.fragmentPuzzleLinks) {
        draft.fragmentPuzzleLinks = [];
      }
      // Check if this exact link already exists
      const exists = draft.fragmentPuzzleLinks.some(
        l => l.fragmentId === link.fragmentId && l.puzzleId === link.puzzleId
      );
      if (!exists) {
        draft.fragmentPuzzleLinks.push(link);
        console.log(`[contextStore] Added fragment-puzzle link: ${link.fragmentId} -> ${link.puzzleId} (${link.puzzleType})`);
      }
    });

  /**
   * Get the most recent puzzle type for a fragment
   * Returns null if fragment has never been used in a puzzle
   */
  const getFragmentPuzzleType = (fragmentId: UUID): PuzzleType | null => {
    const links = state.fragmentPuzzleLinks || [];
    // Filter links for this fragment and sort by timestamp (most recent first)
    const fragmentLinks = links
      .filter(l => l.fragmentId === fragmentId)
      .sort((a, b) => b.linkedAt - a.linkedAt);

    return fragmentLinks.length > 0 ? fragmentLinks[0].puzzleType : null;
  };

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
    addPuzzle,
    addAnchor,
    upsertPuzzlePiece,
    setPieceStatus,
    addPuzzleSummary,
    addPieceEvent,
    setPreferenceProfile,
    labelFragments,
    addFragmentPuzzleLink,
    getFragmentPuzzleType,
    persist,
    hydrate,
  };
};
