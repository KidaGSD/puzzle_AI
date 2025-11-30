import { ContextStore } from "../store/contextStore";
import { EventBus } from "../store/eventBus";
import { createLLMClient } from "./adkClient";
import { runFragmentContextAgent } from "./agents/fragmentContextAgent";
import { runMascotSelf, runMascotSuggest } from "./agents/mascotAgent";
import { runPuzzleDesignerAgent } from "./agents/puzzleDesignerAgent";
import { runQuadrantPieceAgent } from "./agents/quadrantPieceAgent";
import {
  Fragment,
  PuzzlePiece,
  Anchor,
  UIEvent,
  UIEventType,
} from "../domain/models";

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

export const attachOrchestrator = (bus: EventBus, store: ContextStore) => {
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

  const createPuzzleFromDesign = (
    puzzleId: string,
    centralQuestion: string,
    design: any,
    createdFrom: "user_request" | "ai_suggested",
  ) => {
    const puzzle = {
      id: puzzleId,
      centralQuestion: centralQuestion,
      projectId: store.getState().project.id,
      createdFrom,
      createdAt: Date.now(),
    };
    const anchors: Anchor[] = [
      { id: `${puzzleId}-a-start`, puzzleId, type: "STARTING", text: design?.anchors?.starting || "" },
      { id: `${puzzleId}-a-solution`, puzzleId, type: "SOLUTION", text: design?.anchors?.solution || "" },
    ];
    const seedPieces: PuzzlePiece[] = (design?.seedPieces || []).map((p: any, idx: number) => ({
      id: `${puzzleId}-seed-${idx}`,
      puzzleId,
      mode: p.mode,
      category: p.category,
      text: p.text,
      userAnnotation: "",
      anchorIds: [],
      fragmentLinks: [],
      source: "AI",
      status: "SUGGESTED",
    }));

    store.setState(draft => {
      draft.puzzles.push(puzzle);
      draft.anchors.push(...anchors);
      draft.puzzlePieces.push(...seedPieces);
    });
    return { puzzle, anchors, seedPieces };
  };

  const handleMascot = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};
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
      store.setState(draft => {
        draft.agentState.mascot.lastProposal = { ...proposal, suggestedAt: Date.now() };
      });
      // Design puzzle and create records
      const design = await runPuzzleDesignerAgent(
        {
          task: "design",
          processAim: state.project.processAim,
          proposedCentralQuestion: proposal.centralQuestion,
          primaryModes: proposal.primaryModes,
          rationaleFromMascot: proposal.rationale,
          relatedClusters: state.clusters.map(c => ({ theme: c.theme, fragmentSummaries: [] })),
          relatedPuzzleSummaries: state.puzzleSummaries.map(s => ({ title: s.title || "", oneLine: s.oneLine || s.directionStatement })),
        },
        client,
      ) as any;
      const newId = `p-${Date.now()}`;
      createPuzzleFromDesign(newId, proposal.centralQuestion, design, "user_request");
      console.info("[mascot:self] puzzle created", newId);
    } else if (payload.action === "suggest_puzzle") {
      const suggestion = await runMascotSuggest(
        {
          processAim: state.project.processAim,
          clusters: state.clusters.map(c => ({ id: c.id, theme: c.theme, fragmentCount: c.fragmentIds.length })),
          puzzleSummaries: state.puzzleSummaries.slice(0, 4).map(s => ({ id: s.puzzleId, title: s.title || "", oneLine: s.oneLine || s.directionStatement })),
          preferenceHints: "",
        },
        client,
      );
      console.info("[mascot:suggest]", suggestion);
      store.setState(draft => {
        draft.agentState.mascot.lastSuggestion = { ...suggestion, suggestedAt: Date.now() };
      });
      if (suggestion.shouldSuggest !== false) {
        const design = await runPuzzleDesignerAgent(
          {
            task: "design",
            processAim: state.project.processAim,
            proposedCentralQuestion: suggestion.centralQuestion || "What should we explore next?",
            primaryModes: suggestion.primaryModes || ["FUNCTION"],
            rationaleFromMascot: suggestion.rationale || "",
            relatedClusters: state.clusters.map(c => ({ theme: c.theme, fragmentSummaries: [] })),
            relatedPuzzleSummaries: state.puzzleSummaries.map(s => ({ title: s.title || "", oneLine: s.oneLine || s.directionStatement })),
          },
          client,
        ) as any;
        const newId = `p-${Date.now()}`;
        createPuzzleFromDesign(newId, suggestion.centralQuestion || "Next puzzle", design, "ai_suggested");
        console.info("[mascot:suggest] puzzle created", newId);
      }
    }
  };

  const handlePuzzleFinish = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};
    const puzzleId = payload.puzzleId || state.puzzles[0]?.id;
    if (!puzzleId) return;
    console.info("[orchestrator] PUZZLE_FINISH_CLICKED", { puzzleId });
    try {
      const summary = await runPuzzleDesignerAgent(
        {
          task: "summarize",
          processAim: state.project.processAim,
          puzzle: { id: puzzleId, centralQuestion: payload.centralQuestion || "What is the core bet?" },
          anchors: payload.anchors || [],
          pieces: payload.pieces || [],
        },
        client,
      );
      store.setState(draft => {
        draft.puzzleSummaries = draft.puzzleSummaries.filter(s => s.puzzleId !== puzzleId);
        draft.puzzleSummaries.push({ puzzleId, ...(summary as any) });
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
    } catch (err) {
      console.error("[orchestrator] puzzle summarize failed", err);
    }
  };

  const handleQuadrantPiece = async (event: UIEvent) => {
    const state = store.getState();
    const payload: any = event.payload || {};
    const output = await runQuadrantPieceAgent(
      {
        processAim: state.project.processAim,
        mode: payload.mode,
        category: payload.category,
        puzzle: payload.puzzle || { id: "p1", centralQuestion: "Placeholder" },
        anchors: payload.anchors || [],
        existingPiecesForMode: payload.existingPiecesForMode || [],
        preferenceHint: payload.preferenceHint,
      },
      client,
    );
    // Store suggestions as SUGGESTED pieces in state (placeholder; real UI would render)
    store.setState(draft => {
      output.pieces.forEach(p => {
        draft.puzzlePieces.push({
          id: `ai-${Date.now()}-${Math.random()}`,
          puzzleId: payload.puzzle?.id || "p1",
          mode: p.mode,
          category: p.category as any,
          text: p.text,
          userAnnotation: "",
          anchorIds: [],
          fragmentLinks: [],
          source: "AI",
          status: "SUGGESTED",
        });
      });
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
        handleMascot(event);
        break;
      case "PUZZLE_FINISH_CLICKED":
        handlePuzzleFinish(event);
        break;
      case "PIECE_CREATED":
        // PIECE_CREATED with payload { mode, category, puzzle, anchors }
        handleQuadrantPiece(event);
        break;
      default:
        console.debug("[orchestrator] unhandled event", event.type);
        break;
    }
  });

  return () => {
    unsubscribe();
    debouncedFragments.cancel?.();
  };
};
