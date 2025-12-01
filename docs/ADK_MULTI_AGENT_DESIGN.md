# Multi-Agent Puzzle System Design

## Overview

本系统采用 ADK 架构模式（虽然使用 TypeScript 实现），实现 1 个 Coordinator + 4 个 Quadrant Agents 的多 Agent 架构。

## Agent Hierarchy

```
PuzzleSessionAgent (Coordinator)
  ├── FormQuadrantAgent       → output: form_pieces
  ├── MotionQuadrantAgent     → output: motion_pieces
  ├── ExpressionQuadrantAgent → output: expression_pieces
  └── FunctionQuadrantAgent   → output: function_pieces
```

## Core Constraints

### 1. Piece Content Format (陈述式)
- **Each piece is a SHORT STATEMENT, NOT a question**
- Bad: "How does the digital experience reflect the awakening?"
- Good: "Digital experience as gentle awakening"
- Never end with question mark (?)

### 2. Priority Levels (1-6)
| Priority | Role | Saturation | Position |
|----------|------|------------|----------|
| 1-2 | Core/anchor insights | High | Closest to center |
| 3-4 | Supporting insights | Medium | Middle distance |
| 5-6 | Subtle/detailed | Low | Further out |

### 3. Color Mapping
```typescript
// High saturation (priority 1-2)
FORM: #3544E0, #5354ED
MOTION: #0A6439, #169B2F
EXPRESSION: #923CFF, #8E34FE
FUNCTION: #E91D26, #FB07AA

// Medium saturation (priority 3-4)
// Low saturation (priority 5-6)
// See constants/colors.ts for full palette
```

## Data Flow

### Session Start Flow
```
UI: User opens puzzle
  → Emit PUZZLE_SESSION_STARTED { puzzleType, anchors }
  → orchestrator: handlePuzzleSessionStarted()
    → PuzzleSessionAgent:
      1. Generate central_question
      2. Build shared input for quadrants
      3. Run 4 QuadrantAgents in PARALLEL
      4. Aggregate outputs
    → Emit PUZZLE_SESSION_GENERATED { sessionState }
  → UI: Render pre-generated pieces
```

### Session End Flow
```
UI: User clicks "End Puzzle"
  → Emit PUZZLE_SESSION_COMPLETED { puzzleId }
  → orchestrator: handlePuzzleSessionCompleted()
    → Aggregate piece_events (last 30 min)
    → Update preference_profile by puzzleType + mode
  → UI: Show summary
```

## Shared Contracts

### QuadrantAgentInput
```typescript
interface QuadrantAgentInput {
  mode: DesignMode;
  puzzle_type: PuzzleType;
  central_question: string;
  process_aim: string;
  anchors: Anchor[];
  relevant_fragments: FragmentSummary[];
  existing_pieces: Array<{ text: string; priority: PiecePriority }>;
  preference_hints: string;
  requested_count: number;  // 4-6
  max_total_chars: number;  // 300
}
```

### QuadrantAgentOutput
```typescript
interface QuadrantAgentOutput {
  pieces: Array<{
    text: string;              // Statement (陈述式)
    priority: PiecePriority;   // 1-6
    saturation_level: SaturationLevel;
    fragment_id?: string;
  }>;
}
```

## Error Handling

### Timeout Strategy
- Each quadrant agent has 15s timeout
- On timeout: return fallback pieces (default examples)

### Fallback Logic
1. If AI returns questions (ending with ?), filter them out
2. If all pieces filtered, use default examples from `baseQuadrantAgent.ts`
3. If agent completely fails, log error and return empty array

## Files Structure

```
ai/agents/
  ├── baseQuadrantAgent.ts     # Shared schema, prompt, examples
  ├── formQuadrantAgent.ts     # FORM-specific wrapper
  ├── motionQuadrantAgent.ts   # MOTION-specific wrapper
  ├── expressionQuadrantAgent.ts
  ├── functionQuadrantAgent.ts
  └── puzzleSessionAgent.ts    # Coordinator

domain/models.ts               # Types: QuadrantAgentInput/Output, PuzzleSessionState
constants/colors.ts            # getPriorityColor(), priority palettes
ai/orchestrator.ts             # Event handlers for PUZZLE_SESSION_*
```

## Usage Example

```typescript
// Trigger puzzle generation from UI
eventBus.emitType('PUZZLE_SESSION_STARTED', {
  puzzleType: 'CLARIFY',
  anchors: [{ id: 'a1', type: 'STARTING', text: 'Gentle awakening theme' }]
});

// Listen for generated pieces
eventBus.subscribe((event) => {
  if (event.type === 'PUZZLE_SESSION_GENERATED') {
    const { sessionState } = event.payload;
    // sessionState.form_pieces, motion_pieces, etc.
    renderPreGeneratedPieces(sessionState);
  }
});
```

## Mode Focus Areas

| Mode | Focus | Key Aspects |
|------|-------|-------------|
| FORM | Visual structure | geometry, weight, layering, proportion, texture |
| MOTION | Movement | speed, easing, entrance/exit, micro-interactions |
| EXPRESSION | Emotional tone | mood, voice, warmth, energy level |
| FUNCTION | Purpose/utility | use case, audience, accessibility, constraints |

## Preference Learning

The system tracks user behavior to improve suggestions:

```typescript
// Key format: {puzzleType}_{mode}
// Example: "CLARIFY_FORM"
preferenceProfile: {
  "CLARIFY_FORM": {
    suggested: 10,
    placed: 7,
    edited: 3,
    discarded: 2,
    connected: 1
  }
}
```

Hints generated from profile:
- High discard rate → "keep suggestions concise"
- High edit rate → "provide starting points"
