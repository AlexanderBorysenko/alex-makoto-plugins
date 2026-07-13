## Routing rules

Match the user's intent to a plugin BEFORE improvising with raw tools. These plugins are the primary workflow surface for this user.

**Triggers → plugin:**
- "research", "investigate", "compare options", "how does X work (deep)" → **researcher** (`/research`). It triages complexity (L1/L2/L3) and routes tools itself — do not hand-roll web searches for non-trivial questions.
- "explain the architecture", "map the code", "why is this structured like this", debugging unfamiliar code → **architect-goggles** (`/explain`, arch-map/flow-trace skills).
- "product view", "user journey", "capability map", demo/presentation of flows → **product-designer-goggles** (`/product`).
- "run it", "verify it works", "reproduce the bug", tests/builds/browser flows, evidence for a claim → **project-executor** (execute skill). Prefer it over ad-hoc Bash app-driving.
- starting/resuming/switching/wrapping up work, "where did we leave off", session memory → **tasks-manager** (`/task-start`, `/task-new`, `/task-wrap-up`).
- "work on X in parallel", isolated branch, agent will mutate tracked files, long build blocking main tree → **worktrees** (`/wt-new`, `/wt-list`, `/wt-cleanup`). Its protocol governs native EnterWorktree/isolation too.
- "audit this session", "what went wrong", "improve the plugins", post-work reflection → **observer** (`/observe`). Also offered at tasks-manager wrap-up.

**Handoffs (hub-and-spoke):**
- **tasks-manager is the hub.** Other plugins own their domain memory; tasks-manager owns task journals + the cross-plugin document index. Never copy spoke documents into journals — link them via the mem-index.
- researcher writes findings under a task slug → index them in tasks-manager so future sessions can recall.
- architect-goggles / product-designer-goggles maps feed project-executor: map first, then execute/verify against the map (screenshots for product journeys come from project-executor).
- Multi-plugin work: open/resume a tasks-manager journal first, wrap up last.

**Precedence:**
- Process skills (brainstorming, systematic-debugging, TDD) still come first; these plugins are domain surfaces invoked within that process.
- If a plugin's own SessionStart context already gave specific instructions (tasks-manager startup ritual, researcher memory), those specifics win over this summary.
- When no trigger matches, work normally — do not force a plugin onto a trivial task.

## Plugin readiness protocol (applies to ALL plugins above)

These plugins are the CORE workflow surface for this user. Do not avoid them because their on-disk infrastructure or dependencies are missing — treat that as a signal to initialise, not to bypass.

**Universal rules:**

1. **Auto-init on first use.** When a plugin's skill is invoked and its own on-disk state is missing or empty (per each plugin's SessionStart hook output), the skill MUST auto-run its init procedure BEFORE doing anything else. Init procedures across the suite are idempotent, reversible, and take under a second (dir + template files, no API cost). Names: /exec-mem init (project-executor), /research-setup (researcher), tasks-manager init template (tasks-manager). This is NOT optional.
2. **Hard-block on missing dependency plugins.** If a plugin depends on another plugin (researcher → graphify graph + serena; architect-goggles → researcher; product-designer-goggles → researcher; project-executor → tasks-manager for handoff) and the dependency is unusable (MCP not installed, graph missing with no copy source, dep plugin not active), STOP and surface options — do NOT silently substitute raw grep/curl/Bash for the missing plugin. Options offered must always include "waive for this question" so the user can proceed at their own risk in one line.
3. **Main-thread routing gate.** Before the FIRST raw tool call in an execute-shaped or research-shaped intent, main thread MUST consult each plugin's SessionStart output and route to the plugin (auto-init if state is missing) instead of hand-rolling Bash/PowerShell/Docker/grep. Silently bypassing a plugin because its memory dir does not exist is a bug, not a workaround.
4. **State-change transparency.** When a plugin auto-inits, print ONE line naming the action ("initialising project-executor memory at .claude-memory/executions/ — idempotent, <1s"). Do not bury the state change inside a chain of raw tool calls.

**Failure mode this protocol prevents (seen 2026-07-13):** main thread noticed `.claude-memory/executions/` missing for project-executor, went ahead with 40 minutes of raw Bash/PowerShell/Docker, and only invoked /execute after the user explicitly demanded plugin init. Auto-init + hard-block eliminates that failure mode.
