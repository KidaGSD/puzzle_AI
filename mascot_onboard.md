# AI Mascot - User-Facing Instructions

> **设计原则**: 极简、即时、不打断用户流程

---

## Onboarding Flow (首次使用)

### Step 1: Welcome Bubble (3秒后自动消失)
```
"欢迎！拖拽彩色方块到中心问题周围 ✨"
```

### Step 2: First Drag Hint (用户首次拖拽时)
```
"深色 = 核心想法 | 浅色 = 探索方向"
```

### Step 3: Completion Hint (放置3个pieces后)
```
"继续添加，或点击 'End Puzzle' 生成总结"
```

---

## Contextual Hints (情境提示)

| 场景 | 提示 | 显示时机 |
|------|------|----------|
| Pool 补充中 | "正在生成更多想法..." | isReplenishing |
| 长时间无操作 (30s) | "试试拖拽一个方块?" | idle timeout |
| 删除 piece | "删除了？没关系，继续探索" | on delete (fade 2s) |
| 完成 puzzle | "🎉 总结已生成" | summary popup 出现时 |

---

## Mascot Panel (点击Mascot后)

### Minimal Proposal Display
```
┌─────────────────────────────────────┐
│  🧩 CLARIFY                         │
│                                     │
│  "How should calm feel modern?"     │  ← 问题 (≤8 words)
│                                     │
│  基于你的 fragments 生成             │  ← 简短说明 (≤15 字)
│                                     │
│  [ 开始 Puzzle ]                    │
└─────────────────────────────────────┘
```

### 不显示的内容
- ❌ primaryModes 列表 (太技术化)
- ❌ 详细 reasoning (太长)
- ❌ fragment 引用 ID (无意义)

---

## Voice & Tone 指南

| 原则 | 示例 |
|------|------|
| **简短** | "拖拽开始" ✓ vs "请将方块拖拽到..." ✗ |
| **行动导向** | "试试这个" ✓ vs "你可以考虑..." ✗ |
| **鼓励性** | "不错的选择！" ✓ vs "你选择了..." ✗ |
| **无术语** | "想法" ✓ vs "piece/fragment" ✗ |

---

## Animation Guidelines

```typescript
// Bubble 出现
initial={{ opacity: 0, scale: 0.9, y: 10 }}
animate={{ opacity: 1, scale: 1, y: 0 }}
transition={{ duration: 0.2 }}

// Bubble 消失 (自动)
exit={{ opacity: 0, y: -5 }}
transition={{ duration: 0.15 }}

// Mascot idle 动画
@keyframes float {
  0%, 100% { transform: translateY(0) }
  50% { transform: translateY(-6px) }
}
// duration: 4s, ease-in-out, infinite
```

---

## Error States

| 错误类型 | Mascot 响应 |
|----------|-------------|
| 网络错误 | "连接中断，稍后重试" (带重试按钮) |
| 生成失败 | "生成失败，试试重新开始？" |
| 无 fragments | "先添加一些想法到画布吧" |

---

## Implementation Notes

```typescript
// MascotButton.tsx - Bubble 配置
const BUBBLE_CONFIG = {
  autoHideDelay: 5000,      // 5秒后自动隐藏
  maxTextLength: 30,        // 最多30个字符
  showOnIdle: true,         // 无操作时显示
  idleThreshold: 30000,     // 30秒无操作
};

// MascotPanel.tsx - Proposal 显示
const formatProposal = (proposal: MascotProposal) => ({
  question: proposal.centralQuestion,  // 直接显示
  description: proposal.rationale.slice(0, 50),  // 截断
  puzzleType: proposal.puzzleType,
  // 不传递 primaryModes
});
```

---

**更新时间**: 2025-12-07
