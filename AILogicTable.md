## AI Logic Table

**How to use this:**

This table explains the reasoning system for how Puzzle will scaffold convergent thinking. Use this table by following the If X…then Y… columns on when and how the AI response system should intervene. Backendwise, Puzzle can respond contextually (ex: If a canvas has 8+ fragments, refine questions automatically surface.  
---

**Operations Definitions(Puzzle category):** 

1. **Clarify/Refine** \= when a user expresses something vague that needs definition (“i want a calming logo” → “What does calming look like \- soft forms, muted colors, or slow movement?” → Puzzle UI?  
2. **Expand** \= when a user is stuck or hasn't explored the idea enough (“if the logo were an object, what would it feel like?”) → Puzzle UI?  
3. **Connect** \= When multiple modes have been filled out, the user needs synthesis (“how does the calming tone influence your form choices?”) → Modal UI? Ability to name their own theme/frame

| Design Mode(Lens for exploring the concept/ part of process) | Operation (The cognitive move for converging an idea) | If X…(condition) | Then Y…(behavior) | AI Anchor Question(Adaptive behavior) | UI Component  (Micro-prompt, panel, dragging, connection lines, notifications) |
| :---- | :---- | :---- | :---- | :---- | :---- |
|  **FORM**What it looks like (shape, structure, silhouette)  | Clarify | If user added visual fragments but hasn’t described shapes or style | Ask clarifying form questions | *“What shapes or silhouettes do you naturally gravitate toward?”* |  |
|  | Clarify | If user uses ambiguous terms like “clean,” “simple,” “cute” | Ask for form-specific interpretation | *“Should the logo feel more organic or geometric?”* |  |
|  | Expand | If user is stuck OR expresses “I don’t know what it looks like yet” | Ask sensory/imaginative expansion | *“If the logo were an object, what would it feel like to touch?”* |  |
|  | Expand | If canvas has mood words but no visual references | Prompt for natural inspirations | *“What natural forms inspire this brand?”* |  |
|  | Refine | If user has many form fragments (≥6) | Ask them to prioritize essentials | *“Which 2–3 visual elements absolutely need to be there?”* |  |
|  | Refine | If contradictions appear in fragments | Ask what to avoid | *“Is there any shape or symbol you want to avoid?”* |  |
|  | Connect | If user completed Expression \+ Form | Ask bridging questions | *“How do the shapes you’re exploring relate to your emotional goals?”* |  |
| **Design Mode** | **Operation** | **If (condition)** | **Then (trigger)** | **AI Question** |  |
|  **MOTION**How it moves or behave (energy, tempo, transitions) | Clarify | If user hasn’t defined pacing/energy | Ask kinetic tone questions | *“Does this brand feel slow and calming, or energetic and uplifting?”* |  |
|  | Clarify | If user adds motion words (“whisk,” “vibe,” “flow”) but not direction | Clarify motion style | *“Should the logo feel stable or dynamic?”* |  |
|  | Expand | If user says “I’m not sure how it moves” | Trigger motion imagination | *“If the brand were animated, how would it move?”* |  |
|  | Expand | If user mentions ritual cues (pour, whisk) | Expand on verbs | *“What verbs describe this café? (pouring, blooming?)”* |  |
|  | Refine | If user has many motion verbs (≥4) | Narrow to strongest | *“Which motion feels most aligned with the matcha ritual?”* |  |
|  | Refine | If user mentions disliked energies | Deprioritize movement | *“Which movement feels least aligned?”* |  |
|  | Connect | If Motion \+ Form are populated | Ask cross-influence | *“How does the energy influence typography or icon choices?”* |  |
| **Design Mode** | **Operation** | **If (condition)** | **Then (trigger)** | **AI Question** |  |
|  **EXPRESSION** What does it feel like (tone, personality, and mood of the concept) | Clarify | If user added mood words but not priorities | Ask for emotional hierarchy | *“What top 3 emotions should someone feel?”* |  |
|  | Clarify | If tone unclear or conflicting | Clarify tone range | *“Is the tone more traditional or modern? Playful or serious?”* |  |
|  | Expand | If no brand persona present | Ask voice/identity questions | *“If this brand had a voice, what would it sound like?”* |  |
|  | Expand | If user references culture or aesthetics | Deepen identity cues | *“What cultural cues do you want to evoke?”* |  |
|  | Refine | If many emotional words (≥5) | Narrow emotional direction | *“Which emotional direction feels most essential?”* |  |
|  | Refine | If user includes contradictory emotions | Identify what to remove | *“What expression contradicts what you want?”* |  |
|  | Connect | If Expression \+ Color/Form present | Ask connection reflection | *“How should your expression influence palette or iconography?”* |  |
| **Design Mode** | **Operation** | **If (condition)** | **Then (trigger)** | **AI Question** |  |
|  **FUNCTION** What does it need to do (jobes to be done, brand purpose, context) | Clarify | If no usage context | Ask placement/function | *“Where will this logo live most often?”* |  |
|  | Clarify | If no target audience noted | Ask audience question | *“Who is the target customer?”* |  |
|  | Expand | If missing design constraints | Ask for limitations | *“Are there print or accessibility constraints?”* |  |
|  | Expand | If brand goals unclear | Ask behavioral purpose | *“What behaviors should this brand encourage?”* |  |
|  | Refine | If many functional notes | Prioritize key job | *“What is the primary job of the logo?”* |  |
|  | Refine | If contradictions in function | Clarify deprioritized needs | *“Which functional needs matter less?”* |  |
|  | Connect | If Function \+ Form co-exist | Prompt connection | *“How do functional needs shape your forms or colors?”* |  |

---

**Proactive AI** \= the ambient intelligence layer where it constantly analyzes what the user is doing but intervenes selectively. This interprets the users’ thinking (sometimes doesnt get it right)

* *At what points will AI always be analyzing the fragments and making sense of it?*  
* *When does AI intervene? At which parts of the process*  
  * Scan for fragment patterns, repeated themes, dominant references (e.g. lots of nature pictures)  
  * Scan for contradictions (e.g. minimalist symbols vs busy shapes)  
  * Scan for missing modes (e.g. “form” mode is filled in, but none in “motion)  
  * Scan for fragment density (early stages \= scattered, middle stage \= large volume, more than 7+ fragments, late stages \= stable clusters and ready for synthesis)  
  * Scan for user struggle (pauses, says “idk”)

