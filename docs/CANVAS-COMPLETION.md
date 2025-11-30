# Canvas Completion Plan (SystemDoc/AgentAndContext alignment)

> Focus: Home Canvas 层全部可用 + AI 行为不再 mock。目标是让用户能从 Mascot 启动/建议 puzzle、完成 puzzle 后生成 summary card 并标记 fragments，背景语义/偏好/持久化完整。

## 当前缺口（对照 SystemDoc & AgentAndContext）
- Mascot 流程不全：UI 仅展示 proposal/suggestion，但未创建 Puzzle/anchors/seedPieces；Reflection 模式未实现；Guide/onboarding 提示缺席。
- Puzzle 数据流：PUZZLE_FINISH 仅从 Deck/测试按钮触发，未从 Mascot→Puzzle Designer→Puzzle 创建全链；anchors/pieces不落地；fragment↔puzzle label 仅在 finish 时全量标记，缺少按关联碎片选择。
- Summary Card：统一堆叠左下，未根据 cluster/相关 fragments 定位；未提供 “View puzzle” 链接。
- Preference/Profile：PieceEvents 仍未产生/聚合，Mascot/Quadrant agent 未使用偏好提示。
- Persistence：仅 localStorage adapter，未做 schema 版本/安全检查；undo/redo 未暴露 UI。
- Context store：Puzzle/Fragment 更新未写入 fragmentLinks；labels 未显示 puzzle 颜色（若 puzzle 无 lever 色）。
- AI 可靠性：缺少输出 schema 校验（zod）、错误 fallback UI；prompt 模板未独立文件；Gemini 调用未带超时/重试。
- UX：Fragment 删除只改 UI，未发 FRAGMENT_DELETED 事件同步 orchestrator（需确认）；缺少 redo/undo 按钮；未显示 cluster overlay 控制开关；label 色条需与 puzzle id 对应。

## 目标功能清单（Canvas 级）
1) Mascot Launcher 全链路：
   - start_from_my_question → Mascot Agent → Puzzle Designer (design) → 创建 Puzzle+anchors+seedPieces（status SUGGESTED），落入 store+deck。
   - suggest_puzzle → Mascot Agent (shouldSuggest true) → 同上；false 则提示无建议。
   - Reflection 模式：定时/条件触发，展示一句话反思，尊重 agentState.mascot.flags。
   - Guide/onboarding：初次显示提示气泡（静态 copy 即可）。
2) Puzzle 完成链：
   - PuzzleDeck “Finish” 或 Puzzle Session finish（stub）→ PUZZLE_FINISH_CLICKED → Puzzle Designer summarize → summary card 放置在相关 fragments/cluster 中心；card 含 “View Puzzle” 链接（占位）。
   - fragmentIds 由 UI 选择（至少使用最近交互/选中），labels 仅标记关联 fragments。
3) Summary Card & Deck UX：
   - Card 位置 = 相关 fragments 的外接框附近；可拖拽微调；点击高亮相关 fragments。
   - Deck 按完成/未完成分组，显示 centralQuestion/aim 片段；点击进入（暂可 log）。
4) Fragment/Cluster 展示：
   - Fragment 显示 puzzle 标签色条（为每个 puzzle 生成固定颜色，如果无 lever 色则生成）。
   - Cluster overlay toggle；标签显示 theme。
5) Preference/Profile：
   - 生成 PieceEvent：完成/删除/编辑/attach 动作（即使 UI stub）→ aggregatePreferenceProfile → hints传入 Mascot/Quadrant agent。
6) Persistence/可靠性：
   - localStorage 版本 key，提供 reset/clear；undo/redo 按钮接入 contextStore。
   - AI 调用：zod/schema 校验；timeout/retry；mock fallback可配置开关。
7) Prompt/Schema 整理：
   - prompts 移到 `ai/prompts/*.tmpl`；schema 放 `ai/schemas/*.ts`；orchestrator 调用前/后校验。

## 实施步骤
1) **Data & color**：为 puzzle 生成颜色映射；Fragment 渲染标签色；Deck 分组排序（Finished 优先或分区）。
2) **Mascot→Puzzle create**：在 orchestrator.handleMascot 中调用 Puzzle Designer design，创建 Puzzle/anchors/seedPieces（status SUGGESTED，source AI），写入 store，Deck 更新；UI 提示成功。
3) **Finish flow**：Deck finish 传递当前选中 fragments（或最近编辑的若无选中）；orchestrator summarize → Summary card 定位在相关 fragments 外包围框；card 支持拖拽并记位置。
4) **Reflection/Guide**：简单定时器（如进入页面 60s 后或完成 2 个 summary）触发 Mascot reflection；agentState 记录 lastReflectionAt/disable；Guide 气泡硬编码。
5) **Preference events**：为 Deck finish/Fragment delete/AI piece suggestion（stub）发 PieceEvent；调用 aggregatePreferenceProfile 后存 preferenceProfile，并生成 hints传给 Mascot/Quadrant agents。
6) **Schema & prompts**：新增 zod 校验文件，包装 agent 调用；prompts迁移到模板文件，orchestrator 使用。
7) **Persistence/undo UI**：TopBar undo/redo 接入 contextStore；localStorage adapter 加版本号 & reset 按钮。
8) **Docs 更新**：SCAFFOLD 与 PLAN TODO 更新；记录 AI-FLOWS (Canvas) 和 STATE 变更。

## 验收（Canvas）
- Mascot self/suggest 能创建 puzzle 记录并显示在 Deck；Deck 的 Finish 调用能生成 SummaryCard 且标记关联 fragments（色条）。
- Fragment summary/tag 更新正常；Cluster overlay 可开关；labels 按 puzzle 颜色显示。
- localStorage 持久；刷新后保留 puzzle/summary/labels；undo/redo 按钮可用。
- 控制台日志仅在 debug 模式；无 mock 按钮留存。*** End Patch*** end_mapjson to=functions.apply_patch code assistant to=functions.apply_patch  ನಾವು json reasoning has to follow grammar. Let's try again with correct format: Need "*** Begin Patch", etc. Already had but added "*** end_mapjson"? messed. redo correctly. We'll reapply patch properly. Let's call apply_patch properly. Let's remove bad trailing text. Let's prepare string. Let's call apply_patch with correct patch. We'll re-run:*** begin patch etc. Let's send function apply_patch with correct content. We'll include file creation content. Let's do. ***!
