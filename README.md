
# Puzzle AI - Complete System Documentation

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Quick Start](#2-quick-start)
3. [File Structure](#3-file-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [State Management](#5-state-management)
6. [AI Pipeline](#6-ai-pipeline)
7. [Background Services](#7-background-services)
8. [Event System](#8-event-system)
9. [Component Hierarchy](#9-component-hierarchy)
10. [Data Models](#10-data-models)
11. [Key Workflows](#11-key-workflows)
12. [Configuration](#12-configuration)
13. [Common Tasks](#13-common-tasks)

---

## 1. Project Overview

### What is Puzzle AI?

A **Four-Quadrant Design Puzzle Framework** that helps users explore design directions through AI-generated puzzle pieces. Users dump fragments (images, text) onto a canvas, then create "puzzle sessions" where AI generates insights organized into four design quadrants:

- **FORM** - Shape, structure, composition
- **MOTION** - Rhythm, animation, timing
- **EXPRESSION** - Emotion, tone, personality
- **FUNCTION** - Audience, context, usability

### Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.0 | UI Framework |
| TypeScript | 5.8.2 | Type Safety |
| Zustand | 5.0.9 | State Management |
| Vite | 6.2.0 | Build Tool |
| @google/genai | 1.30.0 | Gemini AI Integration |
| framer-motion | 12.23.24 | Animations |

---

## 2. Quick Start

### Development

```bash
# Install dependencies
npm install

# Start dev server (runs on http://localhost:3000)
npm run dev

# Build for production
npm run build
```

### Environment Variables

Create `.env` file:
```
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### First Time Reading the Code

1. Start with `App.tsx` - the view router
2. Look at `store/runtime.ts` - service initialization
3. Read `ai/orchestrator.ts` - event handling
4. Explore `ai/adk/runner.ts` - AI workflow

---

## 3. File Structure

```
puzzle_AI/
├── ai/                              # 🤖 AI Layer
│   ├── adk/                         # ADK Framework (primary)
│   │   ├── agents/                  # AI Agents
│   │   │   ├── quadrantManagerAgent.ts   # Coordinates 4 quadrant agents
│   │   │   ├── formAgent.ts              # FORM quadrant specialist
│   │   │   ├── motionAgent.ts            # MOTION quadrant specialist
│   │   │   ├── expressionAgent.ts        # EXPRESSION quadrant specialist
│   │   │   ├── functionAgent.ts          # FUNCTION quadrant specialist
│   │   │   ├── centralQuestionAgent.ts   # Generates puzzle questions
│   │   │   ├── filterAgent.ts            # Diversity filtering
│   │   │   ├── mascotAgent.ts            # Interactive mascot
│   │   │   └── synthesisAgent.ts         # Summary generation
│   │   ├── services/                # Background Services
│   │   │   ├── serviceManager.ts         # Lifecycle manager
│   │   │   ├── contextCollector.ts       # Fragment feature extraction
│   │   │   ├── insightPrecomputer.ts     # Precompute insights
│   │   │   ├── piecePrecomputer.ts       # Precompute pieces
│   │   │   └── index.ts
│   │   ├── tools/                   # Agent Tools
│   │   │   ├── featureStoreTool.ts       # Feature cache
│   │   │   ├── retrievalTool.ts          # Fragment retrieval
│   │   │   ├── preGenPoolTool.ts         # Piece pool management
│   │   │   └── preferenceTool.ts         # User preferences
│   │   ├── schemas/                 # JSON Schemas
│   │   │   └── puzzleSchemas.ts
│   │   ├── types/                   # ADK Types
│   │   │   └── adkTypes.ts
│   │   ├── runner.ts                # Main puzzle workflow
│   │   └── index.ts                 # ADK exports
│   ├── agents/                      # Legacy agents (reference only)
│   ├── stores/                      # AI data stores
│   │   ├── fragmentFeatureStore.ts
│   │   └── preferenceProfileStore.ts
│   ├── retrieval/                   # Fragment ranking
│   │   └── fragmentRanker.ts
│   ├── orchestrator.ts              # 🎯 Main event handler
│   ├── orchestratorStub.ts          # Mock for testing
│   └── adkClient.ts                 # Gemini API client
│
├── store/                           # 📦 State Management
│   ├── contextStore.ts              # Domain state (fragments, puzzles)
│   ├── puzzleSessionStore.ts        # Visual state (pieces on board)
│   ├── puzzleSessionStateStore.ts   # Pre-generated pieces pool
│   ├── eventBus.ts                  # Event pub/sub
│   ├── puzzleSync.ts                # Visual ↔ Domain sync
│   └── runtime.ts                   # 🎯 Service initialization
│
├── components/                      # 🎨 UI Components
│   ├── puzzle/                      # Puzzle board components
│   │   ├── Board.tsx                # Main board container
│   │   ├── PuzzlePiece.tsx          # Draggable piece
│   │   ├── QuadrantSpawner.tsx      # Piece pool UI
│   │   ├── CenterCard.tsx           # Central question
│   │   ├── PuzzleSummaryPopup.tsx   # Summary modal
│   │   └── GridBackground.tsx
│   ├── mascot/                      # Mascot components
│   │   ├── MascotButton.tsx
│   │   └── MascotPanel.tsx
│   ├── common/                      # Shared components
│   │   ├── AIFeedback.tsx           # Toast notifications
│   │   └── LoadingTransition.tsx
│   ├── onboarding/
│   │   └── WelcomeOverlay.tsx
│   ├── Fragment.tsx                 # Canvas fragment card
│   ├── PuzzleDeck.tsx               # Puzzle list
│   ├── TopBar.tsx
│   ├── Toolbar.tsx
│   └── AIStatusIndicator.tsx        # Ready/loading status
│
├── views/                           # 📱 Application Views
│   ├── HomeCanvasView.tsx           # Canvas (fragment dump)
│   └── PuzzleSessionView.tsx        # Puzzle board
│
├── domain/                          # 📋 Domain Models
│   └── models.ts                    # Type definitions
│
├── constants/                       # ⚙️ Configuration
│   ├── puzzleGrid.ts                # Grid sizes, shapes
│   ├── colors.ts                    # Color palettes
│   └── animations.ts
│
├── services/                        # 🔧 App Services
│   └── mockDataLoader.ts            # Demo data
│
├── types.ts                         # Legacy types
├── App.tsx                          # 🎯 Root component
├── index.tsx                        # Entry point
└── index.css                        # Global styles
```

### Key Files to Understand First

| Priority | File | What it Does |
|----------|------|--------------|
| 1 | `App.tsx` | View routing, orchestrator attachment |
| 2 | `store/runtime.ts` | Service initialization, singletons |
| 3 | `ai/orchestrator.ts` | Event handling, AI triggers |
| 4 | `ai/adk/runner.ts` | Puzzle session workflow |
| 5 | `store/contextStore.ts` | Domain state management |

---

## 4. Architecture Overview

### Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (React)                      │
│  Views: HomeCanvasView, PuzzleSessionView               │
│  Components: Board, PuzzlePiece, QuadrantSpawner        │
├─────────────────────────────────────────────────────────┤
│                  Event Layer (EventBus)                  │
│  Pub/Sub for decoupled communication                    │
├─────────────────────────────────────────────────────────┤
│              State Layer (Zustand Stores)               │
│  contextStore, puzzleSessionStore, sessionStateStore    │
├─────────────────────────────────────────────────────────┤
│               Orchestration Layer                        │
│  orchestrator.ts - Event → AI workflow routing          │
├─────────────────────────────────────────────────────────┤
│                  AI Layer (ADK)                          │
│  runner.ts, agents/, services/                          │
├─────────────────────────────────────────────────────────┤
│                   LLM Layer                              │
│  adkClient.ts → Gemini API                              │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → Event → Orchestrator → AI Agents → State Update → UI Update
     ↑                                                              │
     └──────────────────────────────────────────────────────────────┘
```

---

## 5. State Management

### Three Main Stores

#### 1. contextStore - Domain Layer
**File:** `store/contextStore.ts`

Stores the "source of truth" for business data:
```typescript
{
  project: { id, title, processAim },
  fragments: Fragment[],         // Canvas content
  puzzles: Puzzle[],             // Created puzzles
  anchors: Anchor[],             // Starting/Solution text
  puzzlePieces: PuzzlePiece[],   // All pieces ever created
  puzzleSummaries: PuzzleSummary[]
}
```

#### 2. useGameStore - Visual Layer
**File:** `store/puzzleSessionStore.ts`

Stores current puzzle board state:
```typescript
{
  pieces: Piece[],               // Pieces on board NOW
  currentPuzzleId: string,
  quadrantAttachmentCounts: {}   // For sequential colors
}
```

#### 3. usePuzzleSessionStateStore - Pre-Gen Pool
**File:** `store/puzzleSessionStateStore.ts`

Stores AI-generated pieces waiting to be placed:
```typescript
{
  preGeneratedPieces: {
    form: PreGeneratedPiece[],
    motion: PreGeneratedPiece[],
    expression: PreGeneratedPiece[],
    function: PreGeneratedPiece[]
  },
  diversityTracking: {
    usedTexts: Set<string>,
    usedFragmentCounts: Map<string, number>
  }
}
```

### Store Relationship

```
contextStore (Domain)
     ↑
     │ sync via puzzleSync
     ↓
useGameStore (Visual) ←→ usePuzzleSessionStateStore (Pre-Gen Pool)
```

---

## 6. AI Pipeline

### Agent Architecture: 1 Manager + 4 Specialists

```
Input: Fragments + ProcessAim + PuzzleType
                    ↓
┌─────────────────────────────────────────────────────────┐
│            QuadrantManager (Coordinator)                 │
│  1. Assign fragments to modes                           │
│  2. Run 4 agents in PARALLEL                            │
│  3. Collect & deduplicate results                       │
└─────────────────────────────────────────────────────────┘
          ↓           ↓           ↓           ↓
     FormAgent   MotionAgent  ExprAgent   FuncAgent
          ↓           ↓           ↓           ↓
     [Pieces]    [Pieces]     [Pieces]    [Pieces]
                    ↓
              FilterAgent (Diversity)
                    ↓
              Final Pieces Pool
```

### Agent Files

| Agent | File | Responsibility |
|-------|------|----------------|
| Manager | `quadrantManagerAgent.ts` | Coordinate, dedupe |
| Form | `formAgent.ts` | Shape, structure |
| Motion | `motionAgent.ts` | Rhythm, animation |
| Expression | `expressionAgent.ts` | Emotion, tone |
| Function | `functionAgent.ts` | Audience, purpose |
| Filter | `filterAgent.ts` | Remove duplicates |
| Central Q | `centralQuestionAgent.ts` | Generate question |
| Synthesis | `synthesisAgent.ts` | Generate summary |
| Mascot | `mascotAgent.ts` | Interactive suggestions |

### Piece Generation Rules

Each agent generates pieces following strict rules:

1. **Length:** 2-5 words only
2. **Format:** Declarative statements (not questions)
3. **Grounding:** 60%+ must cite a fragment
4. **Forbidden:** "Define...", "Explore...", "Clarify..."
5. **Priority:** 1-2 (core), 3-4 (supporting), 5-6 (detail)

---

## 7. Background Services

### Service Manager (`serviceManager.ts`)

Coordinates all background AI services:

```
App Mount
    ↓
ServiceManager.start()
    ├─→ ContextCollector.processImmediately()
    │       Extract features from all fragments
    │
    ├─→ Subscribe to fragment changes
    │       On change → re-extract features
    │
    ├─→ InsightPrecomputer.startPeriodicRecompute()
    │       Every 15s, regenerate insights
    │
    └─→ ContextCollector.onReady()
            When ready → trigger PiecePrecomputer
```

### Precomputation Flow

```
Fragment Added
    ↓ (500ms debounce)
ContextCollector.extractFeatures()
    ↓ (onReady callback)
InsightPrecomputer.recompute()
    ↓ (when insights ready)
PiecePrecomputer.precomputePieces()
    ↓
Pieces cached (10 min validity)
```

### Cache Validity

```typescript
// Pieces cached by fragment hash
fragmentHash = hash(sorted(fragmentIds))

// Cache valid if:
currentHash === cachedHash && age < 10 minutes
```

---

## 8. Event System

### EventBus (`store/eventBus.ts`)

Simple pub/sub for decoupled communication:

```typescript
// Emit
eventBus.emit({ type: 'PUZZLE_SESSION_STARTED', payload: {...} })
eventBus.emitType('AI_LOADING', { message: 'Generating...' })

// Subscribe
const unsubscribe = eventBus.subscribe((event) => {
  if (event.type === 'PUZZLE_SESSION_GENERATED') {
    // handle
  }
})
```

### Key Events

| Event | When | Handler |
|-------|------|---------|
| `FRAGMENT_ADDED` | User adds fragment | ServiceManager |
| `PUZZLE_SESSION_STARTED` | User starts puzzle | Orchestrator |
| `PUZZLE_SESSION_GENERATED` | AI finishes | SessionStateStore |
| `PUZZLE_FINISH_CLICKED` | User ends session | Orchestrator |
| `PUZZLE_SESSION_COMPLETED` | Summary ready | App.tsx |
| `QUADRANT_REGENERATE` | User requests regenerate | Orchestrator |
| `AI_LOADING` / `AI_ERROR` | Status updates | AIFeedback |

### Event Flow Example

```
User clicks "Create Puzzle"
    ↓
eventBus.emit('PUZZLE_SESSION_STARTED')
    ↓
orchestrator catches event
    ↓
runner.startPuzzleSession()
    ↓
[Agents run in parallel]
    ↓
eventBus.emit('PUZZLE_SESSION_GENERATED')
    ↓
usePuzzleSessionStateStore.setSessionState()
    ↓
UI updates with pre-generated pieces
```

---

## 9. Component Hierarchy

### View Structure

```
App.tsx
├── LoadingTransition (overlay)
├── PuzzleSummaryPopup (modal)
├── AIFeedback (toast)
│
└── currentView === 'canvas'
    │   └── HomeCanvasView
    │       ├── TopBar
    │       ├── Toolbar
    │       ├── Fragment[] (canvas cards)
    │       ├── PuzzleDeck (puzzle list)
    │       ├── MascotButton
    │       ├── MascotPanel
    │       ├── AIStatusIndicator
    │       └── WelcomeOverlay
    │
    └── currentView === 'puzzle'
        └── PuzzleSessionView
            └── Board
                ├── GridBackground
                ├── CenterCard (question)
                ├── PuzzlePiece[] (placed)
                ├── QuadrantSpawner × 4
                └── Mascot
```

### Key Component Responsibilities

| Component | File | Purpose |
|-----------|------|---------|
| `Board` | `puzzle/Board.tsx` | Puzzle board container, drag-drop |
| `PuzzlePiece` | `puzzle/PuzzlePiece.tsx` | Draggable piece, editable |
| `QuadrantSpawner` | `puzzle/QuadrantSpawner.tsx` | Shows pre-gen pieces, spawn on click |
| `CenterCard` | `puzzle/CenterCard.tsx` | Central question display |
| `Fragment` | `Fragment.tsx` | Canvas fragment (image/text) |
| `AIStatusIndicator` | `AIStatusIndicator.tsx` | Shows ready/loading state |

---

## 10. Data Models

### Core Types (`domain/models.ts`)

```typescript
// Fragment - Canvas content
interface Fragment {
  id: UUID
  type: 'TEXT' | 'IMAGE' | 'LINK' | 'OTHER'
  title: string
  content: string
  summary?: string
  tags?: string[]
  position: { x, y }
  size?: { width, height }
}

// Puzzle - Session container
interface Puzzle {
  id: UUID
  centralQuestion: string
  type: 'CLARIFY' | 'EXPAND' | 'REFINE'
}

// PuzzlePiece - Generated insight
interface PuzzlePiece {
  id: UUID
  puzzleId: UUID
  mode: 'FORM' | 'MOTION' | 'EXPRESSION' | 'FUNCTION'
  text: string
  source: 'AI' | 'USER'
  status: 'SUGGESTED' | 'PLACED' | 'EDITED' | 'DISCARDED'
  fragmentLinks: FragmentLink[]
}

// Anchor - Starting/Solution text
interface Anchor {
  id: UUID
  puzzleId: UUID
  type: 'STARTING' | 'SOLUTION'
  text: string
}
```

### Visual Types (`types.ts`)

```typescript
// Piece - Visual representation on board
interface Piece {
  id: string
  quadrant: 'form' | 'motion' | 'expression' | 'function'
  color: string
  position: { x, y }
  cells: { x, y }[]  // Grid cells occupied
  text: string
  source?: 'user' | 'ai'
  priority?: 1 | 2 | 3 | 4 | 5 | 6
  imageUrl?: string  // For image fragment references
}
```

---

## 11. Key Workflows

### Workflow 1: Start Puzzle Session

```
1. User clicks puzzle card → handleEnterPuzzle()
2. View switches to PuzzleSessionView
3. PuzzleSessionView.useEffect():
   - ensurePuzzleSync()
   - ensureOrchestrator()
   - startPuzzleSession('CLARIFY')
4. eventBus.emit('PUZZLE_SESSION_STARTED')
5. orchestrator catches → runner.startPuzzleSession()
6. Check for cached pieces:
   - If cached: instant return
   - If not: run agents
7. eventBus.emit('PUZZLE_SESSION_GENERATED')
8. Store updates → UI shows pieces
```

### Workflow 2: Place Piece

```
1. User clicks piece in QuadrantSpawner
2. QuadrantSpawner.onPiecePlaced()
3. useGameStore.addPiece()
4. puzzleSync.onPieceAdded()
5. contextStore.upsertPuzzlePiece()
6. usePuzzleSessionStateStore.markPieceUsed()
```

### Workflow 3: End Session

```
1. User clicks "End Puzzle"
2. Board.onEndPuzzle()
3. puzzleSync.syncAllToDomain()
4. eventBus.emit('PUZZLE_FINISH_CLICKED')
5. orchestrator → synthesisAgent.run()
6. eventBus.emit('PUZZLE_SESSION_COMPLETED')
7. App shows PuzzleSummaryPopup
```

### Workflow 4: Fragment Added (Background)

```
1. User uploads image
2. Fragment.tsx → contextStore.upsertFragment()
3. eventBus.emit('FRAGMENT_ADDED')
4. ServiceManager hears event
5. contextCollector.onFragmentChange()
6. Extract features async
7. contextCollector.onReady()
8. insightPrecomputer.recompute()
9. piecePrecomputer.precomputePieces()
10. Pieces cached for next session
```

---

## 12. Configuration

### Grid System (`constants/puzzleGrid.ts`)

```typescript
CELL_SIZE = 64           // pixels per cell
CENTER_CARD = 4 × 2      // cells

// Quadrant Layout
┌──────┬──────┐
│ FORM │MOTION│
├──────┴──────┤
│   CENTER    │
├──────┬──────┤
│ EXPR │ FUNC │
└──────┴──────┘
```

### Color System (`constants/colors.ts`)

```typescript
QUADRANT_COLORS = {
  form: '#2E8B8B',       // Teal
  motion: '#5FB3B0',     // Aqua
  expression: '#E67E5A', // Orange
  function: '#E07A8A'    // Pink
}

// Sequential gradients (dark → light per quadrant)
QUADRANT_GRADIENTS = {
  FORM: ['#1244C5', '#3544E0', ..., '#C0E5EB'],
  MOTION: ['#193E18', '#0A6439', ..., '#C9F9DF'],
  ...
}
```

### Service Parameters

```typescript
// Timing
DEBOUNCE_MS = 500                    // Fragment change debounce
RECOMPUTE_INTERVAL_MS = 15000        // Insight refresh (15s)
STALE_THRESHOLD_MS = 300000          // Cache validity (5 min)
PIECE_CACHE_VALIDITY_MS = 600000     // Piece cache (10 min)

// Limits
MAX_FRAGMENT_USES = 2                // Max pieces per fragment
MAX_THEME_USES = 3                   // Max pieces per theme
```

---

## 13. Common Tasks

### Adding a New Agent

1. Create file in `ai/adk/agents/newAgent.ts`
2. Follow pattern from `formAgent.ts`
3. Export from `ai/adk/agents/index.ts`
4. Add to `quadrantManagerAgent.ts` if needed

### Adding a New Event

1. Add type to `domain/models.ts` → `UIEventType`
2. Emit via `eventBus.emitType('NEW_EVENT', payload)`
3. Handle in `orchestrator.ts` or component

### Modifying Piece Generation

1. Edit prompt in respective agent (`formAgent.ts`, etc.)
2. Update validation in `isValidFormPiece()` etc.
3. Test with different fragment sets

### Adding New UI Component

1. Create in `components/`
2. Add to view (`HomeCanvasView.tsx` or `PuzzleSessionView.tsx`)
3. Connect to store if needed

### Debugging AI Issues

1. Check console logs with prefixes:
   - `[orchestrator]` - Event handling
   - `[runner]` - AI workflow
   - `[FormAgent]` etc. - Individual agents
   - `[ServiceManager]` - Background services
2. Check `getAIStatus()` in runtime.ts
3. Verify API key in `.env`

---

## Appendix: Quick Reference

### Import Patterns

```typescript
// Stores
import { contextStore, eventBus } from '../store/runtime'
import { useGameStore } from '../store/puzzleSessionStore'
import { usePuzzleSessionStateStore } from '../store/puzzleSessionStateStore'

// AI
import { startPuzzleSession } from '../ai/adk/runner'
import { serviceManager } from '../ai/adk/services'

// Types
import { Fragment, Puzzle, PuzzlePiece } from '../domain/models'
import { Piece, QuadrantType } from '../types'
```

### Console Log Prefixes

```
[runtime] - Service initialization
[orchestrator] - Event handling
[puzzleSync] - Visual ↔ Domain sync
[PuzzleRunner] - AI workflow
[ServiceManager] - Background services
[ContextCollector] - Feature extraction
[InsightPrecomputer] - Insight generation
[PiecePrecomputer] - Piece pre-generation
[QuadrantManager] - Agent coordination
[FormAgent] / [MotionAgent] etc. - Individual agents
```

### Key Zustand Patterns

```typescript
// Read state
const pieces = useGameStore(state => state.pieces)

// Update state
useGameStore.getState().addPiece(newPiece)

// Subscribe to changes
useGameStore.subscribe((state) => {
  console.log('Pieces changed:', state.pieces.length)
})
```

---


**Maintained By:** Kida

## Run Locally

**Prerequisites:** Node.js 18+ (Vite requires modern ESM; older Node will fail on `node:fs/promises` exports)

1. Install dependencies:
   `npm install`
2. Configure env: copy `.env.example` to `.env` and set `VITE_GEMINI_API_KEY` (and optionally `VITE_GEMINI_MODEL`).
3. Run the app:
   `npm run dev`
