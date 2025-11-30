# BUILDING.md - Puzzle AI System Integration Document

**Last Updated**: 2025-11-30
**Status**: Integration Planning

---

## 1. Project Overview

### 1.1 Product Vision

**Puzzle AI** is an AI thinking partner for creative work, enabling **sense-making and convergence** rather than just idea generation.

Users work in **two layers**:
1. **Home Canvas** - Dump and arrange ideas as fragments (Miro-style infinite canvas)
2. **Puzzle Session** - Focused 4-quadrant "thinking puzzles" around a central question

An **AI Mascot** serves as the single entry point for all AI interactions:
- Teaches "how to play"
- Launches puzzles (user-raised or AI-suggested)
- Occasionally reflects patterns in the work

### 1.2 Core AI Operations

| Operation | Description | Layer |
|-----------|-------------|-------|
| **Clarify** | Make vague intent more precise | Puzzle Session |
| **Expand** | Grow or diversify options | Puzzle Session |
| **Refine** | Narrow and polish toward direction | Puzzle Session |
| **Connect** | Link perspectives across sessions | Home Canvas |

### 1.3 The 4-Quadrant Framework

Every Puzzle Session uses fixed quadrants as different "lenses":
- **FORM** - How it looks (shape, layout, visual structure)
- **MOTION** - How it moves/changes (rhythm, transitions, energy)
- **EXPRESSION** - What it feels like (mood, tone, personality)
- **FUNCTION** - What it needs to do (goals, constraints, audience)

---

## 2. Current Architecture

### 2.1 Technology Stack

```
Frontend:   React 19.2 + TypeScript + Vite
AI:         Google Gemini API (@google/genai v1.30.0)
State:      Custom ProjectStore with undo/redo
Styling:    Tailwind CSS (via CDN)
Animations: Framer Motion (puzzle_session)
Storage:    In-memory (IndexedDB planned)
```

### 2.2 Existing File Structure

```
puzzle_AI/
├── App.tsx                     # Main Home Canvas application
├── types.ts                    # Local types (FragmentData, Lever, Puzzle)
├── index.tsx                   # Entry point
├── vite.config.ts
├── .env                        # VITE_GEMINI_API_KEY, VITE_GEMINI_MODEL
│
├── components/                 # Home Canvas UI components
│   ├── Fragment.tsx           # Canvas fragment (TEXT/IMAGE/FRAME)
│   ├── TopBar.tsx             # Header with Process Aim
│   ├── Toolbar.tsx            # Left-side tools
│   ├── PuzzleDeck.tsx         # Bottom puzzle card deck
│   ├── SummaryCard.tsx        # Puzzle summary display
│   ├── mascot/
│   │   ├── MascotButton.tsx   # Floating AI button
│   │   └── MascotPanel.tsx    # AI interaction panel
│   └── onboarding/
│       └── WelcomeOverlay.tsx # First-time user guide
│
├── domain/                     # Shared domain models
│   └── models.ts              # Fragment, Puzzle, PuzzlePiece, Anchor, etc.
│
├── store/                      # State management
│   ├── contextStore.ts        # ProjectStore with undo/redo
│   ├── eventBus.ts            # UIEvent pub/sub
│   ├── preferenceProfile.ts   # User preference tracking
│   └── runtime.ts             # Singleton instances
│
├── ai/                         # AI orchestration layer
│   ├── orchestrator.ts        # Event-driven AI coordinator
│   ├── orchestratorStub.ts    # Mock fallback
│   ├── adkClient.ts           # Gemini API client
│   └── agents/
│       ├── fragmentContextAgent.ts
│       ├── mascotAgent.ts
│       ├── puzzleDesignerAgent.ts
│       └── quadrantPieceAgent.ts
│
├── services/
│   └── geminiService.ts       # Legacy direct API calls
│
└── puzzle_session/             # SEPARATE: Standalone puzzle view (to integrate)
    ├── App.tsx
    ├── index.tsx
    ├── types.ts               # Position, Piece, QuadrantType
    ├── store.ts               # Zustand game store
    ├── constants.ts           # CELL_SIZE, COLORS, SHAPES
    └── components/
        ├── Board.tsx          # Main puzzle board
        ├── GridBackground.tsx # 4-quadrant grid with crosshair
        ├── CenterCard.tsx     # Central question card
        ├── PuzzlePiece.tsx    # Draggable Tetris-like piece
        ├── QuadrantSpawner.tsx # Corner piece spawners
        └── Mascot.tsx         # Puzzle session mascot
```

---

## 3. What's Implemented vs What's Missing

### 3.1 Home Canvas Layer (Main App)

| Feature | Status | Notes |
|---------|--------|-------|
| Canvas with pan/zoom | ✅ Complete | Mouse wheel + drag |
| Fragment CRUD | ✅ Complete | TEXT, IMAGE, FRAME types |
| Toolbar | ✅ Complete | Pointer, Text, Image, Frame tools |
| TopBar with Process Aim | ✅ Complete | With validation + tooltip |
| PuzzleDeck | ✅ Complete | Hover animation, finished badges |
| Mascot Button | ✅ Complete | Floating entry point |
| Mascot Panel | ✅ Complete | Suggest + Question modes |
| Welcome Onboarding | ✅ Complete | First-time Process Aim setup |
| Fragment Context Agent | ✅ Complete | AI summaries/tags |
| Mascot Agent | ✅ Complete | Puzzle proposal generation |
| Puzzle Designer Agent | ✅ Complete | Puzzle summarization |
| Orchestrator | ✅ Complete | Event-driven, singleton pattern |
| SummaryCard display | ✅ Complete | Shows finished puzzle summaries |
| Fragment puzzle labels | ✅ Complete | HSL-colored badges |

### 3.2 Puzzle Session Layer (puzzle_session/)

| Feature | Status | Notes |
|---------|--------|-------|
| 4-Quadrant grid background | ✅ Complete | With crosshair divider |
| CenterCard (central question) | ✅ Complete | Dark card with connectors |
| QuadrantSpawner (4 corners) | ✅ Complete | Drag to spawn pieces |
| PuzzlePiece (Tetris-like blocks) | ✅ Complete | Multi-cell shapes, drag & drop |
| Zustand game store | ✅ Complete | Collision + connection validation |
| Random shape generation | ✅ Complete | 8 shape presets |
| Random label generation | ✅ Complete | Per-quadrant labels |
| Shake-to-reroll label | ✅ Complete | Gesture detection |
| Piece opacity gradient | ✅ Complete | Distance from center |
| Mascot (static) | ✅ Complete | Animated with hint bubble |
| End this Puzzle button | ⚠️ Placeholder | No handler connected |
| Undo/Redo buttons | ⚠️ Placeholder | No logic connected |

### 3.3 Critical Integration Gaps

| Gap | Impact | Solution |
|-----|--------|----------|
| No navigation between canvas ↔ puzzle | Users stuck on one view | Add view router + transition |
| puzzle_session uses separate store | State not shared | Integrate with contextStore |
| PuzzlePiece not connected to domain model | AI can't analyze pieces | Map to PuzzlePiece type |
| No "End Puzzle" handler | Can't complete puzzles | Connect to PUZZLE_FINISH_CLICKED |
| QuadrantSpawner not AI-connected | Only random labels | Connect to quadrantPieceAgent |
| Central question hardcoded | Says "Matcha Brand" | Pass from selected Puzzle |
| Anchors (Starting/Solution) missing | Core concept not visible | Add anchor UI components |

---

## 4. User Flow: Canvas → Puzzle → Canvas

Based on UX mockups (`Figma/ux/`):

```
┌─────────────────────────────────────────────────────────────────────┐
│  HOME CANVAS                                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Fragments scattered on infinite canvas                       │   │
│  │ AI generates summaries/tags in background                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              │ Mascot suggests puzzle               │
│                              │ or User creates via MascotPanel      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ PUZZLE DECK - Cards appear at bottom                         │   │
│  │ [Puzzle A] [Puzzle B] [Puzzle C]                             │   │
│  │     ↑ Click card shows "Entering your puzzle..." modal       │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ View transition (loading animation)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PUZZLE SESSION                                                     │
│  ┌─────────────┐                               ┌─────────────┐     │
│  │   FORM      │───────────────────────────────│   MOTION    │     │
│  │  [Spawner]  │                               │  [Spawner]  │     │
│  └─────────────┘                               └─────────────┘     │
│                         ┌───────────┐                               │
│                         │  CENTRAL  │                               │
│                         │ QUESTION  │                               │
│                         │           │                               │
│                         └───────────┘                               │
│  ┌─────────────┐                               ┌─────────────┐     │
│  │ EXPRESSION  │                               │  FUNCTION   │     │
│  │  [Spawner]  │───────────────────────────────│  [Spawner]  │     │
│  └─────────────┘                               └─────────────┘     │
│                                                                     │
│  User drags pieces from spawners → attaches near center/anchors     │
│  AI generates piece suggestions based on context                    │
│  User edits annotations, connects pieces                            │
│                                                                     │
│  [End this Puzzle] → Triggers summary generation                    │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ Summary generated, view transitions back
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  HOME CANVAS (updated)                                              │
│  - SummaryCard appears near related fragments                       │
│  - Linked fragments show colored puzzle label badges                │
│  - Puzzle card in deck shows "Finished" checkmark                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Integrated File Structure (Post-Integration)

```
puzzle_AI/
├── App.tsx                     # Root app with view routing
├── types.ts                    # Shared local types
├── index.tsx
├── vite.config.ts
├── .env
│
├── views/                      # NEW: Top-level views
│   ├── HomeCanvasView.tsx     # Extracted from current App.tsx
│   └── PuzzleSessionView.tsx  # Integrated from puzzle_session
│
├── components/
│   ├── common/                 # NEW: Shared components
│   │   ├── LoadingTransition.tsx   # "Entering your puzzle..." modal
│   │   └── ViewContainer.tsx       # Shared layout wrapper
│   │
│   ├── canvas/                 # Home Canvas components (renamed)
│   │   ├── Fragment.tsx
│   │   ├── TopBar.tsx
│   │   ├── Toolbar.tsx
│   │   ├── PuzzleDeck.tsx
│   │   └── SummaryCard.tsx
│   │
│   ├── puzzle/                 # NEW: Puzzle Session components
│   │   ├── PuzzleBoard.tsx         # Main board (from Board.tsx)
│   │   ├── GridBackground.tsx
│   │   ├── CenterCard.tsx          # Shows actual central question
│   │   ├── PuzzlePiece.tsx
│   │   ├── QuadrantSpawner.tsx
│   │   ├── AnchorCard.tsx          # NEW: Starting/Solution anchors
│   │   └── PuzzleTopBar.tsx        # NEW: Header with End button
│   │
│   ├── mascot/
│   │   ├── MascotButton.tsx
│   │   ├── MascotPanel.tsx
│   │   └── PuzzleMascot.tsx        # Integrated from puzzle_session
│   │
│   └── onboarding/
│       └── WelcomeOverlay.tsx
│
├── domain/
│   └── models.ts               # Keep as-is (already comprehensive)
│
├── store/
│   ├── contextStore.ts         # Keep as-is
│   ├── eventBus.ts             # Keep as-is
│   ├── runtime.ts              # Keep as-is
│   ├── preferenceProfile.ts    # Keep as-is
│   └── puzzleSessionStore.ts   # NEW: Merged from puzzle_session/store.ts
│
├── ai/
│   ├── orchestrator.ts         # Extended for puzzle session events
│   ├── orchestratorStub.ts
│   ├── adkClient.ts
│   └── agents/
│       ├── fragmentContextAgent.ts
│       ├── mascotAgent.ts
│       ├── puzzleDesignerAgent.ts
│       └── quadrantPieceAgent.ts   # Connect to QuadrantSpawner
│
├── hooks/                      # NEW: Custom React hooks
│   ├── useViewNavigation.ts        # View switching logic
│   └── usePuzzleSession.ts         # Puzzle session state management
│
├── constants/                  # NEW: Shared constants
│   ├── colors.ts                   # Quadrant colors, palette
│   └── puzzleGrid.ts               # CELL_SIZE, SHAPES, etc.
│
└── services/
    └── geminiService.ts        # Can be deprecated (use orchestrator)
```

---

## 6. Component Mapping & Integration Details

### 6.1 View Router (App.tsx)

```typescript
// New App.tsx structure
type AppView = 'canvas' | 'puzzle';

interface AppState {
  currentView: AppView;
  activePuzzleId: string | null;
  isTransitioning: boolean;
}

function App() {
  const [appState, setAppState] = useState<AppState>({
    currentView: 'canvas',
    activePuzzleId: null,
    isTransitioning: false,
  });

  const handleEnterPuzzle = (puzzleId: string) => {
    setAppState({ ...appState, isTransitioning: true, activePuzzleId: puzzleId });
    // Show loading animation
    setTimeout(() => {
      setAppState({ currentView: 'puzzle', activePuzzleId: puzzleId, isTransitioning: false });
    }, 1500);
  };

  const handleExitPuzzle = () => {
    // Trigger summary generation first
    eventBus.emitType('PUZZLE_FINISH_CLICKED', { puzzleId: appState.activePuzzleId });
    setAppState({ currentView: 'canvas', activePuzzleId: null, isTransitioning: false });
  };

  return (
    <>
      {appState.isTransitioning && <LoadingTransition />}
      {appState.currentView === 'canvas' ? (
        <HomeCanvasView onEnterPuzzle={handleEnterPuzzle} />
      ) : (
        <PuzzleSessionView
          puzzleId={appState.activePuzzleId!}
          onExit={handleExitPuzzle}
        />
      )}
    </>
  );
}
```

### 6.2 PuzzleDeck → Puzzle Session Navigation

```typescript
// In PuzzleDeck.tsx - Add click handler
<div
  key={puzzle.id}
  onClick={() => {
    if (isFinished) {
      // Show summary tooltip or expand
      console.log('View finished puzzle summary');
    } else {
      // Enter puzzle session
      onSelectPuzzle(puzzle);  // → App.handleEnterPuzzle
    }
  }}
  // ...
/>
```

### 6.3 CenterCard Integration

```typescript
// Current: Hardcoded "Matcha Brand"
// After: Dynamic from puzzle data

interface CenterCardProps {
  puzzle: Puzzle;
  processAim: string;
}

export const CenterCard: React.FC<CenterCardProps> = ({ puzzle, processAim }) => {
  return (
    <div className="center-card">
      <div className="text-xs text-white/60 mb-2">{processAim.slice(0, 40)}...</div>
      <div className="text-white font-bold text-sm leading-tight">
        {puzzle.centralQuestion}
      </div>
    </div>
  );
};
```

### 6.4 QuadrantSpawner AI Integration

```typescript
// Current: Random labels
// After: AI-generated piece suggestions

interface QuadrantSpawnerProps {
  quadrant: DesignMode;
  puzzleId: string;
  onRequestSuggestion: () => void;
}

// On drag start or "Ask AI" button:
const handleAskAI = () => {
  eventBus.emitType('PIECE_CREATED', {
    mode: quadrant,
    category: 'CLARIFY', // or user selection
    puzzleId,
    anchors: contextStore.getState().anchors.filter(a => a.puzzleId === puzzleId),
    existingPieces: contextStore.getState().puzzlePieces.filter(p => p.puzzleId === puzzleId),
  });
};
```

### 6.5 PuzzlePiece ↔ Domain Model Mapping

```typescript
// puzzle_session/types.ts Piece → domain/models.ts PuzzlePiece

// Visual Piece (for rendering)
interface VisualPiece {
  id: string;
  quadrant: QuadrantType;  // 'form' | 'motion' | 'expression' | 'function'
  color: string;
  position: Position;      // Grid coordinates
  cells: Position[];       // Shape cells
  label?: string;          // Display text (e.g., "Solid", "Flow")
}

// Domain Piece (for AI/storage)
interface PuzzlePiece {
  id: UUID;
  puzzleId: UUID;
  mode: DesignMode;        // 'FORM' | 'MOTION' | 'EXPRESSION' | 'FUNCTION'
  category: PuzzlePieceCategory;
  text: string;            // The question/prompt
  userAnnotation?: string;
  anchorIds: UUID[];
  fragmentLinks: FragmentLink[];
  source: PuzzlePieceSource;
  status: PieceStatus;
}

// Mapping function
const toDomainPiece = (visual: VisualPiece, puzzleId: string): PuzzlePiece => ({
  id: visual.id,
  puzzleId,
  mode: visual.quadrant.toUpperCase() as DesignMode,
  category: 'CLARIFY', // Default, can be inferred or selected
  text: visual.label || '',
  userAnnotation: '',
  anchorIds: [],
  fragmentLinks: [],
  source: 'USER',
  status: 'PLACED',
});
```

### 6.6 Store Unification

```typescript
// puzzleSessionStore.ts - Merged with contextStore integration

import { create } from 'zustand';
import { contextStore } from './runtime';

interface PuzzleSessionState {
  // Visual state (grid-based rendering)
  visualPieces: VisualPiece[];

  // Actions
  addVisualPiece: (piece: VisualPiece) => void;
  moveVisualPiece: (id: string, newPos: Position) => void;
  removeVisualPiece: (id: string) => void;

  // Sync to domain store
  syncToContextStore: (puzzleId: string) => void;
  loadFromContextStore: (puzzleId: string) => void;
}

export const usePuzzleSessionStore = create<PuzzleSessionState>((set, get) => ({
  visualPieces: [],

  addVisualPiece: (piece) => {
    set(state => ({ visualPieces: [...state.visualPieces, piece] }));
    // Also sync to domain store
    const domainPiece = toDomainPiece(piece, /* puzzleId from context */);
    contextStore.upsertPuzzlePiece(domainPiece);
    eventBus.emitType('PIECE_PLACED', { pieceId: piece.id });
  },

  // ...
}));
```

---

## 7. AI Agent Connections

### 7.1 Event → Agent Flow (Extended)

```
┌─────────────────────────────────────────────────────────────────────┐
│  UI EVENT                        │  AGENT                           │
├─────────────────────────────────────────────────────────────────────┤
│  FRAGMENT_ADDED/UPDATED/DELETED  │  fragmentContextAgent            │
│  MASCOT_CLICKED (suggest_puzzle) │  mascotAgent.runMascotSuggest    │
│  MASCOT_CLICKED (my_question)    │  mascotAgent.runMascotSelf       │
│  PUZZLE_FINISH_CLICKED           │  puzzleDesignerAgent (summarize) │
│  PIECE_CREATED (Ask AI)          │  quadrantPieceAgent              │  ← NEW
│  PIECE_PLACED                    │  Update preferenceProfile        │  ← NEW
│  PIECE_EDITED                    │  Update preferenceProfile        │  ← NEW
│  PIECE_DELETED                   │  Update preferenceProfile        │  ← NEW
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Orchestrator Extension

```typescript
// In orchestrator.ts - Add puzzle session handlers

const handlePieceCreated = async (event: UIEvent) => {
  const payload = event.payload as {
    mode: DesignMode;
    category: PuzzlePieceCategory;
    puzzleId: string;
    anchors: Anchor[];
    existingPieces: PuzzlePiece[];
  };

  const state = store.getState();
  const suggestions = await runQuadrantPieceAgent({
    processAim: state.project.processAim,
    mode: payload.mode,
    category: payload.category,
    puzzle: state.puzzles.find(p => p.id === payload.puzzleId)!,
    anchors: payload.anchors,
    existingPiecesForMode: payload.existingPieces.filter(p => p.mode === payload.mode),
    preferenceHint: derivePreferenceHint(state.preferenceProfile, payload.mode, payload.category),
  }, client);

  // Insert AI suggestions with SUGGESTED status
  suggestions.pieces.forEach(p => {
    store.upsertPuzzlePiece({
      id: `ai-${Date.now()}-${Math.random()}`,
      puzzleId: payload.puzzleId,
      mode: p.mode,
      category: p.category,
      text: p.text,
      userAnnotation: '',
      anchorIds: [],
      fragmentLinks: [],
      source: 'AI',
      status: 'SUGGESTED',
    });
  });
};

// Subscribe to new events
case 'PIECE_CREATED':
  handlePieceCreated(event);
  break;
case 'PIECE_PLACED':
case 'PIECE_EDITED':
case 'PIECE_DELETED':
  updatePreferenceProfile(event);
  break;
```

---

## 8. Known Problems & Solutions

### 8.1 Type Duplication

**Problem**: `types.ts` and `domain/models.ts` have overlapping types (Position, Puzzle, Fragment).

**Solution**:
- Keep `domain/models.ts` as source of truth for data models
- Use `types.ts` only for UI-specific types (ToolType, FragmentData with leverId)
- Create explicit mapping functions between them

### 8.2 Zustand vs Custom Store

**Problem**: puzzle_session uses Zustand, main app uses custom contextStore.

**Solution**:
- Keep Zustand for visual/transient puzzle session state (fast drag updates)
- Use contextStore for persistent domain data
- Sync between them on meaningful actions (piece placed, not during drag)

### 8.3 Mock Data in App.tsx

**Problem**: INITIAL_LEVERS, INITIAL_PUZZLES, INITIAL_FRAGMENTS are hardcoded.

**Solution**:
- Move initial data to contextStore initialization
- Use `contextStore.hydrate()` for loading from storage
- Remove local state duplication

### 8.4 Lever vs Cluster Confusion

**Problem**: App.tsx uses "Lever" concept but domain uses "Cluster".

**Solution**: They serve different purposes:
- **Cluster** = AI-detected grouping of related fragments (automatic)
- **Lever** = User-defined strategic direction (manual)
- Keep both, rename Lever UI to something clearer like "Direction" or "Theme"

### 8.5 No Persistence

**Problem**: All data lost on refresh.

**Solution**: Implement StorageAdapter for IndexedDB
```typescript
const indexedDBAdapter: StorageAdapter = {
  async load() {
    const db = await openDB('puzzle-ai', 1, {
      upgrade(db) {
        db.createObjectStore('projects');
      }
    });
    return db.get('projects', 'current');
  },
  async save(store) {
    const db = await openDB('puzzle-ai', 1);
    await db.put('projects', store, 'current');
  }
};
```

---

## 9. Implementation Phases

### Phase 1: View Router & Navigation (2-3 hours)
1. Create `views/` folder with HomeCanvasView and PuzzleSessionView
2. Refactor App.tsx to be view router
3. Add LoadingTransition component
4. Wire PuzzleDeck click → enter puzzle
5. Wire End Puzzle button → exit to canvas

### Phase 2: Puzzle Session Integration (3-4 hours)
1. Move puzzle_session components to `components/puzzle/`
2. Update imports and paths
3. Pass puzzle data to CenterCard
4. Connect QuadrantSpawner to contextStore
5. Map VisualPiece ↔ PuzzlePiece
6. Add anchor UI (placeholder)

### Phase 3: AI Integration (2-3 hours)
1. Extend orchestrator for PIECE_* events
2. Connect QuadrantSpawner "Ask AI" to quadrantPieceAgent
3. Render AI suggestions as ghost pieces
4. Track preference profile updates

### Phase 4: Polish & Testing (2-3 hours)
1. Add AnchorCard components
2. Improve transitions/animations
3. End-to-end flow testing
4. Fix edge cases

---

## 10. Testing Checklist

### Navigation Flow
- [ ] Click puzzle card → Loading animation → Puzzle session view
- [ ] Click "End Puzzle" → Summary generated → Return to canvas
- [ ] Summary card appears near fragments
- [ ] Fragment labels show puzzle badge
- [ ] Puzzle deck card shows "Finished" checkmark

### Puzzle Session
- [ ] Central question displays correctly
- [ ] Four spawners appear in corners
- [ ] Drag from spawner creates piece
- [ ] Piece snaps to grid
- [ ] Pieces connect to center card
- [ ] Pieces can be moved/deleted
- [ ] Shake gesture changes label

### AI Integration
- [ ] "Ask AI" generates piece suggestions
- [ ] AI pieces appear as suggested (different styling)
- [ ] Placing AI piece changes status to PLACED
- [ ] Preference profile updates on actions

---

## 11. Quick Reference

### Key Files to Modify
| File | Changes |
|------|---------|
| `App.tsx` | Add view router, extract canvas logic |
| `components/PuzzleDeck.tsx` | Add onEnterPuzzle prop |
| `puzzle_session/components/CenterCard.tsx` | Accept puzzle prop |
| `puzzle_session/components/Board.tsx` | Rename to PuzzleBoard, add props |
| `ai/orchestrator.ts` | Add PIECE_* event handlers |
| `store/runtime.ts` | Export puzzle session store |

### Key Files to Create
| File | Purpose |
|------|---------|
| `views/HomeCanvasView.tsx` | Extracted canvas view |
| `views/PuzzleSessionView.tsx` | Integrated puzzle view |
| `components/common/LoadingTransition.tsx` | "Entering puzzle..." modal |
| `components/puzzle/AnchorCard.tsx` | Starting/Solution anchors |
| `store/puzzleSessionStore.ts` | Visual piece state (Zustand) |
| `hooks/useViewNavigation.ts` | View switching logic |

### Import Updates
```typescript
// Before
import { Board } from './puzzle_session/components/Board';

// After
import { PuzzleBoard } from '@/components/puzzle/PuzzleBoard';
```

---

**Document Version**: 1.0
**Prepared for**: Puzzle Session Integration Sprint
