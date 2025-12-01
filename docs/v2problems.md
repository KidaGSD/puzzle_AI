# Puzzle AI v2 - Current Problems

**Date**: 2025-12-01
**Status**: Critical issues blocking proper user experience
**Version**: 2.1 (Updated with corrected puzzle session model)

---

## 0. Fundamental Conceptual Error (CRITICAL)

### 0.1 Puzzle Type Was Modeled Per-Piece Instead of Per-Session

**Wrong Understanding (v1/v2.0)**:
- Each PIECE has a category (Clarify/Expand/Refine)
- Each hub has [C][E][R] buttons
- User picks category per piece

**Correct Understanding (v2.1)**:
- Each PUZZLE SESSION is ONE type (Clarify/Expand/Refine)
- A puzzle is either a "Clarify puzzle", "Expand puzzle", or "Refine puzzle"
- All pieces within that session follow that ONE operation type
- Hubs just have [+] button, pieces inherit session type

**Impact**: This affects:
- Data model (`Puzzle.type` instead of `PuzzlePiece.category`)
- UI design (no [C][E][R] per hub, single [+] button)
- AI prompts (quadrantPieceAgent receives puzzleType from session)
- Deck cards (should show puzzle type badge with color)
- Preference tracking (per `{puzzleType, mode}` not `{mode, category}`)

---

## 1. AI Content Generation Issues

### 1.1 Content Never Loads (Always "Generating...")
**Symptom**: Preview popup shows "AI is thinking..." forever
**Root Cause**:
- `PIECE_CREATED` event is emitted but `PIECE_CONTENT_UPDATED` is never emitted back
- The orchestrator's `handlePieceCreated` function calls `quadrantPieceAgent` but doesn't emit the response event
- No listener properly updates the store with AI-generated content

**Expected Flow (corrected)**:
1. UI: User clicks [+] in hub → `PIECE_CREATED` event with `{mode, puzzleType}`
2. Orchestrator: Calls Quadrant Piece Agent with session's puzzle type + quadrant mode
3. Agent: Returns pieces with `text` (the question/prompt appropriate to type)
4. Orchestrator: Inserts pieces as `status: "SUGGESTED"`, emits update
5. UI: Shows suggested pieces for user to place

**Current Flow**:
1. UI: Drag starts → `PIECE_CREATED` event → content requested
2. AI response → ??? (never properly handled)
3. Store never updated → UI shows loading forever

### 1.2 Wrong Content Model
**Symptom**: Pieces show AI-generated "titles" instead of proper piece structure
**Root Cause**: Current implementation treats pieces as having:
- `title` (AI-generated label)
- `content` (AI-generated description)

**Expected Model**:
```typescript
type PuzzlePiece = {
  text: string             // The QUESTION/PROMPT on the piece (AI-generated)
  userAnnotation?: string  // User's SHORT ANSWER or note (user-filled)
  source: "AI" | "USER" | "AI_SUGGESTED_USER_EDITED"
  status: "SUGGESTED" | "PLACED" | "EDITED" | "DISCARDED" | "CONNECTED"
  // NO category field - inherited from puzzle.type
}
```

**Impact**: Pieces should show thought-provoking questions appropriate to the SESSION TYPE:
- Clarify session: "Should the design feel more geometric or organic?"
- Expand session: "If this interface were an object, what would it feel like?"
- Refine session: "From everything, what 2 visual elements *must* remain?"

---

## 2. Piece Placement Issues

### 2.1 Cannot Place Pieces Adjacent to Center Card
**Symptom**: Pieces turn red (invalid) even when visually touching center card
**Root Cause**: Grid calculation mismatch between:
- Visual rendering position
- Logical collision detection coordinates
- Cell offset calculations

**Debug Info Needed**:
- Center card bounds: `x: [-2, 1], y: [-1, 0]` for 4x2 card
- Adjacent positions should be: `x=-3` (left), `x=2` (right), `y=-2` (top), `y=1` (bottom)
- Current shapes use 0-indexed cells that may offset incorrectly

### 2.2 Visual Position vs Logical Position Mismatch
**Symptom**: Pieces appear to overlap center card but shouldn't per validation
**Root Cause**:
- Rendering uses `(data.position.x + minX) * CELL_SIZE`
- But collision uses `targetPos.x + cell.x`
- These calculations may not align properly

---

## 3. Missing Core Features

### 3.1 Puzzle Type Not Implemented
**Expected**: When creating a puzzle:
- Mascot suggests puzzle type based on context
- Type badge visible in session header and on deck cards
- All pieces generated according to session type
- Color coding: Blue (Clarify), Green (Expand), Orange (Refine)

**Current**: No puzzle type selection, no type badge, pieces have per-piece category (wrong)

### 3.2 Anchors Not Implemented
**Expected**: Each puzzle has two anchors:
- **Starting (Why)**: Underlying motivation/problem/tension
- **Solution (What)**: Emerging direction or bet

**Current**: No anchor UI components exist. Pieces cannot be attached to anchors.

### 3.3 Piece Status Flow Not Implemented
**Expected States**:
- `SUGGESTED` → AI proposes, shown near hub as draggable
- `PLACED` → User dropped on board
- `EDITED` → User modified the annotation
- `DISCARDED` → User rejected
- `CONNECTED` → Attached to an anchor

**Current**: All pieces go directly to a single "placed" state.

### 3.4 User Annotation Not Implemented
**Expected**: Users can write short answers/notes inside pieces
**Current**: Double-click only edits the AI-generated title

### 3.5 PreferenceProfile Not Used
**Expected**: Track `(puzzleType, mode)` stats to adapt AI suggestions
**Current**: preferenceProfile exists in types but never updated or used in prompts

---

## 4. UI/UX Issues

### 4.1 Hub UI Wrong
**Current**: Each hub has [C][E][R] buttons for category selection
**Expected**: Each hub has single [+] button (category comes from session type)

### 4.2 No Puzzle Type Badge
**Current**: No visual indicator of puzzle type
**Expected**: Color-coded badge showing [CLARIFY], [EXPAND], or [REFINE]:
- In session header
- On puzzle deck cards
- Influences piece colors

### 4.3 Pieces Show Wrong Content Type
**Symptom**: Pieces display things like "Social Connection vs. Solitary Ritual?" with full paragraphs
**Expected**: Pieces should show SHORT prompts appropriate to session type:
- Clarify: "Which 3 emotions best describe what you want people to feel?"
- Expand: "If this interface were an object, what would it feel like to touch?"
- Refine: "Which one emotional axis feels most important to commit to now?"

---

## 5. Data Flow Issues

### 5.1 Orchestrator Event Handling Incomplete
**Missing Handlers**:
- `PIECE_PLACED` → Should update status, increment preferenceProfile
- `PIECE_EDITED` → Should update status, increment preferenceProfile
- `PIECE_DELETED` → Should update status, increment discarded count
- `PIECE_ATTACHED_TO_ANCHOR` → Should update status to CONNECTED
- `PIECE_CONTENT_UPDATED` → Should update piece text in store

### 5.2 Store Not Syncing with Domain
**Current**: `puzzleSessionStore` (Zustand) and `contextStore` (custom) are separate
**Expected**: Visual state should sync to domain store for AI context

### 5.3 Puzzle Type Not Passed to Agents
**Current**: quadrantPieceAgent receives `mode` and `category` per piece
**Expected**: quadrantPieceAgent should receive `puzzleType` from session + `mode` from hub

---

## 6. Technical Debt

### 6.1 Duplicate Path Generation Code
- `PuzzlePiece.tsx` has `generateUnifiedPath()`
- `QuadrantSpawner.tsx` has `generateShapePath()`
- Should be extracted to shared utility

### 6.2 Too Many Background Bash Processes
- Multiple dev servers running from previous sessions
- Should clean up on restart

### 6.3 Debug Logging Left In
- Console.log statements in production code
- Should be removed or gated by NODE_ENV

---

## Priority Fix Order

1. **P0**: Add puzzle type to session model
2. **P0**: Fix AI content flow (orchestrator → store → UI)
3. **P0**: Fix piece placement detection
4. **P1**: Update hub UI to single [+] button (remove [C][E][R])
5. **P1**: Add puzzle type badge and color coding
6. **P1**: Add Anchors UI and attachment logic
7. **P2**: Implement piece status lifecycle
8. **P2**: Implement user annotations
9. **P3**: Connect preferenceProfile (now per puzzleType+mode) to AI prompts

---

## Quick Reference: v1 vs v2.1

| Aspect | v1 (Wrong) | v2.1 (Correct) |
|--------|------------|----------------|
| Puzzle operation type | Per-piece (`category`) | Per-session (`puzzle.type`) |
| Hub UI | [C][E][R] buttons | Single [+] button |
| Piece generation | Specify category | Inherit from session type |
| Type visibility | None | Badge in header + deck cards |
| Preference tracking | `{mode, category}` | `{puzzleType, mode}` |
