# **0\. Scope & Principles**

**Goal**

Define the AI layer for Puzzle AI:

* How **agents** collaborate under an **Orchestrator**.

* How they **read & write** the local JSON context store.

* How user **puzzle actions (place / edit / discard / connect)** feed back into AI behavior.

**Principles**

1. **Context-adaptive, not template-locked**  
    All reasoning derives from the current **Process Aim \+ fragments \+ puzzle history**. No hard-coded domain (matcha, sci-fi…).

2. **Human makes the moves, AI shapes the board**  
    AI proposes puzzles, questions, and summaries; users choose which to keep, edit, or throw away.

3. **Simple, local, explainable adaptation**  
    User feedback is logged and folded back as **prompt hints**, not model retraining.

---

# **1\. Shared Context & Events**

## **1.1 JSON Context Store (project-level)**

For each project we maintain a single JSON document (in local storage / IndexedDB / file):

type ProjectStore \= {  
  project: {  
    id: string  
    title: string  
    processAim: string  
  }

  fragments: Fragment\[\]  
  clusters: Cluster\[\]

  puzzles: Puzzle\[\]  
  anchors: Anchor\[\]  
  puzzlePieces: PuzzlePiece\[\]  
  puzzleSummaries: PuzzleSummary\[\]

  preferenceProfile: UserPreferenceProfile  
  pieceEvents: PieceEvent\[\]

  agentState: {  
    mascot: {  
      hasShownOnboarding: boolean  
      lastReflectionAt: number  
      reflectionsDisabled: boolean  
    }  
  }  
}

Core domain types come from the system doc: `Fragment`, `Puzzle`, `PuzzlePiece`, `Anchor` 等。

**Only these fields are relevant to AI:**

* `project.processAim`

* `fragments[].content | summary | tags | labels`

* `clusters[]` (fragment groupings \+ theme)

* `puzzles[]` (id, centralQuestion, createdFrom, projectId)

* `anchors[]` (id, puzzleId, type, text)

* `puzzlePieces[]` (mode, category, text, userAnnotation, status, fragmentLinks, source)

* `puzzleSummaries[]` (directionStatement, reasons, openQuestions)

* `preferenceProfile` (per-mode, per-category stats)

* `agentState.mascot` (onboarding, reflection timing)

## **1.2 Events**

Front-end emits **UI events** that the Orchestrator subscribes to:

type UIEventType \=  
  | "FRAGMENT\_ADDED"  
  | "FRAGMENT\_UPDATED"  
  | "FRAGMENT\_DELETED"  
  | "MASCOT\_CLICKED"  
  | "PUZZLE\_FINISH\_CLICKED"  
  | "PIECE\_CREATED"  
  | "PIECE\_PLACED"  
  | "PIECE\_EDITED"  
  | "PIECE\_DELETED"  
  | "PIECE\_ATTACHED\_TO\_ANCHOR"  
  | "PIECE\_DETACHED\_FROM\_ANCHOR"

Each event has:

type UIEvent \= {  
  type: UIEventType  
  payload: any   // depends on event  
  timestamp: number  
}

**Piece events** are also logged into `pieceEvents[]` and aggregated into `preferenceProfile`.

---

# **2\. Architectural Overview**

## **2.1 Non-LLM: Orchestrator**

A pure app layer that:

* Listens to `UIEvent`s and timers.

* Decides **which Agent (LLM) to call** with which **context slice**.

* Validates outputs against schemas.

* Applies JSON mutations to `ProjectStore`.

* Maintains `preferenceProfile` from piece events.

Think: “traffic controller \+ reducer”.

## **2.2 LLM Agents**

All LLM calls go through one underlying model (Gemini 3 via Google AI SDK) with different **role prompts**:

1. **Fragment & Context Agent**

   * Summarize and tag fragments; build `clusters`.

2. **Mascot Agent**

   * Teach basics, launch puzzles (self-raised & suggested), reflect patterns.

3. **Puzzle Designer Agent**

   * Turn a central question into a Puzzle: anchors \+ seed pieces, and later, summaries.

4. **Quadrant Piece Agent**

   * Generate Clarify / Expand / Refine / Connect pieces for a given quadrant.

5. **Aim and Ideation Agent**

   * Cross-puzzle synthesis on the Home Canvas (v2+; can be same as Designer/Summarizer with a different mode).

---

# **3\. Agent Contracts**

For each agent: **role, triggers, context, obligations, output, and store updates**.

---

## **3.1 Fragment & Context Agent**

### **Role**

“Summarize and tag fragments on the Home Canvas, and group them into loose clusters for later reasoning. Never invent content that is not present; only compress and name patterns.”

### **Triggered when**

* `FRAGMENT_ADDED` / `FRAGMENT_UPDATED` bursts (debounced).

* Optionally after a puzzle is finished (to refresh cluster themes).

### **Context the Orchestrator passes**

{  
  processAim: string  
  fragments: Array\<{  
    id: string  
    type: "text" | "image" | "link" | "other"  
    content: any   // full text or image caption, url, etc.  
    existingSummary?: string  
    existingTags?: string\[\]  
  }\>  
  existingClusters: Cluster\[\] // theme \+ fragmentIds  
}

### **Obligations (prompt essentials)**

* Return **short summaries** (1–2 lines) for given fragments.

* Suggest **2–5 tags** per fragment (1–3 tokens each).

* Optionally propose or update **clusters**:

  * cluster \= `{ id, fragmentIds, theme }`

* Do **not**:

  * modify `processAim`,

  * judge quality, only describe.

### **Output shape**

{  
  fragments: Array\<{  
    id: string  
    summary: string  
    tags: string\[\]  
  }\>  
  clusters?: Array\<{  
    id: string  
    fragmentIds: string\[\]  
    theme: string  
  }\>  
}

### **Store updates**

Orchestrator applies:

* `fragments[i].summary = summary`

* `fragments[i].tags = tags`

* `clusters` replaced or merged by id.

---

## **3.2 Mascot Agent**

### **Role**

“Be the AI face of the system: guide new users, rephrase their questions into central puzzles, suggest new puzzles from context, and occasionally reflect patterns. Never decide UI on your own—only propose.”

### **Modes**

1. **Guide** – mostly static copy, no LLM (not detailed here).

2. **Self-Raised Puzzle**

3. **AI-Suggested Puzzle**

4. **Reflection** (optional, low frequency)

---

### **3.2.1 Self-Raised Puzzle mode**

**Trigger**

* `MASCOT_CLICKED` with `action:"start_from_my_question"` and user text.

**Context**

{  
  processAim: string  
  userQuestion: string  
  nearbyFragments: Array\<{ summary: string; tags: string\[\] }\>  
  puzzleSummaries: Array\<{ id: string; title: string; oneLine: string }\>  
  // optional bias hints  
  preferenceHints?: string // small natural-language summary from preferenceProfile  
}

**Obligations**

* Interpret `userQuestion` in context of `processAim` and `nearbyFragments`.

* Produce exactly one **central puzzle question**.

* Suggest 1–2 **primaryModes** to explore first.

* Briefly state **why this puzzle now**.

**Output**

type MascotPuzzleProposal \= {  
  centralQuestion: string  
  primaryModes: DesignMode\[\]      // 1–2 items  
  rationale: string               // 1–2 sentences  
}

**Next step**

* Orchestrator passes this to **Puzzle Designer Agent**.

---

### **3.2.2 AI-Suggested Puzzle mode**

**Trigger**

* `MASCOT_CLICKED` with `action:"suggest_puzzle"`.

**Context**

{  
  processAim: string  
  clusters: Array\<{ id: string; theme: string; fragmentCount: number }\>  
  puzzleSummaries: Array\<{ id: string; title: string; oneLine: string }\>  
  preferenceHints?: string  
}

**Obligations**

* Scan for under-explored themes or quadrants.

* Either:

  * `shouldSuggest:false` (no obvious gap), or

  * propose one puzzle as in self-raised mode.

**Output**

{  
  shouldSuggest: boolean  
  centralQuestion?: string  
  primaryModes?: DesignMode\[\]  
  rationale?: string  
}

---

### **3.2.3 Reflection mode**

**Trigger**

* Timer or event when:

  * certain tags dominate puzzleSummaries,

  * strong skew in `preferenceProfile` (e.g., always discarding a category).

**Context**

{  
  processAim: string  
  puzzleSummaries: Array\<{ title: string; oneLine: string; tags?: string\[\] }\>  
  preferenceProfile: UserPreferenceProfile  
}

**Obligations**

* Output at most **one short reflection sentence** about emerging patterns.

* No instructions to UI; address designer directly.

---

## **3.3 Puzzle Designer Agent**

### **Role**

“Design a single Puzzle Session: refine the central question, propose anchors, and seed a few starting pieces. Later, summarize a finished puzzle into a direction \+ reasons.”

We treat it as having two **task types**: `"design"` and `"summarize"`.

---

### **3.3.1 Design task**

**Trigger**

* After Mascot puzzle proposal (self-raised or suggested).

**Context**

{  
  task: "design"  
  processAim: string  
  proposedCentralQuestion: string  
  primaryModes: DesignMode\[\]  
  rationaleFromMascot: string

  relatedClusters: Array\<{ theme: string; fragmentSummaries: string\[\] }\>  
  relatedPuzzleSummaries: Array\<{ title: string; oneLine: string }\>  
}

**Obligations**

* Optionally rephrase centralQuestion to be:

  * short, concrete, still faithful.

* Draft anchors:

  * `starting`: 1–2 sentences about underlying “why”.

  * `solution`: empty string or a tentative 1–2 sentences.

* For each `primaryMode`, propose 0–2 seed pieces:

  * choose `category` (Clarify/Expand/Refine) appropriate to context.

  * keep `text` short and open-ended.

* Avoid locking to specific aesthetics; refer to “this project” or “this brand” etc.

**Output**

{  
  centralQuestion: string  
  anchors: {  
    starting: string  
    solution: string  
  }  
  seedPieces: Array\<{  
    mode: DesignMode  
    category: PuzzlePieceCategory  
    text: string  
  }\>  
}

**Store updates**

Orchestrator:

* creates `Puzzle` record.

* creates two `Anchor` records.

* inserts `seedPieces` into `puzzlePieces[]` with:

  * `status:"PLACED"` or `"SUGGESTED"`,

  * `source:"AI"`.

---

### **3.3.2 Summarize task**

**Trigger**

* `PUZZLE_FINISH_CLICKED` and puzzle has at least:

  * 1 anchor with non-empty text,

  * 1 piece attached.

**Context**

{  
  task: "summarize"  
  processAim: string  
  puzzle: {  
    id: string  
    centralQuestion: string  
  }  
  anchors: Array\<{ type: AnchorType; text: string }\>  
  pieces: Array\<{  
    id: string  
    mode: DesignMode  
    category: PuzzlePieceCategory  
    text: string  
    userAnnotation?: string  
    status: PieceStatus  
    attachedAnchorTypes: AnchorType\[\]  
  }\>  
}

**Obligations**

* Produce:

  * `directionStatement` – 1–2 sentences describing the current bet/answer.

  * `reasons` – 3–5 bullets synthesizing key anchors \+ pieces.

  * `openQuestions` – 0–3 bullets of unresolved tensions.

* Use the designer’s own wording when possible.

* Do **not** introduce new directions.

**Output**

type PuzzleSummary \= {  
  puzzleId: string  
  directionStatement: string  
  reasons: string\[\]  
  openQuestions?: string\[\]  
}

**Store updates**

* Append `PuzzleSummary` to `puzzleSummaries[]`.

* UI: create a Summary Card on Canvas linked to this puzzle.

---

## **3.4 Quadrant Piece Agent**

### **Role**

“Given a quadrant (FORM/MOTION/EXPRESSION/FUNCTION) and a category (Clarify/Expand/Refine/Connect), propose 1–3 candidate puzzle pieces that help the designer move forward.”

### **Trigger**

* User drags from a quadrant hub and chooses “Ask AI”.

* Orchestrator decides to seed suggestions (e.g., quadrant is empty).

### **Context**

{  
  processAim: string  
  mode: DesignMode  
  category: PuzzlePieceCategory | "CONNECT"  
  puzzle: {  
    id: string  
    centralQuestion: string  
  }  
  anchors: Array\<{ type: AnchorType; text: string }\>  
  existingPiecesForMode: Array\<{  
    category: PuzzlePieceCategory | "CONNECT"  
    text: string  
    userAnnotation?: string  
    status: PieceStatus  
  }\>  
  preferenceStatsForModeCategory: PreferenceStats // from preferenceProfile  
}

### **Obligations**

* Respect **mode semantics**:

  * FORM → visuals/structure

  * MOTION → dynamics/behaviour

  * EXPRESSION → emotion/tone

  * FUNCTION → goals/constraints/audience

* Respect **category semantics**:

  * Clarify → sharpen, make explicit.

  * Expand → new angles/options.

  * Refine → choose/prioritize/polish.

  * Connect → relate this mode to another mode or to anchors.

* Use `preferenceStats` as **soft hints**:

  * high `discarded` → fewer, more concrete prompts;

  * high `edited` → shorter, leave room for user phrasing.

* Avoid duplicating `existingPiecesForMode`.

### **Output**

{  
  pieces: Array\<{  
    mode: DesignMode  
    category: PuzzlePieceCategory | "CONNECT"  
    text: string  
    internalNote?: string  // for orchestrator debugging or future logic  
  }\>  
}

**Store updates**

Orchestrator:

* Inserts each candidate into `puzzlePieces[]` as:

  * `status:"SUGGESTED"`,

  * `source:"AI"`.

* Front-end shows them near the relevant hub for the user to place or discard.

---

## **3.5 Aim and ideation Agent ( / v2+)**

For completeness, a future agent to:

* Compare multiple `puzzleSummaries` and suggest:

  * higher-level themes,

  * conflicts,

  * or a “final direction”.

* Context: `processAim`, set of selected puzzleSummaries.

Implementation: can reuse Puzzle Designer Agent with a `"connect"` task type.

---

# **4\. Feedback & Adaptation Logic**

We keep adaptation **simple & local**.

## **4.1 PieceStatus & PieceEvents**

Every `PuzzlePiece` has:

type PieceStatus \= "SUGGESTED" | "PLACED" | "EDITED" | "DISCARDED" | "CONNECTED"

UI events map to these updates:

* `PIECE_CREATED` (AI) → status `SUGGESTED`

* `PIECE_PLACED` → `PLACED`

* `PIECE_EDITED` → `EDITED`

* `PIECE_DELETED` (for suggested/placed) → `DISCARDED`

* `PIECE_ATTACHED_TO_ANCHOR` → `CONNECTED`

* `PIECE_DETACHED_FROM_ANCHOR` (optional) → may revert status if needed.

For each event we also append:

type PieceEventType \=  
  | "CREATE\_SUGGESTED"  
  | "CREATE\_USER"  
  | "PLACE"  
  | "EDIT\_TEXT"  
  | "DELETE"  
  | "ATTACH\_TO\_ANCHOR"  
  | "DETACH\_FROM\_ANCHOR"

type PieceEvent \= {  
  pieceId: string  
  type: PieceEventType  
  timestamp: number  
}

These are stored in `pieceEvents[]` and periodically aggregated.

## **4.2 PreferenceProfile**

We maintain, per `(mode, category)`:

type PreferenceStats \= {  
  suggested: number  
  placed: number  
  edited: number  
  discarded: number  
  connected: number  
}

type UserPreferenceProfile \= Record\<string /\* JSON.stringify({mode, category}) \*/, PreferenceStats\>

Orchestrator updates:

* on suggestion → `suggested++`

* on place → `placed++`

* on edit → `edited++`

* on delete soon after suggestion → `discarded++`

* on attach to anchor → `connected++`

**No optimization / weighting** in v1; just counts.

## **4.3 Using Preferences in Prompts**

* **Quadrant Piece Agent** gets a short natural-language hint derived from stats:

  * e.g. “User often discards long EXPRESSION-EXPAND prompts; keep suggestions short and concrete.”

* **Puzzle Designer Agent** uses hints to:

  * seed categories the user tends to connect with (high `connected`),

  * sometimes introduce a contrasting category to avoid tunnel vision.

* **Mascot Reflection** may mention patterns:

  * e.g. “You keep refining EXPRESSION but rarely explore MOTION; want to try a motion puzzle next?”

All of this stays within the project’s local JSON; no global profile.

---

# **5\. Reasoning → Action Flows (Concise)**

Finally, we tie agents, context, and actions in a few core flows.

## **Flow A: Fragments → Context**

1. UI: user adds/edits fragments.

2. Orchestrator:

   * writes raw fragment(s) to `fragments[]`.

   * debounced call to **Fragment & Context Agent** with new fragments \+ processAim \+ existingClusters.

3. Agent returns summaries/tags/clusters.

4. Orchestrator updates `fragments[].summary/tags` and `clusters[]`.

**Result**: Canvas remains user-driven, but AI now has a semantic index of the material.

---

## **Flow B: Self-Raised Puzzle**

1. UI: `MASCOT_CLICKED(start_from_my_question, userQuestion)`.

2. Orchestrator composes context (processAim, nearby fragment summaries, puzzleSummaries, preferenceHints) → calls **Mascot Agent (self-raised)**.

3. Mascot outputs `centralQuestion + primaryModes + rationale`.

4. Orchestrator calls **Puzzle Designer Agent (design)** with that \+ related clusters/puzzles.

5. Designer returns refined centralQuestion, anchors, seedPieces.

6. Orchestrator:

   * creates `Puzzle`, `Anchors`, seed `PuzzlePieces`.

   * tells UI to open Puzzle Session.

---

## **Flow C: AI-Suggested Puzzle**

Same as Flow B, except step 2 uses **Mascot (suggested)** and may short-circuit if `shouldSuggest:false`.

---

## **Flow D: In-Puzzle Assistance**

1. UI: user drags from quadrant hub → “Ask AI” (`mode`, `category`).

2. Orchestrator collects context (processAim, puzzle, anchors, existing pieces for mode, `preferenceStatsForModeCategory`).

3. Calls **Quadrant Piece Agent**.

4. Agent returns 1–3 candidate pieces.

5. Orchestrator inserts them into `puzzlePieces[]` as `status:"SUGGESTED"`; UI shows them as draggable.

6. As user **places / edits / deletes / connects** them:

   * Orchestrator updates `puzzlePieces[].status`.

   * Logs `PieceEvent`.

   * Updates `preferenceProfile` counters.

---

## **Flow E: Finish Puzzle → Summary Card**

1. UI: user clicks “Finish puzzle”.

2. Orchestrator collects puzzle snapshot (centralQuestion, anchors, connected pieces).

3. Calls **Puzzle Designer Agent (summarize)**.

4. Agent returns `PuzzleSummary`.

5. Orchestrator:

   * appends to `puzzleSummaries[]`.

   * creates Summary Card on canvas (UI).

   * adds puzzle label to related fragments.

---

## **Flow F: Reflection (optional)**

1. Timer / event: Orchestrator checks if:

   * enough new puzzleSummaries exist,

   * `lastReflectionAt` is old enough,

   * patterns in `preferenceProfile` / tags.

2. If so, builds compact context → calls **Mascot (reflection)**.

3. Agent returns 1–2 sentences.

4. Orchestrator updates `agentState.mascot.lastReflectionAt`, UI shows balloon.

---

This document, together with existing **SystemDocument**, now specifies:

* The **shared state model** (what’s stored).

* The **agent set** and their **prompt obligations** (what each sees & must output).

* The **orchestration and update logic** (how outputs become UI \+ JSON changes).

* The **feedback loop** from user piece actions into future AI suggestions.

This should be everything you need to hand to devs as the authoritative spec for the AI system.
