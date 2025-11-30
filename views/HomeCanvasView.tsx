/**
 * HomeCanvasView
 * The main canvas view where users dump and arrange fragments
 * Extracted from App.tsx for clean view separation
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Toolbar } from '../components/Toolbar';
import { TopBar } from '../components/TopBar';
import { PuzzleDeck } from '../components/PuzzleDeck';
import { Fragment } from '../components/Fragment';
import { ToolType, FragmentType, FragmentData, Lever, Puzzle, PALETTE } from '../types';
import { contextStore, eventBus, setMascotProposalListener } from '../store/runtime';
import { Fragment as DomainFragment, PuzzleSummary } from '../domain/models';
import { SummaryCard } from '../components/SummaryCard';
import { MascotButton } from '../components/mascot/MascotButton';
import { MascotPanel } from '../components/mascot/MascotPanel';
import { MascotProposal } from '../ai/agents/mascotAgent';
import { WelcomeOverlay } from '../components/onboarding/WelcomeOverlay';

// --- MOCK DATA ---
// Levers (strategic directions) - kept for fragment organization
const INITIAL_LEVERS: Lever[] = [
  { id: 'L1', name: 'Fiction Becomes Real', color: PALETTE.teal },
  { id: 'L2', name: 'Nostalgic Future', color: PALETTE.orange },
  { id: 'L3', name: 'Human vs Machine', color: PALETTE.purple },
];

// No mock puzzles - puzzles are created through Mascot AI interaction
const INITIAL_PUZZLES: Puzzle[] = [];

// Convert domain fragment to UI fragment format
const fromDomainFragment = (f: DomainFragment): FragmentData => ({
  id: f.id,
  type: f.type === "IMAGE" ? FragmentType.IMAGE :
        f.type === "LINK" ? FragmentType.LINK :
        f.type === "OTHER" ? FragmentType.FRAME : FragmentType.TEXT,
  position: f.position,
  size: f.size || { width: 200, height: 150 },
  content: f.content,
  title: f.type === "IMAGE" ? "Image" : undefined,
  leverId: f.labels?.[0] || undefined,
  zIndex: f.zIndex || 1,
});

// Load initial fragments from contextStore (populated by mockDataLoader)
const getInitialFragments = (): FragmentData[] => {
  const domainFragments = contextStore.getState().fragments;
  if (domainFragments.length > 0) {
    console.log('[HomeCanvasView] Loading', domainFragments.length, 'fragments from contextStore');
    return domainFragments.map(fromDomainFragment);
  }
  // Fallback to empty if no fragments loaded
  console.log('[HomeCanvasView] No fragments in contextStore, starting empty');
  return [];
};

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

interface HomeCanvasViewProps {
  onEnterPuzzle: (puzzleId: string) => void;
}

export const HomeCanvasView: React.FC<HomeCanvasViewProps> = ({ onEnterPuzzle }) => {
  // State
  const [lastLog, setLastLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLastLog(prev => [...prev.slice(-4), msg]);
  };

  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.POINTER);
  const [fragments, setFragments] = useState<FragmentData[]>(getInitialFragments);
  const [levers, setLevers] = useState<Lever[]>(INITIAL_LEVERS);
  const [puzzles, setPuzzles] = useState<Puzzle[]>(INITIAL_PUZZLES);
  const [activeLeverId, setActiveLeverId] = useState<string | null>(null);
  const [projectTitle] = useState(contextStore.getState().project.title);
  const [aim, setAim] = useState(contextStore.getState().project.processAim);
  const [puzzleSummaries, setPuzzleSummaries] = useState(contextStore.getState().puzzleSummaries);
  const [showDebug, setShowDebug] = useState(true);
  const [storeFragments, setStoreFragments] = useState(contextStore.getState().fragments);

  // Mascot State
  const [isMascotOpen, setIsMascotOpen] = useState(false);
  const [mascotProposal, setMascotProposal] = useState<MascotProposal | null>(null);

  // Onboarding State
  const [showOnboarding, setShowOnboarding] = useState(
    !contextStore.getState().agentState.mascot.hasShownOnboarding
  );

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

  // --- EFFECTS ---

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

  // Subscribe to store changes so UI can reflect agent-updated summaries/tags and summaries
  useEffect(() => {
    const unsub = contextStore.subscribe(() => {
      const state = contextStore.getState();
      setStoreFragments(state.fragments);
      setPuzzleSummaries(state.puzzleSummaries);
      console.debug("[canvas] store updated", {
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

  // Listen for mascot proposals from orchestrator
  useEffect(() => {
    setMascotProposalListener((proposal) => {
      setMascotProposal(proposal);
      addLog(`Mascot proposal: ${proposal.centralQuestion.slice(0, 30)}...`);
    });
  }, []);

  // Sync fragments into ProjectStore and emit UI events
  useEffect(() => {
    const prevMap = new Map<string, FragmentData>(
      prevFragmentsRef.current.map(f => [f.id, f])
    );

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

    prevMap.forEach((_, id: string) => {
      contextStore.deleteFragment(id);
      eventBus.emitType("FRAGMENT_DELETED", { fragmentId: id });
    });

    prevFragmentsRef.current = fragments;
  }, [fragments]);

  // Sync puzzles into ProjectStore
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
    prevPuzzlesRef.current = puzzles;
  }, [puzzles]);

  // --- MOUSE HANDLERS ---

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
        const newId = createFragment(FragmentType.FRAME, x, y, undefined, { width: 0, height: 0 });
        setInteractionMode('RESIZE_FRAGMENT');
        setActiveId(newId);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        initialDataRef.current = { x: 0, y: 0, w: 0, h: 0 };
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

        if (frag.type === FragmentType.FRAME) {
          const children = fragments.filter(child => {
            if (child.id === id) return false;
            const isInside =
              child.position.x >= frag.position.x &&
              child.position.x + child.size.width <= frag.position.x + frag.size.width &&
              child.position.y >= frag.position.y &&
              child.position.y + child.size.height <= frag.position.y + frag.size.height;
            return isInside;
          });

          draggedChildrenRef.current = children.map(c => c.id);
          initialChildrenDataRef.current.clear();
          children.forEach(c => {
            initialChildrenDataRef.current.set(c.id, { x: c.position.x, y: c.position.y });
          });
        } else {
          draggedChildrenRef.current = [];
          initialChildrenDataRef.current.clear();
          const maxZ = Math.max(100, ...fragments.map(p => p.zIndex));
          setFragments(prev => prev.map(f => f.id === id ? { ...f, zIndex: maxZ + 1 } : f));
        }

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

      const el = fragmentRefs.current.get(activeId);
      if (el) {
        const newX = initialDataRef.current.x + dx;
        const newY = initialDataRef.current.y + dy;
        el.style.transform = `translate(${newX}px, ${newY}px)`;

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

      const el = fragmentRefs.current.get(activeId);
      if (el) {
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

      setFragments(prev => prev.map(f => {
        if (f.id === activeId) {
          return { ...f, position: { x: initialDataRef.current.x + dx, y: initialDataRef.current.y + dy } };
        }
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
      zIndex: type === FragmentType.FRAME ? 0 : fragments.length + 1
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

  // Mascot handlers
  const handleMascotOpen = () => {
    setIsMascotOpen(true);
    setMascotProposal(null);
  };

  const handleMascotClose = () => {
    setIsMascotOpen(false);
  };

  const handleStartPuzzle = (proposal: MascotProposal) => {
    const newPuzzle: Puzzle = {
      id: `P${puzzles.length + 1}`,
      leverId: activeLeverId || levers[0]?.id || 'L1',
      title: proposal.centralQuestion,
      type: 'clarify',
      description: proposal.rationale,
    };

    setPuzzles(prev => [...prev, newPuzzle]);
    addLog(`Created puzzle: ${newPuzzle.title.slice(0, 30)}...`);

    setIsMascotOpen(false);
    setMascotProposal(null);
  };

  // Onboarding handlers
  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setAim(contextStore.getState().project.processAim);
  };

  // Handle puzzle card click - navigate to puzzle session
  const handleSelectPuzzle = (puzzle: Puzzle) => {
    const isFinished = puzzleSummaries.some(s => s.puzzleId === puzzle.id);
    if (isFinished) {
      addLog(`Viewing finished puzzle: ${puzzle.title.slice(0, 20)}...`);
      // TODO: Could show expanded summary here
    } else {
      addLog(`Entering puzzle: ${puzzle.title.slice(0, 20)}...`);
      onEnterPuzzle(puzzle.id);
    }
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
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        onSelectPuzzle={handleSelectPuzzle}
      />

      {/* Puzzle Summary Cards */}
      {puzzleSummaries.length > 0 && (
        <div className="absolute left-6 bottom-32 z-30 flex flex-col gap-3 pointer-events-auto">
          {puzzleSummaries.map((s) => (
            <SummaryCard key={s.puzzleId} summary={s} />
          ))}
        </div>
      )}

      {/* Hint for Controls */}
      <div className="absolute bottom-4 right-4 z-40 text-[#A09C94] text-xs font-mono bg-[#F5F1E8]/80 p-2 rounded pointer-events-none">
        Middle Click / Space+Drag to Pan | Scroll to Zoom | Click puzzle card to enter
      </div>

      {/* Mascot Button */}
      <MascotButton onClick={handleMascotOpen} />

      {/* Mascot Panel */}
      <MascotPanel
        isOpen={isMascotOpen}
        onClose={handleMascotClose}
        proposal={mascotProposal}
        onStartPuzzle={handleStartPuzzle}
      />

      {/* Debug Overlay - Toggle with backtick (`) key */}
      {showDebug && (
        <div className="pointer-events-none fixed top-20 left-4 z-50 bg-black/80 text-green-400 p-4 font-mono text-xs rounded max-w-md">
          <p>Scale: {scale.toFixed(2)}</p>
          <p>Offset: {Math.round(offset.x)}, {Math.round(offset.y)}</p>
          <p>Mode: {interactionMode}</p>
          <p>Active Tool: {activeTool}</p>
          <p>Selection: {selection}</p>
          <p>Fragments: {fragments.length}</p>
          <p>Store Fragments: {storeFragments.length}</p>
          <p>Puzzle Summaries: {puzzleSummaries.length}</p>
          <div className="mt-2 border-t border-green-800 pt-2">
            {lastLog.map((log, i) => <div key={i}>{log}</div>)}
          </div>
        </div>
      )}

      {/* Welcome Onboarding Overlay */}
      {showOnboarding && (
        <WelcomeOverlay onComplete={handleOnboardingComplete} />
      )}
    </div>
  );
};

export default HomeCanvasView;
