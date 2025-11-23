
## 1. Experience Overview

Puzzle’s **Home Canvas** is a spatial board where designers drop fragments (notes, images, screenshots) and see **AI-suggested puzzle cards** that help them reason about a specific direction (lever).

* The **canvas** is where fragments live and get grouped.
* The **lever** is the “topic / direction seed”.
* The **puzzle deck** at the bottom shows Nintendo-style cards, each card = *one puzzle about the currently selected lever*.

Levers are the **content focus for puzzles**: each puzzle card is literally “questions & guidance about this lever”.

---

## 2. Visual Style & Layout

### 2.1 Overall look

* **Mood:** clean, playful, slightly retro—think *Nintendo cartridge + modern product design*.
* **Background:** soft off-white or light grey with a faint dot grid (like a drafting board).
* **Typography:** bold, condensed title font for card labels; neutral sans-serif for body text.
* **Color:** limited but vivid palette; each lever/puzzle can have an accent color; use gentle gradients rather than harsh neon.

### 2.2 Canvas board (fragments space)

Based on your lo-fi but upgraded to high-fi:

* Large **2.5D board** rendered with three.js:

  * Orthographic camera for a flat design-tool feel.
  * Subtle parallax + shadows to give depth.
* Elements:

  * **Project Title & Aim** pinned at top-left.
  * **Fragments** as floating tiles (images, text chips, links):

    * Slight depth, soft shadow.
    * Small colored pip on each fragment indicating which lever it’s related to (or grey if unassigned).
* Interactions:

  * Pan, zoom, drag-to-reposition fragments.
  * Multi-select via marquee.
  * Hover tooltips with full fragment text.

### 2.3 Retro Nintendo puzzle deck (bottom)

* **Placement:** anchored along the **bottom edge** of the canvas, always visible.
* **Perspective:** cards are rotated so the **thin top edge is facing towards the viewer**, like a row of NES / SNES cartridges slightly leaned back.
* **Card design:**

  * Rounded rectangles with a bevel, subtle noise/texture.
  * Front face shows:

    * Top strip: LEVER NAME (e.g., “Awakening Blob”).
    * Main label: PUZZLE TITLE (e.g., “Audience & Use Context”).
    * Tiny icon for puzzle type (clarify, diverge, converge, etc.).
* **Behavior:**

  * Deck is **contextual**:

    * When no lever selected → shows “All puzzles” sorted by relevance.
    * When a lever is selected → deck updates to show only puzzles for that lever.
  * Scroll horizontally to browse cards; active card pops up slightly.
  * Clicking a card transitions into the detailed Puzzle view (separate screen / overlay).

---

## 3. Core System Objects

Keep the model tight; everything on the canvas is one of these:

1. **Project**

   * `project_id`, `title`
   * `aim_text`, `aim_embedding`

2. **Fragment**

   * `fragment_id`, `type` (text/image/link)
   * `content` (text or URL)
   * `embedding`
   * `position` (x, y on canvas)
   * `lever_id` (nullable)
   * Interaction stats: created time, last edited, hover/drag counts.

3. **Lever** (direction seed)

   * `lever_id`
   * `title` (user-editable)
   * `summary`
   * `color` (for pips & deck accent)
   * `fragment_ids[]`
   * `status` (draft / in-focus / anchored)

4. **PuzzleCard**

   * `puzzle_id`
   * `lever_id` (what this puzzle is about)
   * `title`
   * `short_prompt`
   * `status` (suggested / in-progress / completed)
   * `confidence` and `novelty` scores (from agent)
   * Links to generated content (questions, templates) used in the detailed puzzle screen.

5. **DirectionSummary** (output of completed puzzles)

   * `direction_id`
   * `lever_id`
   * `direction_sentence`
   * `supporting_reasons[]`
   * `evidence_fragment_ids[]`
   * Used to inform future puzzle suggestions and to ground the designer at the end.

---

## 4. Context Storage & Agent-Triggered Clustering

### 4.1 Storage

* **Vector store** (e.g., pgvector / Pinecone):

  * Embeddings for aim, fragments, levers, direction summaries.
* **Relational / graph DB**:

  * Projects, fragments, levers, puzzle cards, and their relations.
* **Event log**:

  * Streams of interactions (created fragment, moved fragment, selected lever, opened puzzle).

### 4.2 Agent behavior (Google AI SDK + FastAPI)

Backend stack:

* **FastAPI** service (Python) as the single backend:

  * REST endpoints:

    * `POST /embed` (create fragment/lever embeddings)
    * `POST /cluster` (recompute clusters & candidate levers)
    * `POST /suggest-puzzles` (generate puzzle cards for a lever)
    * `POST /summarize-direction` (turn puzzle outputs into DirectionSummary)
  * Manages DB + vector store.

* **Agent logic** implemented with **Google AI SDK**:

  * **Embedding / semantic layer:** call embedding models for fragments & aim.
  * **Clustering agent:**

    * Periodically or on trigger (e.g., N new fragments) fetch all fragment embeddings for project.
    * Run simple clustering (e.g., k-means / HDBSCAN) server-side.
    * Promote stable, aim-relevant clusters to **lever suggestions**.
  * **Puzzle generator agent:**

    * Input: lever summary + associated fragments + current directions.
    * Output: 3–6 puzzle definitions (title + short prompt + type).
  * **Direction summarizer agent:**

    * After a puzzle session, condense responses into a DirectionSummary linked to lever & fragments.

Triggers:

* Create/update lever suggestions when:

  * Fragment count crosses thresholds,
  * User slows down (no new fragments for N seconds),
  * User explicitly clicks “Suggest directions”.

* Create/update puzzle cards:

  * When a new lever is confirmed.
  * When previous puzzles for that lever are completed (agent can suggest the “next step” puzzle).

---

## 5. Implementation Outline

### 5.1 Canvas + cards

* Use React + three.js (or react-three-fiber) for structure.
* **Scene:**

  * `CanvasPlane` for the board (large plane with dot-grid texture).
  * `FragmentTiles` as flat boxes attached to plane coordinates.
  * `DeckRail` at fixed screen-space position (anchor cards to camera).
* **Interactions:**

  * Raycasting for selecting fragments & cards.
  * OrbitControls limited to pan/zoom, no full 3D orbit (keep it tool-like).
  * Smooth easing for card hover/selection (scale up, bring closer).

### 5.2 State management

* Use a global store (Zustand/Redux) to hold:

  * `currentProjectId`
  * `fragments`, `levers`, `puzzles`, `directions`
  * `selectedLeverId`, `selectedFragmentIds`, `selectedPuzzleId`
* On important actions (add fragment, re-tag lever, select lever), call FastAPI endpoints to:

  * Persist data,
  * Optionally trigger clustering or puzzle generation in the background and update UI when results arrive.

---

