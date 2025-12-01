# BUILDING v2 - Puzzle AI Implementation Guide

**Date**: 2025-12-01
**Version**: 2.5 (Implementation Complete)
**Reference Docs**: `SystemDoc.md`, `AgentAndContext.md`

---

## 1. Product Vision (Recap)

**Puzzle AI** is an AI thinking partner for creative work.

**Two Layers**:
1. **Home Canvas** - Dump and arrange ideas as fragments (Miro-style)
2. **Puzzle Sessions** - Focused 4-quadrant thinking puzzles around a central question

**Core Operations** (Puzzle Types):
- **Clarify** - Make vague intent more precise
- **Expand** - Grow or diversify options
- **Refine** - Narrow and polish toward a direction

**IMPORTANT**: Each Puzzle SESSION is ONE of these three types. A puzzle is either a Clarify puzzle, an Expand puzzle, or a Refine puzzle. All content within that session aligns to that single operation.

**4 Quadrants (Design Modes)** - The lenses within each puzzle:
- FORM - How it looks (shape, layout, visual structure)
- MOTION - How it moves/changes (rhythm, transitions, energy)
- EXPRESSION - What it feels like (mood, tone, personality)
- FUNCTION - What it needs to do (goals, constraints, audience)

---

## 2. Correct User Flow

### 2.1 Starting a Puzzle (via Mascot)

```
┌──────────────────────────────────────────────────────────────┐
│  HOME CANVAS                                                  │
│                                                               │
│  User clicks Mascot → Panel opens with 2 choices:            │
│    ☐ "Start from my question" (user types a question)        │
│    ☐ "Suggest a puzzle for me" (AI scans context)            │
│                                                               │
│  AI synthesizes:                                              │
│    • Puzzle Type: [CLARIFY] or [EXPAND] or [REFINE]          │
│    • Central Question                                         │
│    • Primary Modes to explore (1-2 quadrants)                │
│    • Rationale ("Why this puzzle now")                       │
│                                                               │
│  User confirms → Enters Puzzle Session of that type           │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Puzzle Types Explained

**CLARIFY Puzzle** - When things are vague
- Goal: Sharpen vague statements, make concepts concrete
- Triggers: Fuzzy words ("clean", "premium"), contradictions, missing info
- Example questions per quadrant:
  - FORM: "Should the design feel more geometric or organic?"
  - MOTION: "Is the motion calm and smooth, or bouncy and energetic?"
  - EXPRESSION: "Which 3 emotions best describe what you want people to feel?"
  - FUNCTION: "Where will this mostly be seen (mobile, print, in-store)?"

**EXPAND Puzzle** - When you need more options
- Goal: Bring in fresh angles, avoid local minima
- Triggers: Quadrant is empty, user says "not sure yet", narrow idea set
- Example questions per quadrant:
  - FORM: "If this interface were an object, what would it feel like to touch?"
  - MOTION: "Imagine a 2-second intro animation—what happens in it?"
  - EXPRESSION: "If the product had a voice, whose voice would it sound like?"
  - FUNCTION: "Are there constraints (budget, accessibility) we haven't named?"

**REFINE Puzzle** - When you have ideas but need to converge
- Goal: Pick essentials, reconcile conflicts, choose trade-offs
- Triggers: Quadrant has many notes (≥5), user says "I know but it's messy"
- Example questions per quadrant:
  - FORM: "From everything here, what 2 visual elements *must* remain?"
  - MOTION: "Which motion concept best fits your analog-warm goal?"
  - EXPRESSION: "Which emotional axis feels most important to commit to now?"
  - FUNCTION: "If you had to prioritize only one job-to-be-done, which is it?"

### 2.3 Inside Puzzle Session

```
┌──────────────────────────────────────────────────────────────┐
│  PUZZLE SESSION: [CLARIFY] / [EXPAND] / [REFINE]             │
│  ════════════════════════════════════════════════            │
│                                                               │
│  ┌─────────┐                           ┌─────────┐           │
│  │ FORM    │← Anchor: What             │ MOTION  │           │
│  │ HUB     │                           │ HUB     │← Anchor: What           │
│  │  [+]    │                           │  [+]    │           │
│  └─────────┘                           └─────────┘           │
│                                                               │
│                    ┌─────────────────┐                       │
│                    │  CENTRAL        │                       │
│                    │  QUESTION       │                       │
│                    │                 │                       │
│                    │ ┌─────────────┐ │                       │
│                    │ │ STARTING    │ │ ← Anchor: Why         │
│                    │ │ (Why)       │ │                       │
│                    │ └─────────────┘ │                       │
│                    └─────────────────┘                       │
│                                                               │
│  ┌─────────┐                           ┌─────────┐           │
│  │EXPRESS. │← Anchor: What             │FUNCTION │← Anchor: What  │
│  │ HUB     │                           │ HUB     │           │
│  │  [+]    │                           │  [+]    │           │
│  └─────────┘                           └─────────┘           │
│                                                               │
│  Session Type Badge: [CLARIFY] colored & labeled             │
└──────────────────────────────────────────────────────────────┘
```

**Key difference from v1**: No [C][E][R] buttons per hub. The entire session IS one type. Each hub just has [+] to generate pieces aligned to that session's operation.

### 2.4 Creating Puzzle Pieces (PRE-GENERATION MODEL)

**Session Initialization**:
When a puzzle session is created, the multi-agent system **PRE-GENERATES** all pieces:

```
┌──────────────────────────────────────────────────────────────┐
│  PUZZLE SESSION CREATED                                       │
│  ════════════════════════════════════════════════            │
│                                                               │
│  1. PuzzleSessionAgent receives session context               │
│  2. Dispatches to 4 QuadrantAgents in parallel:              │
│     - FormAgent → generates 6-8 FORM pieces                  │
│     - MotionAgent → generates 6-8 MOTION pieces              │
│     - ExpressionAgent → generates 6-8 EXPRESSION pieces      │
│     - FunctionAgent → generates 6-8 FUNCTION pieces          │
│  3. Each piece has:                                          │
│     - title (2-5 words, 陈述式 statement)                    │
│     - priority (1-6, determines color saturation)            │
│     - sourceFragmentId (optional, links to canvas fragment)  │
│  4. Pieces stored in puzzleSessionStateStore                 │
│  5. User drags from hub → piece is ALREADY READY             │
└──────────────────────────────────────────────────────────────┘
```

**User Action** (pieces already pre-generated):
1. User drags from Hub (e.g., FORM hub)
2. Piece content is **immediately visible** (no "AI is thinking...")
3. User places piece on board
4. User can TYPE an annotation (their answer) inside the piece
5. User can ATTACH piece to an Anchor (Starting or Solution)

**Piece Lifecycle**:
```
PRE-GENERATED → DRAGGING → PLACED → EDITED → CONNECTED
                        ↘ CANCELLED (not placed)
```

### 2.5 Ending a Puzzle

1. User clicks "Finish Puzzle" (or Mascot suggests)
2. AI summarizes:
   - Direction Statement (1-2 sentences)
   - Key Reasons (3-5 bullets)
   - Open Questions (optional)
3. Summary Card appears on Home Canvas with puzzle type badge
4. Related fragments get color labels

---

## 3. Correct Data Model

### 3.1 Puzzle (Session-level type)

```typescript
type PuzzleType = 'CLARIFY' | 'EXPAND' | 'REFINE'

type Puzzle = {
  id: string
  projectId: string
  centralQuestion: string
  type: PuzzleType            // THE PUZZLE'S OPERATION TYPE
  createdFrom: 'user_request' | 'ai_suggested'
}
```

### 3.2 Puzzle Piece (Inherits type from puzzle)

```typescript
type PuzzlePiece = {
  id: string
  puzzleId: string
  mode: DesignMode           // FORM | MOTION | EXPRESSION | FUNCTION
  // NOTE: category is INHERITED from puzzle.type, not stored per piece

  // Content
  text: string               // The QUESTION (AI-generated)
  userAnnotation?: string    // User's ANSWER (user-typed)

  // Relationships
  anchorIds: string[]        // Which anchors it's attached to
  fragmentLinks: FragmentLink[]

  // Metadata
  source: 'AI' | 'USER' | 'AI_SUGGESTED_USER_EDITED'
  status: 'SUGGESTED' | 'PLACED' | 'EDITED' | 'DISCARDED' | 'CONNECTED'

  // Visual (for rendering only)
  position?: { x: number; y: number }
  cells?: Position[]
}
```

### 3.3 Anchors

```typescript
type Anchor = {
  id: string
  puzzleId: string
  type: 'STARTING' | 'SOLUTION'
  text: string               // User-editable summary of why/what
}
```

### 3.4 PreferenceProfile (Updated)

```typescript
type PreferenceStats = {
  suggested: number
  placed: number
  edited: number
  discarded: number
  connected: number
}

// Track per (puzzleType, mode) instead of (mode, category)
type UserPreferenceProfile = {
  // Key: JSON.stringify({puzzleType, mode})
  [key: string]: PreferenceStats
}
```

---

## 4. Correct File Structure

```
puzzle_AI/
├── App.tsx                     # View router (canvas | puzzle)
├── index.tsx                   # Entry point
├── types.ts                    # Shared types
│
├── views/
│   ├── HomeCanvasView.tsx      # Canvas with fragments
│   └── PuzzleSessionView.tsx   # 4-quadrant puzzle board
│
├── components/
│   ├── common/
│   │   └── LoadingTransition.tsx
│   │
│   ├── canvas/                 # Home Canvas components
│   │   ├── Fragment.tsx
│   │   ├── TopBar.tsx
│   │   ├── Toolbar.tsx
│   │   ├── PuzzleDeck.tsx      # Shows puzzle cards with type badges
│   │   └── SummaryCard.tsx
│   │
│   ├── puzzle/                 # Puzzle Session components
│   │   ├── PuzzleBoard.tsx     # Main container
│   │   ├── PuzzleTypeBadge.tsx # [CLARIFY]/[EXPAND]/[REFINE] badge [NEW]
│   │   ├── GridBackground.tsx  # 4-quadrant grid
│   │   ├── CenterCard.tsx      # Central question + anchors
│   │   ├── AnchorCard.tsx      # Starting/Solution anchor
│   │   ├── QuadrantHub.tsx     # Corner hub with [+] button only
│   │   ├── PuzzlePiece.tsx     # Draggable piece
│   │   └── SuggestedPiece.tsx  # AI suggestion near hub
│   │
│   └── mascot/
│       ├── MascotButton.tsx
│       ├── MascotPanel.tsx     # Includes puzzle type selection
│       └── PuzzleMascot.tsx
│
├── domain/
│   └── models.ts               # Domain types (source of truth)
│
├── store/
│   ├── contextStore.ts         # Project-level persistent state
│   ├── puzzleSessionStore.ts   # Visual puzzle state (Zustand)
│   ├── eventBus.ts             # UI event pub/sub
│   └── runtime.ts              # Singleton instances
│
├── ai/
│   ├── orchestrator.ts         # Event handler → agent dispatcher
│   ├── adkClient.ts            # Gemini API client
│   └── agents/
│       ├── fragmentContextAgent.ts
│       ├── mascotAgent.ts
│       ├── puzzleDesignerAgent.ts
│       └── quadrantPieceAgent.ts  # Now receives puzzleType from session
│
├── constants/
│   ├── colors.ts               # Include puzzle type colors
│   └── puzzleGrid.ts
│
└── docs/
    ├── SystemDoc.md            # Product spec
    ├── AgentAndContext.md      # AI system spec
    └── v2problems.md           # Current issues
```

---

## 5. Implementation Phases

### Phase 1: Fix Core Data Flow (P0) ✅ COMPLETED
**Goal**: AI content actually loads and displays

**Tasks**:
1. ✅ Add `type: PuzzleType` to Puzzle model and store
   - Updated `domain/models.ts`: Added `type: PuzzleType` to Puzzle interface
   - Updated `types.ts`: Added `PuzzleSessionType`, made `Piece.text` required
   - Updated `store/puzzleSessionStore.ts`: Added `updatePieceText`, fixed mapping functions

2. ✅ Fix orchestrator's `PIECE_CREATED` handler to:
   - Read puzzle type from current session
   - Call quadrantPieceAgent with puzzle type + mode
   - Emit `PIECE_CONTENT_UPDATED` with response
   - Update store with piece text

3. ✅ Fix piece model to match spec:
   - `text` = AI-generated question
   - `userAnnotation` = user's answer (optional)
   - Deprecated `title`/`content` fields (kept for backwards compat)

4. ✅ Fix store update flow:
   - Updated `puzzleSessionStore.updatePieceText(id, text)`
   - Updated `addPiece` to set `text` field properly

5. ✅ Update QuadrantSpawner to use session puzzleType:
   - `requestAIContent` now reads `puzzle.type` from session
   - Emits `puzzleType` in PIECE_CREATED event

**Completed**: 2025-12-01

---

### Phase 2: Fix Piece Placement (P0) ✅ COMPLETED
**Goal**: Pieces can be placed adjacent to center card

**Tasks**:
1. ✅ Debug grid coordinate system
   - Analyzed collision detection logic - working correctly
   - Identified UX issue: cursor at ghost center vs shape origin

2. ✅ Fix visual-to-logical position mapping
   - Added `offsetX/offsetY` to shapeBounds calculation
   - Updated `handleDrag` and `handleDragEnd` to account for shape center offset
   - Now grid position is calculated based on where shape will actually be placed

3. ✅ Visual feedback exists (green/red highlights on ghost shape)

**Completed**: 2025-12-01

---

### Phase 3: Implement Puzzle Type Selection (P1)
**Goal**: Users select puzzle type when starting a session

**Tasks**:
1. Update MascotPanel to include puzzle type selection:
   - When user clicks "Start from my question":
     - Show type selector: [CLARIFY] [EXPAND] [REFINE]
     - AI suggests which type based on question
   - When "Suggest a puzzle for me":
     - AI returns puzzle type as part of suggestion

2. Create `PuzzleTypeBadge.tsx`:
   - Color-coded badge (e.g., blue=Clarify, green=Expand, orange=Refine)
   - Appears in puzzle session header
   - Appears on deck cards

3. Update puzzle creation flow:
   - Store puzzle type when creating session
   - Pass type to all piece generation calls

**Estimated**: 4-6 hours

---

### Phase 4: Implement Anchors (P1)
**Goal**: Starting/Solution anchors visible and functional

**Tasks**:
1. Create `AnchorCard.tsx` component
2. Add anchor attachment logic
3. Update CenterCard to include anchors

**Estimated**: 4-6 hours

---

### Phase 5: Redesign QuadrantHub (P1)
**Goal**: Simple [+] button that generates pieces for session type

**Tasks**:
1. Redesign `QuadrantHub.tsx`:
   - Remove [C][E][R] buttons
   - Single [+] button per hub
   - Clicking generates pieces using session's puzzle type

2. Create `SuggestedPiece.tsx`:
   - Shows AI question/prompt
   - User drags to place, or X to discard

3. Update piece generation flow:
   - Read puzzle type from session
   - Generate questions appropriate to that type + quadrant mode

**Estimated**: 4-6 hours

---

### Phase 6: Implement User Annotations (P2)
**Goal**: Users can type answers inside pieces

**Tasks**:
1. Add annotation input to `PuzzlePiece.tsx`
2. Update preview popup
3. Wire up events

**Estimated**: 3-4 hours

---

### Phase 7: Implement PreferenceProfile (P2)
**Goal**: AI adapts based on user behavior

**Tasks**:
1. Update preference key to `{puzzleType, mode}`
2. Track stats on piece actions
3. Generate preference hints for AI

**Estimated**: 4-5 hours

---

### Phase 8: Polish & Testing (P3)
**Goal**: Smooth, bug-free experience

**Tasks**:
1. End-to-end flow testing
2. Visual polish
3. Code cleanup

**Estimated**: 4-6 hours

---

## 6. Build Requirements

- Node.js **>= 18** (tested on v18.20.8 and v22.21.1)
- Vite 6 requires `node:fs/promises` exports
- Use `nvm use 18.20.8` before `npm run build`

---

## 7. Testing Checklist

### Puzzle Type Selection
- [ ] Mascot panel shows puzzle type options
- [ ] AI suggests appropriate puzzle type based on context
- [ ] Puzzle type badge visible in session header
- [ ] Puzzle type badge visible on deck cards

### Puzzle Flow
- [ ] Mascot "Suggest puzzle" generates type + central question
- [ ] Mascot "My question" accepts input and suggests type
- [ ] User can override AI-suggested type
- [ ] Puzzle opens with correct type badge

### Piece Creation
- [ ] Clicking [+] in hub generates pieces for session type
- [ ] AI suggestions match puzzle type semantics:
  - Clarify: sharpening questions
  - Expand: divergent prompts
  - Refine: convergent choices
- [ ] Suggestions show SHORT questions, not paragraphs
- [ ] Dragging suggestion places piece on board
- [ ] X button discards suggestion

### Piece Placement
- [ ] Pieces snap to grid
- [ ] Valid positions show green feedback
- [ ] Invalid positions show red + reason
- [ ] Pieces can attach to center card edges
- [ ] Pieces can attach to other pieces
- [ ] Pieces can attach to anchors

### User Interaction
- [ ] Click piece → input field for annotation
- [ ] Typing updates annotation
- [ ] Preview popup shows question + annotation

### Finish Puzzle
- [ ] Summary card shows puzzle type badge
- [ ] Summary reflects session type's operation
- [ ] Related fragments get color labels

---

## 8. Key Differences from v1

| Aspect | v1 (Wrong) | v2 (Correct) |
|--------|------------|--------------|
| Puzzle type | Per-piece category | Per-session type |
| Hub UI | [C][E][R] buttons | Single [+] button |
| Category selection | User picks per piece | Inherited from session |
| Deck cards | No type indicator | Colored type badge |
| Piece questions | Mixed categories | Consistent with session type |
| Preference tracking | Per (mode, category) | Per (puzzleType, mode) |

---



---

## 9. UI/UX Refinements (Phase 2.5) - NEW

### 9.1 Puzzle Piece Content Architecture

**Current Issue**: Title on piece = Same as summary popup (redundant)

**Required Architecture - TWO DISTINCT CONTENT AREAS**:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. PIECE TITLE (shown ON the puzzle piece itself)              │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  • 2-5 words ONLY                                               │
│  • 陈述式 (declarative statement), NOT a question               │
│  • AI-generated insight relevant to quadrant + puzzle type      │
│  • Examples:                                                     │
│    - "WARM ANALOG TEXTURES"                                     │
│    - "CALM TRANSITIONS"                                         │
│    - "PLAYFUL APPROACHABILITY"                                  │
│                                                                  │
│  • Word count determines shape:                                 │
│    - 2-3 words → Tall shapes (1×2, 2×3)                        │
│    - 4-5 words → Wide shapes (3×1, 3×2)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  2. SUMMARY POPUP (top-right corner, on hover/long-press)       │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  • Shows SOURCE FRAGMENT information (where insight came from)  │
│  • NOT the same as the piece title!                             │
│                                                                  │
│  Content:                                                        │
│  ┌───────────────────────────────────────────────────────┐      │
│  │  [Title Bar]  "Warm Analog Textures"                  │      │
│  ├───────────────────────────────────────────────────────┤      │
│  │  [Source Fragment Info]                               │      │
│  │  • If text fragment: Original text excerpt            │      │
│  │  • If image fragment: Image thumbnail + AI summary    │      │
│  │  • Fragment title from canvas                         │      │
│  ├───────────────────────────────────────────────────────┤      │
│  │  [Metadata]                                           │      │
│  │  FORM · CLARIFY · AI GENERATED · P3                   │      │
│  └───────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

**Data Model Update** (types.ts):
```typescript
interface Piece {
  // ═══════════════════════════════════════════════════════════
  // PIECE TITLE (shown ON the piece - 2-5 words)
  // ═══════════════════════════════════════════════════════════
  text: string;              // "WARM ANALOG TEXTURES" (陈述式)

  // ═══════════════════════════════════════════════════════════
  // SOURCE FRAGMENT INFO (for summary popup - NOT the title!)
  // ═══════════════════════════════════════════════════════════
  fragmentId?: string;       // Reference to canvas fragment
  fragmentTitle?: string;    // "Brand Color Palette Analysis"
  fragmentSummary?: string;  // "The matcha brand uses warm earth tones..."
  imageUrl?: string;         // If fragment is an image

  // ═══════════════════════════════════════════════════════════
  // METADATA
  // ═══════════════════════════════════════════════════════════
  priority: PiecePriority;   // 1-6
  quadrant: QuadrantType;    // form | motion | expression | function
  source: PieceSourceType;   // ai | user | ai_edited
}
```

### 9.2 Title Length → Shape Assignment

| Word Count | Shape Type | Examples |
|------------|------------|----------|
| 2-3 words  | Tall/Vertical | SHAPE_6 (1×2), SHAPE_7 (2×3) |
| 4-5 words  | Wide/Horizontal | SHAPE_5 (3×1), SHAPE_1 (3×2) |
| 6+ words   | Large/Square | SHAPE_3 (2×2), SHAPE_4 (3×2) |

**Status**: ✅ COMPLETED (in `constants/puzzleGrid.ts`)

### 9.3 Image Puzzle Pieces

**Requirements**:
1. User can drag image fragments from canvas to create image pieces
2. Piece title = AI-generated summary of image (2-5 words)
3. Summary popup = Shows image thumbnail + AI description

**Implementation Tasks**:
- [ ] FragmentCard: Add drag handler to create image piece
- [ ] QuadrantSpawner: Accept image fragment drops
- [ ] PuzzlePiece: Render image thumbnail inside piece shape
- [ ] AI Agent: Generate title from image description

### 9.4 Fragment UI Improvements

**Current Issue**: Fragment cards don't show AI-summarized title

**Required UI**:
```
┌──────────────────────────────────────────┐
│ [AI Title: "Matcha Brand Colors"]  [✎] [×] │  ← Top bar with editable title
├──────────────────────────────────────────┤
│                                          │
│         [Fragment Content]               │
│         (Image or Text)                  │
│                                          │
└──────────────────────────────────────────┘
```

**Tasks**:
- [ ] FragmentCard: Add title bar with AI summary
- [ ] FragmentCard: Add edit button to modify title
- [ ] AI: Auto-generate title for new fragments

### 9.5 Mascot Puzzle Modal Changes

**Current**:
```
[Not now]      [Start Puzzle]
```

**Required**:
```
[Shuffle]      [Create Puzzle]
```

**Tasks**:
- [ ] MascotProposalOverlay: "Not now" → "Shuffle"
- [ ] MascotProposalOverlay: "Start Puzzle" → "Create Puzzle"
- [ ] Shuffle action: Request new puzzle suggestion from AI

### 9.6 Puzzle Card Category Display

**Current Issue**: Shows "FICTION" (mock data)

**Required**: Show actual puzzle type: **CLARIFY** | **EXPAND** | **REFINE**

**Tasks**:
- [x] PuzzleCard: Use `puzzle.type` instead of mock category
- [x] Styling: Category badge color matches type
  - CLARIFY: Blue (#3B82F6)
  - EXPAND: Orange (#F97316)
  - REFINE: Purple (#9333EA)

### 9.7 Text Display Fixes

**Status**: ✅ COMPLETED
- [x] Text always horizontal (no vertical writing mode)
- [x] Long-press detection for summary popup
- [x] Shape-to-text-length matching
- [x] Pre-generated content in drag preview
- [x] Removed "i" icon from pieces
- [x] Priority-based colors

---

## 10. Implementation Priority (Updated)

### P0 - Critical (Do First)
1. ✅ Fix core data flow (Phase 1)
2. ✅ Fix piece placement (Phase 2)
3. ✅ Text always horizontal
4. [ ] Summary popup shows fragment info (not title)
5. [ ] Mascot modal button labels
6. [ ] Puzzle card shows actual category

### P1 - Important
7. [ ] Fragment title bar with edit capability
8. ✅ Shape assignment based on word count

### P2 - Enhancement
9. [ ] Image puzzle piece support
10. [ ] Drag fragment to create piece
11. [ ] AI image summarization

---

## 11. Files to Modify for UI/UX

### Core Types
- `types.ts` - Add fragmentTitle, fragmentSummary fields

### Components
- `components/puzzle/PuzzlePiece.tsx`
  - ✅ Remove "i" icon
  - ✅ Text always horizontal
  - [ ] Show fragment info in summary (not title)
  - [ ] Support image rendering in piece

- `components/puzzle/QuadrantSpawner.tsx`
  - ✅ Text always horizontal
  - ✅ Shape-to-text matching
  - [ ] Accept image fragment drops

- `components/fragments/FragmentCard.tsx`
  - [ ] Add title bar with AI summary
  - [ ] Add edit button for title
  - [ ] Add drag-to-puzzle support

- `components/mascot/MascotProposalOverlay.tsx`
  - [ ] "Shuffle" instead of "Not now"
  - [ ] "Create Puzzle" instead of "Start Puzzle"

- `components/puzzle/PuzzleCard.tsx`
  - [ ] Show actual type (CLARIFY/EXPAND/REFINE)
  - [ ] Remove mock "FICTION" category

### Stores
- `store/contextStore.ts` - Fragment title persistence
- `store/puzzleSessionStore.ts` - Fragment reference in pieces

---

## 12. Testing Checklist (Updated)

### Puzzle Piece Display
- [x] Text is always horizontal (no vertical)
- [x] Shape matches title word count (2-3 = tall, 4-5 = wide)
- [x] Long-press shows summary popup
- [x] Piece title shows 2-5 word insight (agent prompt updated)
- [x] Summary popup shows source fragment info (not title)
- [ ] Image pieces render correctly (not yet implemented)

### Fragment Cards
- [ ] AI-summarized title in top bar (not yet implemented)
- [ ] Edit button to modify title (not yet implemented)
- [ ] Can drag fragment to create puzzle piece (not yet implemented)

### Mascot Modal
- [x] Shows "Shuffle" button (left)
- [x] Shows "Create Puzzle" button (right)

### Puzzle Cards
- [x] Shows CLARIFY/EXPAND/REFINE (not FICTION)
- [x] Category badge color matches type

---

---

## 13. Agent Architecture Refinements

### 13.1 Current Agent Flow (Working)

```
PUZZLE_SESSION_STARTED event
        ↓
    Orchestrator
        ↓
    PuzzleSessionAgent
        ↓
    ┌─────────────────────────────────────┐
    │  4 QuadrantAgents (parallel)        │
    │  • FormAgent                        │
    │  • MotionAgent                      │
    │  • ExpressionAgent                  │
    │  • FunctionAgent                    │
    └─────────────────────────────────────┘
        ↓
    PUZZLE_SESSION_GENERATED event
        ↓
    puzzleSessionStateStore (pre-generated pieces)
```

### 13.2 Required Agent Output Format

Each QuadrantAgent should return pieces with this structure:

```typescript
interface QuadrantAgentPiece {
  // ═══════════════════════════════════════════════════════════
  // REQUIRED: Piece Title (shown ON the piece)
  // ═══════════════════════════════════════════════════════════
  text: string;           // 2-5 words, 陈述式
                          // e.g., "WARM ANALOG TEXTURES"

  priority: 1 | 2 | 3 | 4 | 5 | 6;  // Determines color + position

  // ═══════════════════════════════════════════════════════════
  // OPTIONAL: Source Fragment Reference (for summary popup)
  // ═══════════════════════════════════════════════════════════
  sourceFragmentId?: string;    // Links to canvas fragment
  sourceFragmentTitle?: string; // "Brand Color Palette"
  sourceFragmentSummary?: string; // "Analysis of matcha brand colors..."
  sourceImageUrl?: string;      // If derived from image fragment
}
```

### 13.3 Agent Prompt Refinements

**QuadrantAgent System Prompt Updates**:

```
You are generating puzzle pieces for the {MODE} quadrant.
Puzzle Type: {PUZZLE_TYPE} (CLARIFY | EXPAND | REFINE)

CRITICAL REQUIREMENTS:

1. PIECE TITLE (text field):
   - MUST be 2-5 words ONLY
   - MUST be 陈述式 (declarative statement), NOT a question
   - Examples:
     ✓ "WARM ANALOG TEXTURES"
     ✓ "CALM TRANSITIONS"
     ✓ "PLAYFUL APPROACHABILITY"
     ✗ "Should we use warm colors?" (NO - this is a question)
     ✗ "The design should incorporate warm analog textures" (NO - too long)

2. SOURCE FRAGMENT REFERENCE:
   - If the insight is derived from a canvas fragment, include:
     - sourceFragmentId: the fragment's ID
     - sourceFragmentTitle: original title from canvas
     - sourceFragmentSummary: 1-2 sentence explanation of how this
       fragment influenced the insight
   - If derived from an image fragment, also include:
     - sourceImageUrl: the image URL

3. PRIORITY ASSIGNMENT:
   - P1-P2: Core insights, most relevant to central question
   - P3-P4: Supporting insights, add depth
   - P5-P6: Subtle/nuanced insights, for exploration

4. WORD COUNT → SHAPE:
   - 2-3 words: Will be placed on TALL shapes
   - 4-5 words: Will be placed on WIDE shapes
   - Mix your outputs to have variety in shapes
```

### 13.4 New Agent: FragmentSummaryAgent

**Purpose**: Generate AI titles for canvas fragments (for the title bar UI)

**Triggers**:
- When a new fragment is added to canvas
- When user requests title regeneration

**Input**:
```typescript
{
  fragmentId: string;
  fragmentType: 'TEXT' | 'IMAGE';
  content: string;        // Text content or image URL
  existingTitle?: string; // User may have already set one
}
```

**Output**:
```typescript
{
  suggestedTitle: string; // 3-6 words, concise summary
  confidence: number;     // 0-1, how confident the AI is
}
```

**Example**:
- Input: Image of matcha products with earthy colors
- Output: `{ suggestedTitle: "Matcha Brand Earth Tones", confidence: 0.85 }`

### 13.5 Agent File Updates Needed

| File | Change |
|------|--------|
| `ai/agents/quadrantPieceAgent.ts` | Update prompt to require 2-5 word titles |
| `ai/agents/quadrantPieceAgent.ts` | Add source fragment reference fields |
| `ai/agents/fragmentSummaryAgent.ts` | NEW: Generate fragment titles |
| `ai/orchestrator.ts` | Add handler for FRAGMENT_ADDED event |
| `domain/models.ts` | Update QuadrantAgentPiece interface |

---

## 14. Summary of All Changes

### Completed ✅
- [x] Text always horizontal (no vertical)
- [x] Shape-to-text-length matching
- [x] Long-press for summary popup
- [x] Pre-generated pieces in session store
- [x] Removed "i" icon from pieces
- [x] Priority-based colors
- [x] Summary popup shows fragment info (not title) - `PuzzlePiece.tsx:336-392`
- [x] Update types.ts with fragment fields - `types.ts:102-108`
- [x] Mascot modal: "Shuffle" + "Create Puzzle" - `MascotPanel.tsx:234-248`
- [x] Puzzle card: CLARIFY/EXPAND/REFINE category - `PuzzleDeck.tsx:15-52`
- [x] Agent prompt updates for 2-5 word titles - `quadrantPieceAgent.ts:91-155`
- [x] Source fragment reference in agent output - `quadrantPieceAgent.ts:32-57`

### Not Started ⏳
- [ ] Fragment title bar with edit (UI enhancement)
- [ ] FragmentSummaryAgent (auto-generate fragment titles)
- [ ] Image puzzle pieces (drag from canvas)

---

**Document Version**: 2.5 (Implementation Complete)
**Last Updated**: 2025-12-01
