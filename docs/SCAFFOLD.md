# Puzzle AI Scaffold（Canvas-first）

> 作为骨架文档，说明当前代码结构、计划中的模块、数据流与职责边界。以 Home Canvas 为核心，兼顾后续 Puzzle Session 接口占位。

## 目录/分层总览
- `App.tsx`：当前入口，渲染 Home Canvas（Fragment 创建/拖拽、TopBar 目标输入、PuzzleDeck mock）。
- `components/`：UI 颗粒
  - `TopBar.tsx`：项目标题 + Process Aim 输入（待接 store）。
  - `Toolbar.tsx`：指针/文本/图片/框选工具 + Ask Agent 按钮（待接 mascot/orchestrator）。
  - `Fragment.tsx`：文本/图片/链接/Frame 卡片，拖拽/缩放，显示 leverColor（未来显示标签/summary/tag）。
  - `PuzzleDeck.tsx`：展示所有 puzzle（user/AI 创建），未完成的仍可从 deck 进入；完成的标记 Finished，可点击 Finish 触发 PUZZLE_FINISH。
  - `MascotPanel.tsx`：Guide/Puzzle Launcher UI（start from my question / suggest puzzle），展示 orchestrator 输出。
  - `SummaryCard.tsx`：Puzzle Summary card，落在 Canvas 上并链接 fragments。
  - `ClusterOverlay.tsx`：clusters 可视化（轻描边/背景块）。
- `domain/`
  - `models.ts`：数据模型与枚举（ProjectStore, Fragment, Cluster, Puzzle, Anchor, PuzzlePiece, PuzzleSummary, UIEvent, PieceEvent, PreferenceProfile 等）。
- `store/`
  - `contextStore.ts`：ProjectStore 读写器，含 undo/redo 栈、StorageAdapter hook、CRUD helper（processAim、fragment/cluster/puzzle/piece/summary、labelFragments、preferenceProfile）。
  - `eventBus.ts`：UIEvent 事件总线（emit/subscribe），供 orchestrator 监听。
  - `preferenceProfile.ts`：PieceEvent 聚合 → UserPreferenceProfile，生成 preference hints。
  - `adapters/localStorageAdapter.ts`：StorageAdapter 实现，落地 persist/hydrate。
  - （计划）`adapters/indexedDbAdapter.ts`：StorageAdapter 实现，落地 persist/hydrate。
- `ai/`（计划）
  - `orchestrator.ts`：订阅 eventBus，裁剪 context，调用 agents（FragmentContext/Mascot/PuzzleDesigner/QuadrantPiece），写回 contextStore，使用 ADK 客户端；现已接入。
  - `orchestratorStub.ts`：旧版占位，可停用。
  - `agents/`：分角色 prompt/调用（FragmentContextAgent, MascotAgent, PuzzleDesignerAgent, QuadrantPieceAgent，占位 Aim/IdeationAgent）。
  - `prompts/`：可版本化模板，遵循 AgentAndContext 契约。（暂内联）
  - `schemas/`：zod/JSON schema 校验 agent 输出。（待建）
  - `adkClient.ts`：封装 Google ADK/Gemini 3（model/temperature/timeout/safety/retry/mock）。
- `services/`
  - `geminiService.ts`：现有简易 Lever 检测（将被 ai/adkClient + orchestrator 取代）。
- `docs/`
  - `PLAN-2025-11-29.md`：Canvas-first 里程碑与 TODO。
  - `STATE.md`：ProjectStore schema 与事件定义。
  - `SCAFFOLD.md`：本文件。
  - （计划）`AI-FLOWS.md`：只记录 Canvas 相关流（Fragments→Context、Mascot→Puzzle Proposal、Puzzle Finish→Summary Card）。

## 核心对象与契约
- **ProjectStore**（see domain/models）：项目级单一 JSON，含 fragments/clusters/puzzles/anchors/puzzlePieces/puzzleSummaries/preferenceProfile/pieceEvents/agentState。
- **Fragments**：自由放置的文本/图片/链接/other，附 summary/tag/labels（labels = puzzleId 色标，表明该 fragment 贡献到哪些 puzzle；不是类别色条），可与 puzzle pieces 多对多 via `FragmentLink`。（SystemDoc §1.2，clarification about labels）
- **Clusters**：fragmentIds + theme，用于 Canvas 语义可视化与 mascot 建议。
- **Puzzles & Summaries**：centralQuestion + createdFrom；PuzzleSummary = directionStatement + reasons + openQuestions，渲染为 Canvas 卡片；未完成的 puzzle 也驻留在 PuzzleDeck，可随时进入（AgentAndContext Flow B/C，SystemDoc §2.4）。
- **Events**：UIEventType（FRAGMENT_*，MASCOT_CLICKED，PUZZLE_FINISH_CLICKED，PIECE_*），PieceEventType（CREATE_SUGGESTED/USER, PLACE, EDIT_TEXT, DELETE, ATTACH/DETACH_TO_ANCHOR）。
- **PreferenceProfile**：按 (mode, category) 聚合 PieceEvents，生成 preference hints 供 agents 提示风格。

## 数据流（Canvas-first）
- **Flow: Fragments → Context**
  1) UI 触发 FRAGMENT_*（add/update/delete）→ eventBus。
  2) orchestrator debounce 收敛 → 调用 Fragment & Context Agent（输入：processAim + fragments + existingClusters）。
  3) Agent 返回 summary/tags/clusters → contextStore.upsertFragment/upsertCluster。
  4) UI 重渲染 fragments（summary/tag 展示）+ cluster overlay。
- **Flow: Mascot Self/Suggest Puzzle**
  1) MASCOT_CLICKED(start_from_my_question | suggest_puzzle) → eventBus。
  2) orchestrator 裁剪 context（processAim, nearby fragments summaries, puzzleSummaries, preferenceHints, clusters）→ Mascot Agent。
  3) 输出 centralQuestion + primaryModes + rationale；UI 面板展示。
  4) （Canvas 阶段）可直接生成占位 Puzzle + PuzzleSummary 或等待用户进入 Puzzle Session。
- **Flow: Puzzle Finish → Summary Card**
  1) PUZZLE_FINISH_CLICKED（stub）携 puzzle snapshot。
  2) orchestrator → Puzzle Designer Agent (task: summarize) → PuzzleSummary。
  3) 写入 contextStore.addPuzzleSummary + labelFragments；UI 在 Canvas 放 card、给 fragments 加色标。
- **Flow: Preference 聚合**
  - PIECE_* 事件 → contextStore.addPieceEvent → aggregatePreferenceProfile → setPreferenceProfile；preferenceHints 传入 Mascot/QuadrantPiece Agent。

## 组件与状态连接
- `App.tsx`：未来通过 ContextStore hooks 提供 state/dispatch，事件交由 eventBus；避免 useState 直改。
- `TopBar`：value 从 store.project.processAim，onChange → updateProcessAim + emit FRAGMENT_UPDATED?（仅 aim 变更不触发 fragment 语义化）。
- `Toolbar`：Ask Agent → MASCOT_CLICKED；工具状态仍本地 UI state。
- `Fragment`：onChange → upsertFragment + emit FRAGMENT_UPDATED；标签/summary/tag 从 store 读。
- `Fragment` 删除：按钮或 Delete/Backspace（非输入中）→ setFragments → 同步至 contextStore & eventBus（FRAGMENT_DELETED）。
- `PuzzleDeck`：将来替换为 PuzzleSummaryCards，从 store.puzzleSummaries 读；点击可触发 “View puzzle”。
- `MascotPanel`（计划）：从 orchestrator 提供的 proposal/reflection 渲染。

## 持久化与恢复
- `StorageAdapter` 接口（contextStore）：实现 IndexedDB/localStorage；`hydrate()` 初始加载；`persist()` 主动保存。Undo/redo 仍在内存，持久化时只写当前 state。

## 未来接 Puzzle Session（占位）
- 保留 models 中 `PuzzlePiece/Anchor/PieceStatus` 等，便于后续 Quadrant UI 接入；现阶段可为空列表，但 orchestrator/agents 契约已定义。

## 运行与扩展提示
- 运行：`npm install && npm run dev`（需 tailwind CDN，已在 index.html）。AI 需后续替换为 ADK 客户端。
- 扩展建议：优先把现有 Canvas state 接到 contextStore/eventBus，再接 Fragment & Context Agent mock，最后接 mascot/puzzle summary flow。
