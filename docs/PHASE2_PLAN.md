# Phase 2: Puzzle Session Data Integration

**Created**: 2025-11-30
**Status**: Planning
**Prerequisite**: Phase 1 Complete (UI Refinement)

---

## Summary of Phase 1 Accomplishments

### UI Refinement Completed (2025-11-30)
- **QuadrantSpawner**: Redesigned as colored pill buttons (w-24 h-10 rounded-xl)
- **CenterCard**: 4x2 grid-aligned, hover shows popup tooltip for context
- **Grid System**: Robust collision detection, pieces can't overlap center card
- **Colors**: Fixed FORM (Blue #5E5BFF), MOTION (Green #00DE8C) palettes
- **Mascot**: Pink bubble (#FFB5FA), vertically centered
- **Labels**: Removed duplicate labels from GridBackground

### Current Grid Layout
```
Center Card: 4x2 cells (256x128px)
  X bounds: -2, -1, 0, 1
  Y bounds: -1, 0

Adjacent placement zones:
  Left:   x = -3
  Right:  x = 2
  Top:    y = -2
  Bottom: y = 1
```

---

## Phase 2 Goals

Connect the visual puzzle session to the domain data model and AI system.

### 2.1 Domain Model Integration

**Current State:**
- `puzzleSessionStore.ts` manages visual pieces (Zustand)
- `contextStore.ts` manages domain data (custom store)
- No connection between them

**Target State:**
- Visual pieces sync to domain PuzzlePiece on placement
- Domain state drives AI suggestions
- Undo/redo affects both stores

### 2.2 Tasks

| Task | Priority | Effort |
|------|----------|--------|
| Map VisualPiece → PuzzlePiece | HIGH | 2h |
| Sync puzzleSessionStore → contextStore | HIGH | 2h |
| Pass Puzzle data to CenterCard | HIGH | 1h |
| Connect End Puzzle to summary generation | HIGH | 2h |
| Add AnchorCard components (Starting/Solution) | MEDIUM | 3h |
| Connect QuadrantSpawner to quadrantPieceAgent | MEDIUM | 3h |
| Implement piece deletion/editing | LOW | 2h |
| Undo/Redo for puzzle session | LOW | 2h |

---

## 2.3 Implementation Details

### Task 1: VisualPiece → PuzzlePiece Mapping

```typescript
// store/puzzleSessionStore.ts

import { contextStore } from './runtime';
import { PuzzlePiece, DesignMode, PuzzlePieceCategory } from '../domain/models';

const toDomainPiece = (visual: Piece, puzzleId: string): PuzzlePiece => ({
  id: visual.id,
  puzzleId,
  mode: visual.quadrant.toUpperCase() as DesignMode,
  category: 'CLARIFY' as PuzzlePieceCategory, // Default
  text: visual.label || '',
  userAnnotation: '',
  anchorIds: [],
  fragmentLinks: [],
  source: 'USER',
  status: 'PLACED',
});

// In addPiece action:
addPiece: (piece, puzzleId) => {
  set((state) => ({ pieces: [...state.pieces, piece] }));

  // Sync to domain store
  const domainPiece = toDomainPiece(piece, puzzleId);
  contextStore.upsertPuzzlePiece(domainPiece);
  eventBus.emitType('PIECE_PLACED', { pieceId: piece.id });
}
```

### Task 2: Pass Puzzle Data to PuzzleSessionView

```typescript
// views/PuzzleSessionView.tsx

interface PuzzleSessionViewProps {
  puzzleId: string;
  onEndPuzzle: () => void;
}

export const PuzzleSessionView: React.FC<PuzzleSessionViewProps> = ({
  puzzleId,
  onEndPuzzle
}) => {
  const puzzle = contextStore.getState().puzzles.find(p => p.id === puzzleId);
  const processAim = contextStore.getState().project.processAim;

  return (
    <Board
      puzzle={puzzle}
      processAim={processAim}
      onEndPuzzle={onEndPuzzle}
    />
  );
};
```

### Task 3: End Puzzle Summary Generation

```typescript
// views/PuzzleSessionView.tsx or Board.tsx

const handleEndPuzzle = async () => {
  // 1. Get all pieces for this puzzle
  const pieces = useGameStore.getState().pieces;

  // 2. Sync final state to contextStore
  pieces.forEach(p => {
    const domainPiece = toDomainPiece(p, puzzleId);
    contextStore.upsertPuzzlePiece(domainPiece);
  });

  // 3. Trigger summary generation via orchestrator
  eventBus.emitType('PUZZLE_FINISH_CLICKED', {
    puzzleId,
    pieces: pieces.map(p => p.id)
  });

  // 4. Wait for summary, then navigate back
  // (orchestrator will call puzzleDesignerAgent)
  onEndPuzzle();
};
```

### Task 4: AnchorCard Component

```typescript
// components/puzzle/AnchorCard.tsx

interface AnchorCardProps {
  type: 'STARTING' | 'SOLUTION';
  text: string;
  position: 'top' | 'bottom';
  onEdit: (newText: string) => void;
}

export const AnchorCard: React.FC<AnchorCardProps> = ({
  type,
  text,
  position,
  onEdit
}) => {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className={`
      absolute ${position === 'top' ? 'top-1/4' : 'bottom-1/4'}
      left-1/2 -translate-x-1/2
      bg-white rounded-lg shadow-lg px-4 py-2
      border-l-4 ${type === 'STARTING' ? 'border-amber-500' : 'border-emerald-500'}
    `}>
      <div className="text-[10px] font-bold text-gray-400 uppercase">
        {type === 'STARTING' ? 'Why (Starting Point)' : 'What (Solution Direction)'}
      </div>
      {isEditing ? (
        <input
          value={text}
          onChange={(e) => onEdit(e.target.value)}
          onBlur={() => setIsEditing(false)}
          className="text-sm text-gray-700 w-full"
          autoFocus
        />
      ) : (
        <div
          className="text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
          onClick={() => setIsEditing(true)}
        >
          {text || 'Click to add...'}
        </div>
      )}
    </div>
  );
};
```

### Task 5: QuadrantSpawner AI Integration

```typescript
// components/puzzle/QuadrantSpawner.tsx

// Add "Ask AI" button that appears on hover
<div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity">
  <button
    onClick={() => {
      eventBus.emitType('PIECE_CREATED', {
        mode: quadrant.toUpperCase(),
        category: selectedCategory, // CLARIFY | EXPAND | REFINE
        puzzleId,
      });
    }}
    className="text-[10px] text-gray-500 hover:text-gray-700"
  >
    Ask AI
  </button>
</div>
```

---

## 2.4 Orchestrator Extensions

Add handlers for new puzzle session events:

```typescript
// ai/orchestrator.ts

case 'PIECE_PLACED':
  // Update preference profile
  updatePreferenceProfile(event.payload);
  break;

case 'PIECE_CREATED':
  // Generate AI suggestions
  const suggestions = await runQuadrantPieceAgent({
    processAim: state.project.processAim,
    mode: event.payload.mode,
    category: event.payload.category,
    puzzle: state.puzzles.find(p => p.id === event.payload.puzzleId),
    anchors: state.anchors,
    existingPiecesForMode: state.puzzlePieces.filter(p =>
      p.mode === event.payload.mode
    ),
  }, client);

  // Emit suggestions back to UI
  mascotCallback?.({
    action: 'piece_suggestions',
    suggestions: suggestions.pieces,
  });
  break;

case 'PUZZLE_FINISH_CLICKED':
  // Generate summary
  const summary = await runPuzzleDesignerAgent({
    task: 'summarize',
    processAim: state.project.processAim,
    puzzle: state.puzzles.find(p => p.id === event.payload.puzzleId),
    anchors: state.anchors.filter(a => a.puzzleId === event.payload.puzzleId),
    pieces: state.puzzlePieces.filter(p => p.puzzleId === event.payload.puzzleId),
  }, client);

  // Store summary
  contextStore.upsertPuzzleSummary({
    puzzleId: event.payload.puzzleId,
    ...summary,
  });
  break;
```

---

## 2.5 Testing Checklist

### Data Flow
- [ ] Create piece → appears in puzzleSessionStore
- [ ] Create piece → syncs to contextStore.puzzlePieces
- [ ] Move piece → position updates in both stores
- [ ] Delete piece → removed from both stores

### Puzzle Flow
- [ ] Enter puzzle → CenterCard shows correct question
- [ ] Enter puzzle → processAim tooltip works
- [ ] End puzzle → summary generated
- [ ] End puzzle → summary card appears on canvas
- [ ] End puzzle → puzzle marked as finished in deck

### AI Flow
- [ ] Click "Ask AI" → PIECE_CREATED event emitted
- [ ] PIECE_CREATED → quadrantPieceAgent called
- [ ] AI suggestions → displayed as ghost pieces
- [ ] Accept suggestion → piece placed, status changes

### Anchors
- [ ] Starting anchor editable
- [ ] Solution anchor editable
- [ ] Anchors saved to contextStore
- [ ] Pieces can link to anchors

---

## 2.6 File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `store/puzzleSessionStore.ts` | MODIFY | Add contextStore sync, puzzleId tracking |
| `views/PuzzleSessionView.tsx` | MODIFY | Pass puzzle data to Board |
| `components/puzzle/Board.tsx` | MODIFY | Use puzzle prop for CenterCard |
| `components/puzzle/CenterCard.tsx` | MODIFY | Display dynamic question |
| `components/puzzle/AnchorCard.tsx` | CREATE | New anchor UI component |
| `components/puzzle/QuadrantSpawner.tsx` | MODIFY | Add "Ask AI" button |
| `ai/orchestrator.ts` | MODIFY | Add PIECE_* event handlers |
| `domain/models.ts` | VERIFY | Ensure PuzzlePiece type complete |

---

## 2.7 Dependencies

- Phase 1 UI Refinement: ✅ Complete
- Gemini API key configured: ✅ (existing)
- contextStore with puzzlePieces: ✅ (existing schema)
- quadrantPieceAgent: ✅ (existing, needs testing)
- puzzleDesignerAgent: ✅ (existing, needs testing)

---

## 2.8 Timeline Estimate

| Task | Time |
|------|------|
| VisualPiece mapping | 2h |
| Store sync | 2h |
| Puzzle data flow | 1h |
| End puzzle + summary | 2h |
| AnchorCard | 3h |
| AI integration | 3h |
| Testing & fixes | 2h |
| **Total** | **15h** (~2 days) |

---

**Next Phase**: Phase 3 - AI Piece Suggestions & Preference Learning

