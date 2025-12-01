# BUILDING v2 - Puzzle AI System Architecture

**Date**: 2025-12-01
**Version**: 2.5 (System Architecture)
**Reference Docs**: `SystemDoc.md`, `docs/PLAN-2025-12-01-PHASE3.md`

---

## 1. Product Vision

**Puzzle AI** is an AI thinking partner for creative work.

**Two Layers**:
1. **Home Canvas** - Dump and arrange ideas as fragments (Miro-style)
2. **Puzzle Sessions** - Focused 4-quadrant thinking puzzles around a central question

**Core Operations** (Puzzle Types):
- **CLARIFY** - Make vague intent more precise (Blue #3B82F6)
- **EXPAND** - Grow or diversify options (Orange #F97316)
- **REFINE** - Narrow and polish toward a direction (Purple #9333EA)

**IMPORTANT**: Each Puzzle SESSION is ONE of these three types. All content within that session aligns to that single operation.

**4 Quadrants (Design Modes)** - The lenses within each puzzle:
- FORM - How it looks (shape, layout, visual structure)
- MOTION - How it moves/changes (rhythm, transitions, energy)
- EXPRESSION - What it feels like (mood, tone, personality)
- FUNCTION - What it needs to do (goals, constraints, audience)

---

## 2. Data Model

### 2.1 Puzzle (Session-level type)

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

### 2.2 Puzzle Piece

```typescript
type PiecePriority = 1 | 2 | 3 | 4 | 5 | 6;

interface Piece {
  id: string;
  quadrant: QuadrantType;      // form | motion | expression | function
  color: string;
  position: Position;          // Grid coordinates
  cells: Position[];           // Shape cells

  // ═══════════════════════════════════════════════════════════
  // PIECE TITLE (shown ON the piece - 2-5 words, 陈述式)
  // ═══════════════════════════════════════════════════════════
  text: string;                // "WARM ANALOG TEXTURES" (陈述式)
  userAnnotation?: string;     // User's SHORT note

  priority?: PiecePriority;    // 1-6, determines color saturation

  // ═══════════════════════════════════════════════════════════
  // SOURCE FRAGMENT INFO (for summary popup - NOT the title!)
  // ═══════════════════════════════════════════════════════════
  fragmentId?: string;         // Reference to canvas fragment
  fragmentTitle?: string;      // Original title from canvas
  fragmentSummary?: string;    // AI summary of fragment
  imageUrl?: string;           // If fragment is an image

  // Relationships
  anchorIds?: string[];        // Which anchors it's attached to

  // Metadata
  source?: PieceSourceType;    // ai | user | ai_edited
  category?: PieceCategoryType; // @deprecated - inherit from puzzle
}
```

### 2.3 Anchors

```typescript
type AnchorType = 'STARTING' | 'SOLUTION'

type Anchor = {
  id: string
  puzzleId: string
  type: AnchorType
  text: string               // User-editable summary
}
```

### 2.4 Fragment

```typescript
interface FragmentData {
  id: string;
  type: FragmentType;        // TEXT | IMAGE | LINK
  position: Position;
  size: Size;
  content: string;           // Text content or Image URL
  title: string;             // AI-generated, user-editable
  labels?: string[];         // Puzzle IDs this fragment contributed to
  summary?: string;
  tags?: string[];
}
```

---

## 3. File Structure

```
puzzle_AI/
├── App.tsx                     # View router (canvas | puzzle)
├── types.ts                    # Shared types
│
├── views/
│   ├── HomeCanvasView.tsx      # Canvas with fragments
│   └── PuzzleSessionView.tsx   # 4-quadrant puzzle board
│
├── components/
│   ├── canvas/                 # Home Canvas components
│   │   ├── Fragment.tsx
│   │   ├── FragmentCard.tsx    # Individual fragment with title bar
│   │   └── PuzzleSummaryCard.tsx
│   │
│   ├── puzzle/                 # Puzzle Session components
│   │   ├── Board.tsx           # Main container
│   │   ├── GridBackground.tsx  # 4-quadrant grid
│   │   ├── CenterCard.tsx      # Central question + anchors
│   │   ├── AnchorCard.tsx      # Starting/Solution anchor
│   │   ├── QuadrantSpawner.tsx # Corner hub with pieces
│   │   └── PuzzlePiece.tsx     # Draggable piece
│   │
│   ├── mascot/
│   │   ├── MascotButton.tsx
│   │   └── MascotPanel.tsx     # Shuffle + Create Puzzle
│   │
│   └── PuzzleDeck.tsx          # Puzzle cards at bottom
│
├── store/
│   ├── contextStore.ts         # Project-level state
│   ├── puzzleSessionStore.ts   # Visual puzzle state (Zustand)
│   ├── eventBus.ts             # UI event pub/sub
│   └── runtime.ts              # Singleton instances
│
├── ai/
│   ├── orchestrator.ts         # Event handler → agent dispatcher
│   ├── adkClient.ts            # Gemini API client
│   └── agents/
│       ├── mascotAgent.ts
│       ├── quadrantPieceAgent.ts
│       ├── puzzleSynthesisAgent.ts
│       └── fragmentSummaryAgent.ts
│
├── constants/
│   ├── colors.ts               # Quadrant + puzzle type colors
│   └── puzzleGrid.ts           # Shape definitions
│
└── docs/
    ├── SystemDoc.md            # Product spec
    └── PLAN-2025-12-01-PHASE3.md # Current implementation plan
```

---

## 4. Puzzle Session Flow

### 4.1 Session Initialization (Pre-Generation Model)

```
┌──────────────────────────────────────────────────────────────┐
│  PUZZLE SESSION CREATED                                       │
│  ════════════════════════════════════════════════            │
│                                                               │
│  1. User clicks "Create Puzzle" in Mascot panel              │
│  2. PuzzleSessionAgent receives context:                     │
│     - Process Aim                                            │
│     - Available fragments                                    │
│     - User's question (if provided)                          │
│  3. Dispatches to 4 QuadrantAgents in parallel:              │
│     - FormAgent → generates 6-8 FORM pieces                  │
│     - MotionAgent → generates 6-8 MOTION pieces              │
│     - ExpressionAgent → generates 6-8 EXPRESSION pieces      │
│     - FunctionAgent → generates 6-8 FUNCTION pieces          │
│  4. Each piece has:                                          │
│     - text (2-5 words, 陈述式 statement)                     │
│     - priority (1-6, determines color saturation)            │
│     - fragmentId (optional, links to canvas fragment)        │
│     - fragmentTitle, fragmentSummary (for popup)             │
│  5. Pieces stored in puzzleSessionStateStore                 │
│  6. User drags from hub → piece is ALREADY READY             │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Piece Content Architecture

**Two distinct content areas**:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. PIECE TITLE (shown ON the puzzle piece itself)              │
│  ═══════════════════════════════════════════════════════════    │
│                                                                  │
│  • 2-5 words ONLY                                               │
│  • 陈述式 (declarative statement), NOT a question               │
│  • Examples: "WARM ANALOG TEXTURES", "CALM TRANSITIONS"         │
│                                                                  │
│  • Word count determines shape:                                 │
│    - 2-3 words → Tall shapes (SHAPE_6, SHAPE_7, SHAPE_8)       │
│    - 4-5 words → Wide shapes (SHAPE_5, SHAPE_1, SHAPE_2)       │
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
│  │  • Fragment title from canvas                         │      │
│  │  • Fragment summary (AI-generated)                    │      │
│  │  • If image: thumbnail + description                  │      │
│  ├───────────────────────────────────────────────────────┤      │
│  │  [Metadata]                                           │      │
│  │  FORM · CLARIFY · AI GENERATED · P3                   │      │
│  └───────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 Puzzle Session Layout

```
┌──────────────────────────────────────────────────────────────┐
│  PUZZLE SESSION: [CLARIFY] / [EXPAND] / [REFINE]             │
│  ════════════════════════════════════════════════            │
│                                                               │
│  ┌─────────┐                           ┌─────────┐           │
│  │ FORM    │                           │ MOTION  │           │
│  │ HUB     │                           │ HUB     │           │
│  └─────────┘                           └─────────┘           │
│                                                               │
│                    ┌─────────────────┐                       │
│                    │  CENTRAL        │                       │
│                    │  QUESTION       │                       │
│                    │                 │                       │
│                    │ ┌─────────────┐ │                       │
│                    │ │ STARTING    │ │ ← Anchor: Why         │
│                    │ └─────────────┘ │                       │
│                    │ ┌─────────────┐ │                       │
│                    │ │ SOLUTION    │ │ ← Anchor: What        │
│                    │ └─────────────┘ │                       │
│                    └─────────────────┘                       │
│                                                               │
│  ┌─────────┐                           ┌─────────┐           │
│  │EXPRESS. │                           │FUNCTION │           │
│  │ HUB     │                           │ HUB     │           │
│  └─────────┘                           └─────────┘           │
│                                                               │
│  Session Type Badge: [CLARIFY] colored & labeled             │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Agent Architecture

### 5.1 QuadrantAgent Output Format

```typescript
interface QuadrantAgentPiece {
  // PIECE TITLE (shown ON the piece - 2-5 words, 陈述式)
  text: string;              // e.g., "WARM ANALOG TEXTURES"
  priority: 1 | 2 | 3 | 4 | 5 | 6;

  // SOURCE FRAGMENT REFERENCE (for summary popup)
  fragmentId?: string;       // Links to canvas fragment
  fragmentTitle?: string;    // Original title from canvas
  fragmentSummary?: string;  // 1-2 sentence explanation
  imageUrl?: string;         // If derived from image fragment
}
```

### 5.2 Agent Prompt Requirements

```
CRITICAL REQUIREMENTS:

1. PIECE TITLE (text field):
   - MUST be 2-5 words ONLY
   - MUST be 陈述式 (declarative statement), NOT a question
   - Examples:
     ✓ "Warm analog textures"
     ✓ "Gradual transitions creating calm"
     ✗ "Should we use warm colors?" (NO - question)
     ✗ "Clean" (NO - too short)

2. SOURCE FRAGMENT REFERENCE:
   - If insight derived from fragment, include:
     - fragmentId
     - fragmentTitle
     - fragmentSummary (1-2 sentences)

3. PRIORITY ASSIGNMENT (1-6):
   - P1-P2: Core insights, most relevant
   - P3-P4: Supporting insights
   - P5-P6: Subtle/nuanced insights

4. WORD COUNT → SHAPE:
   - 2-3 words: TALL shapes
   - 4-5 words: WIDE shapes
```

---

## 6. Shape Definitions

```typescript
// constants/puzzleGrid.ts

export const SHAPES = {
  SHAPE_1: [...], // 3×2 Horizontal L
  SHAPE_2: [...], // 3×2 Fat T
  SHAPE_3: [...], // 2×2 Square
  SHAPE_4: [...], // 3×2 Horizontal Z
  SHAPE_5: [...], // 3×1 Horizontal Bar
  SHAPE_6: [...], // 1×2 Vertical Bar
  SHAPE_7: [...], // 2×3 Big Gamma
  SHAPE_8: [...], // 2×3 Vertical S/Z
};

export const TALL_SHAPES = [SHAPE_6, SHAPE_7, SHAPE_8, SHAPE_3];
export const WIDE_SHAPES = [SHAPE_5, SHAPE_1, SHAPE_2, SHAPE_4];

export function getShapeForText(text: string) {
  const wordCount = text.trim().split(/\s+/).length;
  return wordCount <= 3
    ? randomFrom(TALL_SHAPES)
    : randomFrom(WIDE_SHAPES);
}
```

---

## 7. Color System

### 7.1 Puzzle Type Colors
| Type | Color | Hex |
|------|-------|-----|
| CLARIFY | Blue | #3B82F6 |
| EXPAND | Orange | #F97316 |
| REFINE | Purple | #9333EA |

### 7.2 Quadrant Colors
| Quadrant | Base Color |
|----------|------------|
| FORM | Violet (#8B5CF6) |
| MOTION | Cyan (#06B6D4) |
| EXPRESSION | Rose (#F43F5E) |
| FUNCTION | Amber (#F59E0B) |

### 7.3 Priority-Based Saturation
- P1-P2: High saturation (90-100%)
- P3-P4: Medium saturation (60-80%)
- P5-P6: Low saturation (30-50%)

---

## 8. Build Requirements

- Node.js **>= 18** (tested on v18.20.8)
- Vite 6 requires `node:fs/promises` exports
- Use `nvm use 18.20.8` before `npm run build`

---

## 9. Key Interactions

### 9.1 Mascot Panel
- **"Suggest a Puzzle"**: AI scans context, proposes puzzle
- **"I have a question"**: User types question, AI synthesizes puzzle
- **Proposal view**: Shows central question + rationale
  - **Shuffle**: Request new suggestion
  - **Create Puzzle**: Start session

### 9.2 Puzzle Piece Interactions
- **Drag from hub**: Shows pre-generated content immediately
- **Hover**: Summary popup appears (500ms delay)
- **Long-press**: Summary popup appears (500ms hold)
- **Double-click**: Edit piece title
- **Right-click**: Delete piece

### 9.3 End Puzzle Flow
1. Click "End this Puzzle"
2. AI synthesizes: direction, reasons, open questions
3. Summary card appears on canvas
4. Linked fragments get color labels

---

**For implementation tasks and progress tracking, see:**
`docs/PLAN-2025-12-01-PHASE3.md`
