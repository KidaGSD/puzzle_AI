
# AGENTS.md

Guidelines for coding agents working on the Puzzle app and its AI systems.

---

## 1. Code Standards

- **English only** for code, comments, filenames, commit messages, API.
- 和我对话时：用中文解释 + English terms。
- 设计 proposal / plan：写在 `docs/` 下的 Markdown，**中文为主 + English terms**。
- 保持代码可读：清晰命名、短函数、无死代码、无大段注释掉的旧实现。

---

## 2. Planning & System Design

- 在写任何代码前，先**彻底阅读**现有文档与 mockups，确认：
  - 产品目标：Puzzle app、四象限 canvas、角落 puzzle hubs、中心问题（central questions）。
  - AI 角色：**thinking partner**（反思辅助），不是内容生成器。
  - 当前 scope：不要自行扩展无关 feature。
- 输出一个简短但**结构化的 plan**（放在 `docs/PLAN-<date>.md`）：
  - 列出核心模块（例如：`frontend`, `backend`, `ai-orchestrator`, `session-store`）。
  - 为每个模块写 1–2 行目标（contract / 输入输出 / 对其他模块的依赖）。
- 所有大的设计决策（state 模型、API 形状、AI 调用 pipeline）都要在 `docs/` 下留痕，避免只存在于代码里。

---

## 3. Architecture & Skeleton (Scalable First)

> 要求从 Day 1 就按「最终系统」的形态搭建 skeleton，功能可以渐进实现，但骨架必须可扩展。

- **分层结构（layered architecture）**，推荐示例：
  - `api/`: HTTP handlers, transport 层，负责 request/response 解析。
  - `domain/` 或 `service/`: 业务逻辑（puzzle session, quadrant state, user flow）。
  - `store/`: 数据访问（interfaces + 实现），不与 HTTP / AI SDK 直接耦合。
  - `ai/`: AI 编排（prompt 模板、模型调用、post-processing）。
  - `pkg/` 或 `internal/`: 复用 utilities（logging, config, validation）。
- **接口优先（interface-first）**：
  - 先定义各模块之间的 interface / contract（输入输出 types），再填充实现。
  - 上层依赖 interface，而不是具体 struct，便于替换实现和测试。
- **State & types**：
  - Puzzle 相关状态（例如 quadrant, piece, hub, central question, AI suggestion）都要有明确的 Go struct / enum-like 常量。
  - 禁止随意使用 `map[string]interface{}` 作为长期结构；仅用于临时解析场景。
- **配置 & 环境（config / env）**：
  - 所有可变参数（model name, temperature, endpoint, feature flags）从 config 来，不写死在逻辑里。
  - 为不同环境（dev / staging / prod）预留配置扩展点。

---

## 4. AI Flows & Prompt Design

- 将 AI 视为一个**独立 subsystem**：
  - `ai/` 中定义清晰的调用流程：输入（context, user answers, board state）→ prompt 构造 → 模型调用 → 输出解析。
  - 每条 AI 流程，都有对应的 Go 函数和数据结构，而不是散落在 handlers。
- **Prompt as code + docs**：
  - 核心 prompt 写在可版本化的位置（例如 `ai/prompts/*.tmpl`），并在代码中引用。
  - 在 `docs/AI-FLOWS.md` 中记录：
    - 主要 AI 调用路径（例如：生成 puzzle follow-up 问题、聚合 puzzle pieces）。
    - 每条路径的输入字段、输出预期，以及失败策略（fallback）。
- 错误处理（error handling）清晰：
  - 区分：模型失败 / 超时 / 无法解析输出 / 业务逻辑拒绝。
  - 前端看到的是明确的状态（例如 “AI 暂时不可用”），而不是裸 error string。

---

## 5. Development & Merging

- **Vertical slices，但保持完整骨架**：
  - 每次实现时，目标是打一条贯穿的「vertical slice」：UI → API → service → store / ai。
  - 即使只实现最小功能，也要按完整架构分层，避免「临时绕路」变成长期债务。
- **清晰的改动**：
  - 每个 branch / PR 针对一个明确主题（例如 “add puzzle session state model”）。
  - 避免单 PR 同时改大量不相关文件。
- **解决冲突时**：
  - 优先保持 architecture 一致，不重复逻辑。
  - 如发现结构不统一，允许做小范围重构，但要在 PR 描述里写明。

---


## 7. Key Guidelines (Short)

1. **Go idiomatic**：遵循 Go best practices 和标准库优先原则。
2. **Architecture-first**：先定模块边界和接口，再写实现。任何「临时写法」都要尽快被纳入正式结构。
3. **Test critical paths**：为核心逻辑（puzzle session state, AI pipeline）写 table-driven tests。
4. **Document decisions**：复杂逻辑、重要设计决策和 AI 行为，要在 `docs/` 有简洁说明，方便后续 agent 理解和扩展。

