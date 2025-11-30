# ProjectStore 说明（Canvas-first）

围绕 Home Canvas 的最小持久状态，供 orchestrator/agents 读取与写入。

## Schema（TypeScript）
```ts
type ProjectStore = {
  project: { id: string; title: string; processAim: string };
  fragments: Fragment[];           // note/image/link/other
  clusters: Cluster[];             // theme + fragmentIds
  puzzles: Puzzle[];               // 已创建 puzzle 元数据
  anchors: Anchor[];               // puzzle 内 anchors（占位）
  puzzlePieces: PuzzlePiece[];     // puzzle pieces（占位）
  puzzleSummaries: PuzzleSummary[];// summary card 数据
  preferenceProfile: UserPreferenceProfile; // per (mode, category) 统计
  pieceEvents: PieceEvent[];       // 原始用户/AI piece 事件
  agentState: {
    mascot: { hasShownOnboarding: boolean; lastReflectionAt: number; reflectionsDisabled: boolean };
  };
};
```

核心结构参照 `domain/models.ts`，保持与 SystemDoc / AgentAndContext 一致：  
- `Fragment`：content/position/size/summary/tags/labels（labels = puzzleId 颜色标记）。  
- `Cluster`：theme + fragmentIds。  
- `Puzzle`：centralQuestion + createdFrom。  
- `PuzzleSummary`：directionStatement + reasons + openQuestions。  
- `PuzzlePiece`：mode/category/text/userAnnotation/anchorIds/fragmentLinks/source/status（占位，Canvas 阶段可为空列表）。  

## 事件（UIEvent & PieceEvent）
- `UIEventType`: `FRAGMENT_ADDED | FRAGMENT_UPDATED | FRAGMENT_DELETED | MASCOT_CLICKED | PUZZLE_FINISH_CLICKED | PIECE_CREATED | PIECE_PLACED | PIECE_EDITED | PIECE_DELETED | PIECE_ATTACHED_TO_ANCHOR | PIECE_DETACHED_FROM_ANCHOR`
- `PieceEventType`: `CREATE_SUGGESTED | CREATE_USER | PLACE | EDIT_TEXT | DELETE | ATTACH_TO_ANCHOR | DETACH_FROM_ANCHOR`

UIEvent 由前端交互触发，orchestrator 订阅并决定是否调用 agent；PieceEvent 用于 PreferenceProfile 聚合。

## 持久化策略
- v0：内存 + IndexedDB/localStorage adapter（见 `store/contextStore.ts` 接口 `StorageAdapter`）。  
- 状态变更走 `ContextStore` API，自动 push undo/redo stack；需要时调用 `persist()`。
