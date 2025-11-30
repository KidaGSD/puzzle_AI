import React, { useState, useRef, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Toolbar } from './components/Toolbar';
import { TopBar } from './components/TopBar';
import { PuzzleDeck } from './components/PuzzleDeck';
import { Fragment } from './components/Fragment';
import { ToolType, FragmentType, FragmentData, Lever, Puzzle, PALETTE } from './types';
import { analyzeBoard } from './services/geminiService';
import { Plus } from 'lucide-react';
import { contextStore, eventBus, ensureOrchestrator } from './store/runtime';
import { Fragment as DomainFragment, PuzzleSummary } from './domain/models';
import { attachOrchestratorStub } from './ai/orchestratorStub';
import { SummaryCard } from './components/SummaryCard';

// --- MOCK DATA ---
const INITIAL_LEVERS: Lever[] = [
  { id: 'L1', name: 'Fiction Becomes Real', color: PALETTE.teal },
  { id: 'L2', name: 'Nostalgic Future', color: PALETTE.orange },
  { id: 'L3', name: 'Human vs Machine', color: PALETTE.purple },
];

const INITIAL_PUZZLES: Puzzle[] = [
  { id: 'P1', leverId: 'L1', title: 'Ground the fantastic in physics', type: 'clarify', description: '...' },
  { id: 'P2', leverId: 'L1', title: 'Exaggerate the scale of technology', type: 'expand', description: '...' },
  { id: 'P3', leverId: 'L2', title: 'Use 80s interface aesthetics', type: 'converge', description: '...' },
  { id: 'P4', leverId: 'L2', title: 'Warm analog color grading', type: 'clarify', description: '...' },
  { id: 'P5', leverId: 'L3', title: 'Show the error in the system', type: 'expand', description: '...' },
];

const INITIAL_FRAGMENTS: FragmentData[] = [
  { id: 'f1', type: FragmentType.TEXT, position: { x: 100, y: 100 }, size: { width: 220, height: 100 }, content: "Design should feel like an artifact from an alternate 1985.", leverId: 'L2', zIndex: 1 },
  { id: 'f2', type: FragmentType.IMAGE, position: { x: 400, y: 150 }, size: { width: 200, height: 180 }, content: "https://picsum.photos/400/300", title: "Retro Console", leverId: 'L2', zIndex: 2 },
  { id: 'f3', type: FragmentType.TEXT, position: { x: 150, y: 350 }, size: { width: 200, height: 80 }, content: "Are we focusing too much on the hardware?", leverId: 'L3', zIndex: 3 },
];

const PROJECT_ID = contextStore.getState().project.id;
const now = () => Date.now();

const mapFragmentType = (type: FragmentType): DomainFragment["type"] => {
  if (type === FragmentType.FRAME) return "OTHER";
  if (type === FragmentType.LINK) return "LINK";
  if (type === FragmentType.IMAGE) return "IMAGE";
  return "TEXT";
};

const toDomainFragment = (f: FragmentData): DomainFragment => ({
  id: f.id,
  projectId: PROJECT_ID,
  type: mapFragmentType(f.type),
  content: f.content,
  position: f.position,
  size: f.size,
  summary: undefined,
  tags: undefined,
  labels: [],
  zIndex: f.zIndex,
  createdAt: now(),
  updatedAt: now(),
});

  const shallowFragmentEqual = (a: FragmentData, b: FragmentData) => {
    return (
      a.type === b.type &&
      a.content === b.content &&
      a.title === b.title &&
    a.leverId === b.leverId &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.size.width === b.size.width &&
    a.size.height === b.size.height &&
    a.zIndex === b.zIndex
  );
};

// --- APP COMPONENT ---
export default function App() {
  // State
  const [lastLog, setLastLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLastLog(prev => [...prev.slice(-4), msg]);
  };

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.POINTER);
  const [fragments, setFragments] = useState<FragmentData[]>(INITIAL_FRAGMENTS);
  const [levers, setLevers] = useState<Lever[]>(INITIAL_LEVERS);
  const [puzzles, setPuzzles] = useState<Puzzle[]>(INITIAL_PUZZLES);
  const [activeLeverId, setActiveLeverId] = useState<string | null>(null);
  const [projectTitle] = useState(contextStore.getState().project.title);
  const [aim, setAim] = useState(contextStore.getState().project.processAim);
  const [puzzleSummaries, setPuzzleSummaries] = useState(contextStore.getState().puzzleSummaries);
  const [showDebug, setShowDebug] = useState(true);
  const [storeFragments, setStoreFragments] = useState(contextStore.getState().fragments);

  // Interaction State
  const [interactionMode, setInteractionMode] = useState<'IDLE' | 'DRAG_CANVAS' | 'DRAG_FRAGMENT' | 'RESIZE_FRAGMENT'>('IDLE');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const prevFragmentsRef = useRef<FragmentData[]>([]);
  const prevPuzzlesRef = useRef<Puzzle[]>([]);

  // Refs for direct DOM manipulation (Performance)
  const containerRef = useRef<HTMLDivElement>(null);
  const fragmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragStartRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const initialDataRef = useRef<{ x: number, y: number, w: number, h: number }>({ x: 0, y: 0, w: 0, h: 0 });

  // Refs for Frame Containment
  const draggedChildrenRef = useRef<string[]>([]);
  const initialChildrenDataRef = useRef<Map<string, { x: number, y: number }>>(new Map());
  const pendingImagePosition = useRef<{ x: number, y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detachOrchestratorRef = useRef<null | (() => void)>(null);

  // --- MOUSE HANDLERS ---

  // Toggle debug overlay with backtick key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '`') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      }
      // Delete fragment via Delete/Backspace when not typing in inputs
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        setFragments(prev => prev.filter(f => f.id !== selection));
        setSelection(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selection]);

  // Attach orchestrator stub once
  useEffect(() => {
    if (detachOrchestratorRef.current) return;
    detachOrchestratorRef.current = ensureOrchestrator();
    return () => {
      detachOrchestratorRef.current?.();
    };
  }, []);

  // Subscribe to store changes so UI can reflect agent-updated summaries/tags and summaries
  useEffect(() => {
    const unsub = contextStore.subscribe(() => {
      const state = contextStore.getState();
      setStoreFragments(state.fragments);
      setPuzzleSummaries(state.puzzleSummaries);
      console.debug("[app] store updated", {
        fragments: state.fragments.length,
        summaries: state.puzzleSummaries.length
      });
    });
    return () => unsub();
  }, []);

  // Sync aim into ProjectStore
  useEffect(() => {
    contextStore.updateProcessAim(aim);
  }, [aim]);

  // Sync fragments into ProjectStore and emit UI events
  useEffect(() => {
    const prevMap = new Map(prevFragmentsRef.current.map(f => [f.id, f]));

    fragments.forEach(f => {
      const prev = prevMap.get(f.id);
      const domainFrag = toDomainFragment(f);
      if (!prev) {
        contextStore.upsertFragment(domainFrag);
        eventBus.emitType("FRAGMENT_ADDED", { fragmentId: f.id });
      } else if (!shallowFragmentEqual(prev, f)) {
        contextStore.upsertFragment(domainFrag);
        eventBus.emitType("FRAGMENT_UPDATED", { fragmentId: f.id });
      }
      prevMap.delete(f.id);
    });

    prevMap.forEach((_, id) => {
      contextStore.deleteFragment(id);
      eventBus.emitType("FRAGMENT_DELETED", { fragmentId: id });
    });

    prevFragmentsRef.current = fragments;
  }, [fragments]);

  // Sync puzzles into ProjectStore (deck keeps all puzzles; summary status handled elsewhere)
  useEffect(() => {
    const prevMap = new Map(prevPuzzlesRef.current.map(p => [p.id, p]));
    puzzles.forEach(p => {
      const prev = prevMap.get(p.id);
      const domainPuzzle = {
        id: p.id,
        projectId: PROJECT_ID,
        centralQuestion: p.title,
        createdFrom: "user_request" as const,
        createdAt: now(),
      };
      if (!prev) {
        contextStore.addPuzzle(domainPuzzle);
        eventBus.emitType("PUZZLE_CREATED", { puzzleId: p.id });
      } else {
        contextStore.addPuzzle(domainPuzzle);
        eventBus.emitType("PUZZLE_UPDATED", { puzzleId: p.id });
      }
      prevMap.delete(p.id);
    });
    prevMap.forEach((_, id) => {
      // No delete yet; deck keeps historical puzzle entries
    });
    prevPuzzlesRef.current = puzzles;
  }, [puzzles]);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.1, scale - e.deltaY * zoomSensitivity), 3);
      setScale(newScale);
    } else {
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // If middle click or spacebar held (simulated via logic), start canvas drag
    if (e.button === 1 || (activeTool === ToolType.POINTER && e.target === containerRef.current)) {
      setInteractionMode('DRAG_CANVAS');
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      initialDataRef.current = { x: offset.x, y: offset.y, w: 0, h: 0 };
    }
    else if (activeTool === ToolType.TEXT) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - offset.x) / scale;
        const y = (e.clientY - rect.top - offset.y) / scale;
        createFragment(FragmentType.TEXT, x, y);
        setActiveTool(ToolType.POINTER);
      }
    }
    else if (activeTool === ToolType.IMAGE) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - offset.x) / scale;
        const y = (e.clientY - rect.top - offset.y) / scale;
        pendingImagePosition.current = { x, y };
        fileInputRef.current?.click();
      }
    }
    else if (activeTool === ToolType.FRAME) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (e.clientX - rect.left - offset.x) / scale;
        const y = (e.clientY - rect.top - offset.y) / scale;

        // Create frame with 0 size initially
        const newId = createFragment(FragmentType.FRAME, x, y, undefined, { width: 0, height: 0 });

        // Immediately start resizing it
        setInteractionMode('RESIZE_FRAGMENT');
        setActiveId(newId);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialDataRef.current = { x: 0, y: 0, w: 0, h: 0 }; // w/h 0 to start

        // We don't reset tool yet, wait for mouse up
      }
    }
  };

  const handleFragmentMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeTool === ToolType.POINTER) {
      setInteractionMode('DRAG_FRAGMENT');
      setActiveId(id);
      setSelection(id);
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      const frag = fragments.find(f => f.id === id);
      if (frag) {
        initialDataRef.current = { x: frag.position.x, y: frag.position.y, w: 0, h: 0 };

        addLog(`Click ${id} ${frag.type}`);

        // Check if Frame
        if (frag.type === FragmentType.FRAME) {
          // Find children inside
          const children = fragments.filter(child => {
            if (child.id === id) return false;
            const isInside =
              child.position.x >= frag.position.x &&
              child.position.x + child.size.width <= frag.position.x + frag.size.width &&
              child.position.y >= frag.position.y &&
              child.position.y + child.size.height <= frag.position.y + frag.size.height;

            addLog(`Chk ${child.id.slice(-4)}: ${isInside ? 'IN' : 'OUT'} (${Math.round(child.position.x)},${Math.round(child.position.y)}) vs (${Math.round(frag.position.x)},${Math.round(frag.position.y)})`);
            return isInside;
          });

          addLog(`Found ${children.length} children`);

          draggedChildrenRef.current = children.map(c => c.id);
          initialChildrenDataRef.current.clear();
          children.forEach(c => {
            initialChildrenDataRef.current.set(c.id, { x: c.position.x, y: c.position.y });
          });

          // Do NOT bring frame to front of content.
          // Maybe bring to front of other frames? For now, just don't change zIndex.
        } else {
          draggedChildrenRef.current = [];
          initialChildrenDataRef.current.clear();

          // Bring content to front (above everything else)
          // Ensure it's at least 100
          const maxZ = Math.max(100, ...fragments.map(p => p.zIndex));
          setFragments(prev => prev.map(f => f.id === id ? { ...f, zIndex: maxZ + 1 } : f));
        }

        // Update Active Lever
        if (frag.leverId) setActiveLeverId(frag.leverId);
        else setActiveLeverId(null);
      }
    }
  };

  const handleResizeStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setInteractionMode('RESIZE_FRAGMENT');
    setActiveId(id);
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const frag = fragments.find(f => f.id === id);
    if (frag) {
      initialDataRef.current = { x: 0, y: 0, w: frag.size.width, h: frag.size.height };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (interactionMode === 'DRAG_CANVAS') {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOffset({ x: initialDataRef.current.x + dx, y: initialDataRef.current.y + dy });
    }
    else if (interactionMode === 'DRAG_FRAGMENT' && activeId) {
      const dx = (e.clientX - dragStartRef.current.x) / scale;
      const dy = (e.clientY - dragStartRef.current.y) / scale;

      // Direct DOM manipulation for performance
      const el = fragmentRefs.current.get(activeId);
      if (el) {
        const newX = initialDataRef.current.x + dx;
        const newY = initialDataRef.current.y + dy;
        el.style.transform = `translate(${newX}px, ${newY}px)`;

        // Move children if any
        draggedChildrenRef.current.forEach(childId => {
          const childEl = fragmentRefs.current.get(childId);
          const initialChild = initialChildrenDataRef.current.get(childId);
          if (childEl && initialChild) {
            const childNewX = initialChild.x + dx;
            const childNewY = initialChild.y + dy;
            childEl.style.transform = `translate(${childNewX}px, ${childNewY}px)`;
          }
        });
      }
    }
    else if (interactionMode === 'RESIZE_FRAGMENT' && activeId) {
      const dx = (e.clientX - dragStartRef.current.x) / scale;
      const dy = (e.clientY - dragStartRef.current.y) / scale;

      // Direct DOM manipulation
      const el = fragmentRefs.current.get(activeId);
      if (el) {
        // For frames creation, we allow small sizes initially
        const minSize = activeTool === ToolType.FRAME ? 10 : 60;
        const newW = Math.max(minSize, initialDataRef.current.w + dx);
        const newH = Math.max(minSize, initialDataRef.current.h + dy);
        el.style.width = `${newW}px`;
        el.style.height = `${newH}px`;
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (interactionMode === 'DRAG_FRAGMENT' && activeId) {
      const dx = (e.clientX - dragStartRef.current.x) / scale;
      const dy = (e.clientY - dragStartRef.current.y) / scale;

      // Sync final position to state
      setFragments(prev => prev.map(f => {
        if (f.id === activeId) {
          return { ...f, position: { x: initialDataRef.current.x + dx, y: initialDataRef.current.y + dy } };
        }
        // Sync children
        if (draggedChildrenRef.current.includes(f.id)) {
          const initialChild = initialChildrenDataRef.current.get(f.id);
          if (initialChild) {
            return { ...f, position: { x: initialChild.x + dx, y: initialChild.y + dy } };
          }
        }
        return f;
      }));

      draggedChildrenRef.current = [];
      initialChildrenDataRef.current.clear();
    }
    else if (interactionMode === 'RESIZE_FRAGMENT' && activeId) {
      const dx = (e.clientX - dragStartRef.current.x) / scale;
      const dy = (e.clientY - dragStartRef.current.y) / scale;

      // Sync final size to state
      setFragments(prev => prev.map(f =>
        f.id === activeId
          ? { ...f, size: { width: Math.max(activeTool === ToolType.FRAME ? 10 : 60, initialDataRef.current.w + dx), height: Math.max(activeTool === ToolType.FRAME ? 10 : 60, initialDataRef.current.h + dy) } }
          : f
      ));

      if (activeTool === ToolType.FRAME) {
        setActiveTool(ToolType.POINTER);
      }
    }

    setInteractionMode('IDLE');
    setActiveId(null);
  };

  // --- ACTIONS ---

  const createFragment = (type: FragmentType, x: number, y: number, contentOverride?: string, sizeOverride?: { width: number, height: number }) => {
    const id = Date.now().toString();
    const newFragment: FragmentData = {
      id,
      type,
      position: { x, y },
      size: sizeOverride || (type === FragmentType.TEXT ? { width: 200, height: 100 } : { width: 200, height: 200 }),
      content: contentOverride || (type === FragmentType.TEXT ? "" : type === FragmentType.IMAGE ? "https://picsum.photos/200/200" : ""),
      title: type === FragmentType.FRAME ? "New Frame" : undefined,
      zIndex: type === FragmentType.FRAME ? 0 : fragments.length + 1 // Frames at bottom
    };
    flushSync(() => {
      setFragments(prev => [...prev, newFragment]);
      setSelection(id);
    });
    return id;
  };

  const handleUpdateFragment = (id: string, content: string) => {
    setFragments(prev => prev.map(f => f.id === id ? { ...f, content } : f));
  };

  const handleMockFinishPuzzle = () => {
    if (!puzzles.length) return;
    const target = puzzles[0];
    console.log("[mock] finish puzzle", target.id);
    eventBus.emitType("PUZZLE_FINISH_CLICKED", {
      puzzleId: target.id,
      centralQuestion: target.title,
      anchors: [
        { type: "STARTING", text: "Analog warmth as emotional hook" },
        { type: "SOLUTION", text: "Calm motion to match retro tone" }
      ],
      pieces: [],
      fragmentIds: fragments.slice(0, 2).map(f => f.id)
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        if (pendingImagePosition.current) {
          createFragment(FragmentType.IMAGE, pendingImagePosition.current.x, pendingImagePosition.current.y, url);
          pendingImagePosition.current = null;
          setActiveTool(ToolType.POINTER);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- GEMINI INTEGRATION ---
  const handleAgentTrigger = async () => {
    // 1. Show loading (simple console log for now or toast)
    console.log("Asking Agent...");

    // 2. Analyze
    const resultJson = await analyzeBoard(fragments, aim);

    // 3. Process Result (Mock parsing if JSON is valid)
    try {
      const cleanedJson = resultJson.replace(/```json|```/g, '').trim();
      const result = JSON.parse(cleanedJson);

      if (result.name) {
        // Create new Lever
        const newLever: Lever = {
          id: `L${Date.now()}`,
          name: result.name,
          color: PALETTE.pink // Default new color
        };
        setLevers(prev => [...prev, newLever]);

        // Create a Starter Puzzle for it
        const newPuzzle: Puzzle = {
          id: `P${Date.now()}`,
          leverId: newLever.id,
          title: `Explore ${result.name}`,
          description: result.reason,
          type: 'expand'
        };
        setPuzzles(prev => [newPuzzle, ...prev]);

        alert(`Agent found a new direction: "${result.name}"`);
      }
    } catch (e) {
      console.log("Raw agent response:", resultJson);
    }
  };

  // --- RENDER ---
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#F5F1E8] text-[#262626] flex flex-col relative select-none">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* Background Grid Layer - Static */}
      <div className="absolute inset-0 bg-dot-grid opacity-40 pointer-events-none"></div>

      {/* Top Bar */}
      <TopBar
        projectTitle={projectTitle}
        aim={aim}
        setAim={setAim}
        scale={scale}
        onZoomIn={() => setScale(s => Math.min(s + 0.1, 3))}
        onZoomOut={() => setScale(s => Math.max(s - 0.1, 0.1))}
      />

      {/* Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onAgentTrigger={handleAgentTrigger}
      />

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
          }}
          className="relative w-full h-full"
        >
          {fragments.map(fragment => (
          <Fragment
            key={fragment.id}
            ref={(el) => {
              if (el) fragmentRefs.current.set(fragment.id, el);
              else fragmentRefs.current.delete(fragment.id);
            }}
            data={fragment}
            scale={scale}
            isSelected={selection === fragment.id}
            onMouseDown={handleFragmentMouseDown}
            onResizeStart={handleResizeStart}
            onUpdate={handleUpdateFragment}
            leverColor={levers.find(l => l.id === fragment.leverId)?.color}
            summary={storeFragments.find(sf => sf.id === fragment.id)?.summary}
            tags={storeFragments.find(sf => sf.id === fragment.id)?.tags}
            onDelete={(id) => setFragments(prev => prev.filter(f => f.id !== id))}
          />
        ))}
        </div>
      </div>

      {/* Bottom Puzzle Deck */}
      <PuzzleDeck
        activeLeverId={activeLeverId}
        puzzles={puzzles}
        levers={levers}
        puzzleSummaries={puzzleSummaries}
        onSelectPuzzle={(p) => console.log("Selected puzzle", p.title)}
      />

      {/* Puzzle Summary Cards (placeholder, stacked) */}
      {puzzleSummaries.length > 0 && (
        <div className="absolute left-6 bottom-32 z-30 flex flex-col gap-3 pointer-events-auto">
          {puzzleSummaries.map((s) => (
            <SummaryCard key={s.puzzleId} summary={s} />
          ))}
        </div>
      )}

      {/* Hint for Controls */}
      <div className="absolute bottom-4 right-4 z-40 text-[#A09C94] text-xs font-mono bg-[#F5F1E8]/80 p-2 rounded pointer-events-none">
        Middle Click / Space+Drag to Pan • Scroll to Zoom
      </div>

      {/* Mock finish puzzle button */}
      <div className="absolute bottom-4 left-4 z-40">
        <button
          onClick={handleMockFinishPuzzle}
          className="px-3 py-2 bg-[#262626] text-white text-xs rounded-lg shadow hover:bg-black transition"
        >
          Mock Finish First Puzzle
        </button>
      </div>

      {/* Debug Overlay - Toggle with backtick (`) key */}
      {showDebug && (
        <div className="pointer-events-none fixed top-20 left-4 z-50 bg-black/80 text-green-400 p-4 font-mono text-xs rounded max-w-md">
          <p>Scale: {scale.toFixed(2)}</p>
          <p>Offset: {Math.round(offset.x)}, {Math.round(offset.y)}</p>
          <p>Mode: {interactionMode}</p>
          <p>Active Tool: {activeTool}</p>
          <p>Selection: {selection}</p>
          <p>Dragging: {activeId}</p>
          <p>Fragments: {fragments.length}</p>
          <p>Store Fragments: {storeFragments.length}</p>
          <p>Puzzle Summaries: {puzzleSummaries.length}</p>
          <div className="mt-2 border-t border-green-800 pt-2">
            {lastLog.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        </div>
      )}

    </div>
  );
}
