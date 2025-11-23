import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { TopBar } from './components/TopBar';
import { PuzzleDeck } from './components/PuzzleDeck';
import { Fragment } from './components/Fragment';
import { ToolType, FragmentType, FragmentData, Lever, Puzzle, PALETTE } from './types';
import { analyzeBoard } from './services/geminiService';
import { Plus } from 'lucide-react';

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

// --- APP COMPONENT ---
export default function App() {
  // State
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.POINTER);
  const [fragments, setFragments] = useState<FragmentData[]>(INITIAL_FRAGMENTS);
  const [levers, setLevers] = useState<Lever[]>(INITIAL_LEVERS);
  const [puzzles, setPuzzles] = useState<Puzzle[]>(INITIAL_PUZZLES);
  const [activeLeverId, setActiveLeverId] = useState<string | null>(null);
  const [projectTitle] = useState("Sci-Fi Animation Concept");
  const [aim, setAim] = useState("Explore the tension between analog warmth and digital coldness.");
  
  // Interaction State
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [draggingFragmentId, setDraggingFragmentId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [canvasDragStart, setCanvasDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // --- MOUSE HANDLERS ---

  const handleWheel = (e: React.WheelEvent) => {
    // Zoom logic centered on mouse cursor is complex for a quick demo,
    // so we'll do simple center zoom or just increment scale.
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomSensitivity = 0.001;
      const newScale = Math.min(Math.max(0.1, scale - e.deltaY * zoomSensitivity), 3);
      setScale(newScale);
    } else {
      // Pan
      setOffset(prev => ({
        x: prev.x - e.deltaX,
        y: prev.y - e.deltaY
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // If middle click or spacebar held (simulated via logic), start canvas drag
    if (e.button === 1 || activeTool === ToolType.POINTER && e.target === containerRef.current) {
      setIsDraggingCanvas(true);
      setCanvasDragStart({ x: e.clientX, y: e.clientY });
    } else if (activeTool === ToolType.TEXT) {
       // Create text note on click
       const rect = containerRef.current?.getBoundingClientRect();
       if(rect) {
           const x = (e.clientX - rect.left - offset.x) / scale;
           const y = (e.clientY - rect.top - offset.y) / scale;
           createFragment(FragmentType.TEXT, x, y);
           setActiveTool(ToolType.POINTER);
       }
    }
  };

  const handleFragmentMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (activeTool === ToolType.POINTER) {
      setDraggingFragmentId(id);
      setSelection(id);
      setDragStart({ x: e.clientX, y: e.clientY });
      
      // Bring to front
      setFragments(prev => prev.map(f => f.id === id ? { ...f, zIndex: Math.max(...prev.map(p => p.zIndex)) + 1 } : f));

      // Update Active Lever based on selection
      const frag = fragments.find(f => f.id === id);
      if (frag?.leverId) setActiveLeverId(frag.leverId);
      else setActiveLeverId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingCanvas) {
      const dx = e.clientX - canvasDragStart.x;
      const dy = e.clientY - canvasDragStart.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setCanvasDragStart({ x: e.clientX, y: e.clientY });
    } else if (draggingFragmentId) {
      const dx = (e.clientX - dragStart.x) / scale;
      const dy = (e.clientY - dragStart.y) / scale;
      
      setFragments(prev => prev.map(f => 
        f.id === draggingFragmentId 
          ? { ...f, position: { x: f.position.x + dx, y: f.position.y + dy } }
          : f
      ));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggingFragmentId(null);
  };

  // --- ACTIONS ---

  const createFragment = (type: FragmentType, x: number, y: number) => {
    const newFragment: FragmentData = {
      id: Date.now().toString(),
      type,
      position: { x, y },
      size: type === FragmentType.TEXT ? { width: 200, height: 100 } : { width: 200, height: 200 },
      content: type === FragmentType.TEXT ? "" : "https://picsum.photos/200/200",
      zIndex: fragments.length + 1
    };
    setFragments([...fragments, newFragment]);
    setSelection(newFragment.id);
  };

  const handleUpdateFragment = (id: string, content: string) => {
    setFragments(prev => prev.map(f => f.id === id ? { ...f, content } : f));
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
           {fragments.map(frag => (
             <Fragment 
               key={frag.id} 
               data={frag} 
               scale={scale}
               isSelected={selection === frag.id}
               onMouseDown={handleFragmentMouseDown}
               onUpdate={handleUpdateFragment}
               leverColor={levers.find(l => l.id === frag.leverId)?.color}
             />
           ))}
        </div>
      </div>

      {/* Bottom Puzzle Deck */}
      <PuzzleDeck 
        activeLeverId={activeLeverId} 
        puzzles={puzzles} 
        levers={levers}
        onSelectPuzzle={(p) => console.log("Selected puzzle", p.title)}
      />

      {/* Hint for Controls */}
      <div className="absolute bottom-4 right-4 z-40 text-[#A09C94] text-xs font-mono bg-[#F5F1E8]/80 p-2 rounded pointer-events-none">
        Middle Click / Space+Drag to Pan • Scroll to Zoom
      </div>

    </div>
  );
}
