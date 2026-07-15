## Authority ladder — who wins when instructions conflict

Injected once, applies to EVERY turn. When two instruction sources disagree, the higher rung wins — resolve explicitly, never by vibes:

1. **User's latest message** (including an explicit waive/override).
2. **Active skill's protocol** — once a skill is invoked, its numbered steps and gates govern the work until it exits. No other source may reorder, skip, or soften a step.
3. **Routing pulse + this index-rules file** (which skill to invoke, suite-wide protocols).
4. **CLAUDE.md files** (global and project).
5. **Memory entries** — background context; process/workflow memories are subordinate to plugin coverage (see Memory ownership below).
6. **Persona layers (caveman, ponytail, and similar style plugins)** — style ONLY: they compress prose and bias toward minimal code. They NEVER alter, reorder, or skip a protocol step; "be lazy/terse" never justifies dropping an AskUserQuestion gate, an artifact, or a lint. A persona instruction that conflicts with rungs 1-5 loses, silently.

**Failure mode this section prevents (2026-07-15, FN-1334):** bug-detective was invoked, but its INTAKE AskUserQuestion, template case file and case map were all skipped — persona pressure ("don't stall, ship short") and a stale memory outranked the skill protocol because no precedence order existed in context.

## Routing rules

Match the user's intent to a plugin BEFORE improvising with raw tools. These plugins are the primary workflow surface for this user.

**Primary surfaces — non-negotiable, apply on EVERY session:**
1. **Explaining is a goggles job first.** ANY explanation, walkthrough, architecture/design answer, "how/why does X work", bug-diagnosis narrative, or flow description is presented THROUGH a map — **architect-goggles** (PCE: arch-map + flow-trace) for code/architecture, **product-designer-goggles** (PJM: product-map + journey-trace) for user-facing/product behavior. Build the map, hand over the `?path=` viewer link; never answer a non-trivial explanation with prose alone. A single session may build MANY maps — one per scope/question. Do NOT overload one map with unrelated topics; spin up a new map per explanation. **Maps inherit the SESSION LANGUAGE:** every prose/free-text field is written in the language the human is using in this conversation (canonical ids, enums and code-symbol labels stay English) — a Ukrainian session yields Ukrainian-prose maps, never English by default (goggles contract §10/§11).
2. **Finding is a researcher job first.** ANY locate / look-up / trace / compare / "where is X" / "how does Y work (deep)" / investigate (no bug symptom — unknown-cause bugs go to bug-detective) routes to **researcher** (`/research`) as the primary toolset BEFORE any raw grep/glob/web search. researcher owns tool routing (graphify/serena/context-mode/web) and grounding; the goggles delegate their own discovery to it too.

**Triggers → plugin:**
- "research", "investigate" (no bug symptom), "compare options", "how does X work (deep)" → **researcher** (`/research`). It triages complexity (L1/L2/L3) and routes tools itself — do not hand-roll web searches for non-trivial questions.
- symptom/bug with UNKNOWN cause ("it's broken", "users report X", bug ticket without a
  diagnosed root cause) → **bug-detective** (`/investigate`). Known cause → normal fix
  flow. While a case is open, bug-detective's loop supersedes
  superpowers:systematic-debugging.
- "explain the architecture", "map the code", "why is this structured like this", debugging unfamiliar code (cause already known or no investigation open) → **architect-goggles** (`/explain`, arch-map/flow-trace skills).
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
4. **Indexes are per-REPO, not per-worktree.** Inside a git worktree, "graphify/serena missing" almost always means "living at the main repo root". Graphify: copy `graphify-out/` from the main root then `graphify update .` (worktrees W1c). Serena: `activate_project` on the MAIN repo — NEVER run serena onboarding from scratch inside a worktree; that builds a duplicate throwaway index. This rule applies to every session in a worktree regardless of which plugin (if any) was invoked.
5. **State-change transparency.** When a plugin auto-inits, print ONE line naming the action ("initialising project-executor memory at .claude-memory/executions/ — idempotent, <1s"). Do not bury the state change inside a chain of raw tool calls.

**Failure mode this protocol prevents (seen 2026-07-13):** main thread noticed `.claude-memory/executions/` missing for project-executor, went ahead with 40 minutes of raw Bash/PowerShell/Docker, and only invoked /execute after the user explicitly demanded plugin init. Auto-init + hard-block eliminates that failure mode.

## Memory ownership — plugins outrank process memories

Persistent memories (auto-memory, MEMORY.md) describing HOW to work — routing habits, output conventions, workflow recipes — are subordinate to plugin coverage:

- When a plugin now covers a memory's topic, the memory is STALE by definition: follow the plugin, and propose deleting the memory (or trimming it to the project-specific residue the plugin cannot know, with a line linking the plugin as owner).
- Never write a NEW process memory for something a plugin already prescribes — improve the plugin (via observer) instead.
- Domain memories (project facts, gotchas, credentials, architecture notes) are unaffected — plugins do not own domain knowledge.

**Failure mode this section prevents (2026-07-15, FN-1334):** a pre-goggles memory ("explanations → .claude-memory/explainers/*.md with Mermaid") kept steering explain-requests into prose files long after product-designer-goggles owned that surface; three such legacy memories had to be cut in one audit.

## Artifact gates — prose compliance is not compliance

Suite-wide convention: when a skill step's output is a TYPED ARTIFACT, the step is complete ONLY when the artifact exists on disk and passes its validator. Prose describing the artifact, or an ad-hoc file in the wrong place/format, does not count. Bindings:

- **bug-detective**: case file from `templates/case.md` at `.claude-memory/cases/<slug>.md`; case map linted (`node architect-goggles/spec/lint.mjs`); viewer link posted. (Enforced by its §0 phase gate.)
- **architect-goggles / product-designer-goggles**: map passes lint; viewer `?path=` link posted. A Mermaid/prose diagram in an `.md` file is NOT a map deliverable.
- **researcher**: findings persisted to the research store with evidence pointers — an answer without a stored, citable finding is incomplete for L2/L3.
- **project-executor**: evidence report written from captured outputs — a claim without the evidence bundle is incomplete.
- **tasks-manager**: wrap-up = journal updated + spoke docs indexed, not a chat summary.

Track the gates visibly: one todo per pending artifact when a skill runs multi-step. Skipping a gate requires saying so in chat with a reason (mirrors the Authority ladder rung 2).

## Model tiering — mechanical work on small models, reasoning on the session model

Suite-wide convention. Every subagent runs on the LEAST capable model that does its job correctly; the session (main-thread) model is reserved for orchestration and reasoning. Three tiers:

- **T1 — `model: haiku` (deterministic mechanical).** Caller fully specifies the work; the agent exercises no judgment about scope or plan. Run one command + distill fixed-format output, inject/strip tagged log lines, index/extract for a graph, screenshot-distill to a fixed schema. Cheapest tier — use whenever the task is "do exactly this and report".
- **T2 — `model: sonnet` (mechanical + bounded interpretation).** One task that needs local judgment a haiku would get wrong: drive a live UI and judge readiness/anomalies, make precise source edits where a wrong edit corrupts code. Bounded to a single flow; still does not own the plan.
- **T3 — inherit the session model (orchestration + reasoning).** Decides what to spawn, synthesizes subagent evidence, forms hypotheses/verdicts/reports, talks to the user. Main-thread skill work and pipeline-facing orchestrator agents (e.g. project-executor `executor`). Leave `model:` UNSET so it inherits whatever the human is running.

Rules:
1. **Pin the tier in agent frontmatter.** Every `agents/*.md` sets `model:` for T1/T2. A MISSING `model:` means "intentionally T3-inherit" — allowed ONLY for orchestrator-role agents, never as an accident on a mechanical helper.
2. **Never run mechanical work on the session model.** Deterministic bulk work (indexing, extraction, log injection, command running) done on the main thread is a tiering bug: offload it to a T1 subagent — raw-output bytes stay out of main context and the cheap model does the labor.
3. **Never run reasoning on haiku.** Verdicts, synthesis, hypothesis elimination, user-facing reports stay on the session model.
4. **Ceiling escape hatch:** bump a T1 agent to sonnet only on demonstrated quality loss, and say so (e.g. user asks for higher extraction quality). Do not silently upgrade.

**Current bindings:** project-executor — `exec-runner` T1 `haiku`, `exec-browser` T2 `sonnet`, `exec-instrumenter` T2 `sonnet` (source edits carry corruption risk), `executor` T3-inherit. researcher — indexing/extraction subagents T1 `haiku` by default. New subagents anywhere in the suite MUST declare a tier per this ladder.

## ISSUE PROTOCOL — canonical, applies to EVERY bug/defect/architecture-risk conclusion (plugin or not)

This is the suite's single source for defect epistemics. Plugins (researcher, architect-goggles, product-designer-goggles) reference it — do not restate it elsewhere; patch it here.

A code shape that PERMITS a failure is not evidence the failure HAPPENS. Rules:

1. **Two ratings, always**: *shape* (code path exists — cite `file:line`; "confirmed" may only ever describe this axis) and *incidence* (fires in reality — logs, DB rows, support tickets, executor repro, or the honest phrase "incidence: unverified"). Verdict words (BROKEN, bug, fails) are forbidden in any label/title/summary unless incidence is observed — shape-only findings say "permits X" / "no guard against X".
2. **Counterfactual check before reporting**: "if this fired in prod, what traces would exist, and did anyone look?" Absent expected traces = evidence against; unexamined = say so.
3. **Ask, don't assume frequency**: probability comes from real user behavior + deploy context. Unknown action frequency → ask the user directly.
4. **Relevance triage**: `explains-the-symptom | adjacent | orthogonal` to the ticket in focus. Orthogonal → one line in the parking lot, never the main narrative.
5. **Executor over rhetoric**: when a repro is cheap, run it (project-executor) instead of arguing statically.

**Per-issue template** (use verbatim in reports, findings, map advisory notes):

```
ISSUE: <one line — "permits X" phrasing unless incidence observed>
shape:      confirmed|suspected — <file:line>
incidence:  observed <artifact> | unverified — static shape only | counter-evidence <artifact>
traces-if-real: <what would exist in logs/alerts/tickets; examined? found?>
scenario:   <real user action + frequency; "ASK: <question>" when unknown>
relevance:  explains-the-symptom | adjacent | orthogonal
```

**Failure mode this section prevents (2026-07-13, FN-1088):** agent labeled a bulletin mail-in-transaction shape "STILL BROKEN / confirmed" with zero production evidence; user had to challenge it, then dismissed six more theoretical edge cases presented without incidence assessment.
