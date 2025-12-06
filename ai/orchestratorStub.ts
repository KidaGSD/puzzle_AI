import { EventBus } from "../store/eventBus";
import { ContextStore } from "../store/contextStore";
import { Cluster, Fragment } from "../domain/models";

const summarizeFragment = (fragment: Fragment): { summary: string; tags: string[] } => {
  const text = fragment.content || "";
  const summary = text.length > 80 ? `${text.slice(0, 77)}...` : text || "Untitled fragment";
  const tags = text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean)
    .slice(0, 3);
  return { summary, tags: tags.length ? tags : ["idea"] };
};

const mockCluster = (fragments: Fragment[]): Cluster[] => {
  if (fragments.length < 2) return [];
  const ids = fragments.map(f => f.id);
  return [
    {
      id: "cluster-1",
      fragmentIds: ids,
      theme: "early-draft",
    },
  ];
};

// Simple stub to illustrate event consumption; replace with real agent orchestration.
export const attachOrchestratorStub = (bus: EventBus, store: ContextStore) => {
  const debounceFn = <T extends (...args: any[]) => void>(fn: T, delay: number) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const handleFragmentBurst = () => {
    const state = store.getState();
    const updatedFragments = state.fragments.map(f => {
      const { summary, tags } = summarizeFragment(f);
      return { ...f, summary, tags };
    });
    const clusters = mockCluster(state.fragments);
    store.setState(draft => {
      draft.fragments = updatedFragments;
      draft.clusters = clusters;
    });
  };

  const debouncedFragmentHandler = debounceFn(handleFragmentBurst, 400);

  const unsubscribe = bus.subscribe((event) => {
    if (event.type === "FRAGMENT_ADDED" || event.type === "FRAGMENT_UPDATED" || event.type === "FRAGMENT_DELETED") {
      debouncedFragmentHandler();
    }
  });

  return () => {
    unsubscribe();
    // no explicit cancel for simple debounce
  };
};
