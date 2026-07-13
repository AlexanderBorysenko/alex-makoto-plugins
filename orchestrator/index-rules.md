## Routing rules

Match the user's intent to a plugin BEFORE improvising with raw tools. These plugins are the primary workflow surface for this user.

**Triggers → plugin:**
- "research", "investigate", "compare options", "how does X work (deep)" → **researcher** (`/research`). It triages complexity (L1/L2/L3) and routes tools itself — do not hand-roll web searches for non-trivial questions.
- "explain the architecture", "map the code", "why is this structured like this", debugging unfamiliar code → **architect-goggles** (`/explain`, arch-map/flow-trace skills).
- "product view", "user journey", "capability map", demo/presentation of flows → **product-designer-goggles** (`/product`).
- "run it", "verify it works", "reproduce the bug", tests/builds/browser flows, evidence for a claim → **project-executor** (execute skill). Prefer it over ad-hoc Bash app-driving.
- starting/resuming/switching/wrapping up work, "where did we leave off", session memory → **tasks-manager** (`/task-start`, `/task-new`, `/task-wrap-up`).
- "work on X in parallel", isolated branch, agent will mutate tracked files, long build blocking main tree → **worktrees** (`/wt-new`, `/wt-list`, `/wt-cleanup`). Its protocol governs native EnterWorktree/isolation too.

**Handoffs (hub-and-spoke):**
- **tasks-manager is the hub.** Other plugins own their domain memory; tasks-manager owns task journals + the cross-plugin document index. Never copy spoke documents into journals — link them via the mem-index.
- researcher writes findings under a task slug → index them in tasks-manager so future sessions can recall.
- architect-goggles / product-designer-goggles maps feed project-executor: map first, then execute/verify against the map (screenshots for product journeys come from project-executor).
- Multi-plugin work: open/resume a tasks-manager journal first, wrap up last.

**Precedence:**
- Process skills (brainstorming, systematic-debugging, TDD) still come first; these plugins are domain surfaces invoked within that process.
- If a plugin's own SessionStart context already gave specific instructions (tasks-manager startup ritual, researcher memory), those specifics win over this summary.
- When no trigger matches, work normally — do not force a plugin onto a trivial task.
