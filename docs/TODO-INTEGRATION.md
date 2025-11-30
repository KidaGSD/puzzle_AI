# TODO: Puzzle Session Integration Sprint

**Created**: 2025-11-30
**Status**: In Progress
**Target**: End-to-end skeleton connecting Home Canvas ↔ Puzzle Session

---

## Overview

This document tracks the integration of the standalone `puzzle_session/` code into the main Puzzle AI application, creating a seamless two-layer experience.

**Reference Documents**:
- `/BUILDING.md` - System integration document
- `/SystemDoc.md` - Product design spec
- `/AgentAndContext.md` - AI agent contracts
- `/Figma/` - Design assets and color palettes

---

## Design Constants (from Figma)

### Quadrant Colors (Primary - Row 5 in palette)
```typescript
const QUADRANT_COLORS = {
  FORM: '#00DE8C',      // Green (Motion in current code, should be Form)
  MOTION: '#3544E0',    // Blue
  EXPRESSION: '#8E34FE', // Purple
  FUNCTION: '#FB07AA',   // Pink/Magenta
};
```

### Color Saturation Rules
- Pieces closer to center: Full saturation
- Pieces further from center: Reduced saturation + lighter
- Use HSL manipulation based on distance from center

### Loading States
- "Connecting your fragments..." - When entering puzzle
- "Entering your puzzle..." - Transition animation

---

## Phase 1: View Router & Navigation

### Status: COMPLETED (2025-11-30)

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Create `views/` folder | DONE | Claude | views/HomeCanvasView.tsx, views/PuzzleSessionView.tsx |
| Create `constants/` folder | DONE | Claude | constants/colors.ts, constants/puzzleGrid.ts |
| Extract HomeCanvasView | DONE | Claude | Full canvas logic extracted |
| Create PuzzleSessionView | DONE | Claude | Wrapper with store subscription |
| Add LoadingTransition | DONE | Claude | components/common/LoadingTransition.tsx |
| Refactor App.tsx router | DONE | Claude | View state machine with transitions |
| Wire PuzzleDeck click | DONE | Claude | onEnterPuzzle callback |
| Wire End Puzzle button | DONE | Claude | onExit callback triggers PUZZLE_FINISH_CLICKED |
| Update puzzle_session Board | DONE | Claude | Added puzzle/processAim/onEndPuzzle props |
| Update CenterCard | DONE | Claude | Shows actual centralQuestion |

### Implementation Details

**App.tsx View Router State**:
```typescript
type AppView = 'canvas' | 'puzzle';

interface AppState {
  currentView: AppView;
  activePuzzleId: string | null;
  isTransitioning: boolean;
}
```

**Navigation Flow**:
```
PuzzleDeck.onClick(puzzle)
  → App.handleEnterPuzzle(puzzle.id)
  → setIsTransitioning(true)
  → Show LoadingTransition
  → setTimeout(1500ms)
  → setCurrentView('puzzle')
  → Render PuzzleSessionView
```

---

## Phase 2: Puzzle Session Integration

### Status: NOT STARTED

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Move puzzle_session components | PENDING | - | To components/puzzle/ |
| Update imports/paths | PENDING | - | Fix all relative imports |
| Add props to CenterCard | PENDING | - | puzzle, processAim |
| Add props to Board | PENDING | - | puzzleId, onExit |
| Create constants/colors.ts | PENDING | - | Unified color definitions |
| Create constants/puzzleGrid.ts | PENDING | - | CELL_SIZE, SHAPES |
| Map VisualPiece ↔ PuzzlePiece | PENDING | - | Type conversion functions |

### Files to Move
```
puzzle_session/components/Board.tsx        → components/puzzle/PuzzleBoard.tsx
puzzle_session/components/GridBackground   → components/puzzle/GridBackground.tsx
puzzle_session/components/CenterCard.tsx   → components/puzzle/CenterCard.tsx
puzzle_session/components/PuzzlePiece.tsx  → components/puzzle/PuzzlePiece.tsx
puzzle_session/components/QuadrantSpawner  → components/puzzle/QuadrantSpawner.tsx
puzzle_session/components/Mascot.tsx       → components/mascot/PuzzleMascot.tsx
puzzle_session/store.ts                    → store/puzzleSessionStore.ts
puzzle_session/constants.ts                → constants/puzzleGrid.ts
puzzle_session/types.ts                    → (merge into types.ts)
```

---

## Phase 3: AI Agent Connections

### Status: NOT STARTED

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Extend orchestrator events | PENDING | Codex | PIECE_CREATED handler |
| Connect QuadrantSpawner AI | PENDING | Codex | eventBus integration |
| Preference profile updates | PENDING | Codex | PIECE_PLACED/EDITED/DELETED |
| Render AI suggestions | PENDING | - | Ghost piece UI |

### New Event Types
```typescript
// Already in domain/models.ts, need handlers in orchestrator:
'PIECE_CREATED'    // User drags from spawner with "Ask AI"
'PIECE_PLACED'     // User places piece on grid
'PIECE_EDITED'     // User edits piece annotation
'PIECE_DELETED'    // User removes piece
```

---

## Phase 4: Polish & Anchors

### Status: NOT STARTED

| Task | Status | Owner | Notes |
|------|--------|-------|-------|
| Create AnchorCard component | PENDING | - | Starting/Solution UI |
| Add anchor placement logic | PENDING | - | Near center card |
| Transition animations | PENDING | - | Framer Motion polish |
| End-to-end testing | PENDING | - | Full flow validation |
| Edge case handling | PENDING | - | Empty states, errors |

---

## Codex Backend Review (2025-11-30)

### Issues Found & Fixed

| Issue | Severity | Status | Fix Applied |
|-------|----------|--------|-------------|
| `require()` in orchestrator.ts:82-103 | HIGH | FIXED | Replaced with module-level callback + setMascotCallback() |
| Async handlers without error catching | HIGH | FIXED | Added safeAsync() wrapper in orchestrator |
| undo() missing subscriber notification | MEDIUM | FIXED | Added subscribers.forEach() to undo() |
| PuzzleSessionView no store subscription | MEDIUM | FIXED | Added contextStore.subscribe() in useEffect |
| UIEvent payload typed as `any` | MEDIUM | TODO | Need UIEventPayloadMap discriminated union |
| Agent JSON parsing without validation | MEDIUM | TODO | Consider adding zod schema validation |

### Files Modified
- `ai/orchestrator.ts` - Fixed require() and added async error handling
- `store/runtime.ts` - Updated setMascotProposalListener to use setMascotCallback
- `store/contextStore.ts` - Fixed undo() subscriber notification
- `views/PuzzleSessionView.tsx` - Added store subscription

---

## Known Issues / Blockers

### Issue 1: Type Duplication
**Problem**: `types.ts` and `domain/models.ts` have overlapping Position, Puzzle types
**Solution**: Use domain/models.ts as source of truth, map in UI layer
**Status**: TO BE ADDRESSED in Phase 2

### Issue 2: Zustand vs Custom Store
**Problem**: puzzle_session uses Zustand, main app uses contextStore
**Solution**: Keep both - Zustand for visual state, contextStore for domain data
**Status**: ACCEPTED - dual store pattern

### Issue 3: Mock Data Hardcoded
**Problem**: INITIAL_LEVERS, INITIAL_PUZZLES in App.tsx
**Solution**: Move to contextStore initialization (future: hydrate from IndexedDB)
**Status**: DEFERRED - not blocking integration

### Issue 4: Color Mismatch
**Problem**: puzzle_session/constants.ts colors don't match Figma palette
**Current**: form=#3544E0 (Blue), motion=#00DE8C (Green)
**Figma**: FORM=Green, MOTION=Blue
**Solution**: Fix in constants/colors.ts during Phase 2
**Status**: TO BE FIXED

---

## Testing Checklist

### Navigation
- [ ] Click unfinished puzzle card → Loading transition → Puzzle session
- [ ] Click finished puzzle card → Shows summary (no navigation)
- [ ] Click "End Puzzle" → Summary generated → Return to canvas
- [ ] Browser back button behavior (if applicable)

### Puzzle Session View
- [ ] Central question displays from selected puzzle
- [ ] Process Aim visible in header
- [ ] Four quadrant spawners positioned correctly
- [ ] Drag from spawner creates piece
- [ ] Piece snaps to grid cells
- [ ] Pieces must connect to center or other pieces
- [ ] Invalid drop position shows red feedback
- [ ] Shake gesture changes piece label

### Post-Puzzle Canvas
- [ ] Summary card appears in canvas view
- [ ] Related fragments show puzzle label badge
- [ ] Puzzle deck card shows "Finished" checkmark
- [ ] Can create new puzzles after completing one

---

## Dependencies

### NPM Packages (already installed in puzzle_session)
- `framer-motion` - Animations
- `zustand` - Local state for puzzle session
- `uuid` - Piece ID generation
- `clsx` - Class name utilities
- `lucide-react` - Icons

**Action**: Verify these are in main package.json or add them

---

## Notes & Decisions

### 2025-11-30
- Decided on dual-store pattern (Zustand + contextStore)
- Will use view state machine instead of react-router
- Loading transition will show "Entering your puzzle..." with animation
- Quadrant colors to be corrected per Figma palette

---

## Quick Commands

```bash
# Run dev server
npm run dev

# Check for TypeScript errors
npx tsc --noEmit

# Verify imports work after moving files
npm run build
```

---

**Next Action**: Create views/ folder and extract HomeCanvasView
