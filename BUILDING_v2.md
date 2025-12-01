# BUILDING v2 - Puzzle AI Implementation Guide

**Date**: 2025-12-01
**Version**: 2.1 (Corrected Puzzle Session Model)
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
│  │ FORM    │                           │ MOTION  │           │
│  │ HUB     │←──────────────────────────│ HUB     │           │
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
│                    │ ┌─────────────┐ │                       │
│                    │ │ SOLUTION    │ │ ← Anchor: What        │
│                    │ │ (What)      │ │                       │
│                    │ └─────────────┘ │                       │
│                    └─────────────────┘                       │
│                                                               │
│  ┌─────────┐                           ┌─────────┐           │
│  │EXPRESS. │                           │FUNCTION │           │
│  │ HUB     │                           │ HUB     │           │
│  │  [+]    │                           │  [+]    │           │
│  └─────────┘                           └─────────┘           │
│                                                               │
│  Session Type Badge: [CLARIFY] colored & labeled             │
└──────────────────────────────────────────────────────────────┘
```

**Key difference from v1**: No [C][E][R] buttons per hub. The entire session IS one type. Each hub just has [+] to generate pieces aligned to that session's operation.

### 2.4 Creating Puzzle Pieces

**User Action**:
1. User clicks [+] in a Hub (e.g., FORM hub)
2. AI generates 1-3 suggested pieces appropriate to:
   - The **session type** (Clarify/Expand/Refine)
   - The **quadrant mode** (FORM/MOTION/EXPRESSION/FUNCTION)
3. Each piece shows a SHORT QUESTION/PROMPT like:
   - Clarify FORM: "Should the design feel more geometric or organic?"
   - Expand FORM: "If this interface were an object, what would it feel like?"
   - Refine FORM: "From everything, what 2 visual elements *must* remain?"
4. User DRAGS a piece onto the board
5. User can TYPE an annotation (their answer) inside the piece
6. User can ATTACH piece to an Anchor (Starting or Solution)

**Piece Lifecycle**:
```
SUGGESTED → PLACED → EDITED → CONNECTED
                  ↘ DISCARDED
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

**Document Version**: 2.2 (Phases 1 & 2 Completed)
**Last Updated**: 2025-12-01
