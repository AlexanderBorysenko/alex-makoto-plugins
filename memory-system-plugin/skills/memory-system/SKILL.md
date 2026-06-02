---
name: memory-system
description: Project memory and task-journal workflow. Use when the user starts work, switches or wraps up a task, references the architecture cache, asks about prior sessions, or types any of the `/mem-*` slash commands. Auto-invoked at session start via SessionStart hook.
---

# Memory System

You are operating with a disciplined project-memory workflow. The journal is the project's current truth, not a diary. Sessions are the interface that produces durable artifacts; the artifacts (Findings, Decisions, Open Questions, Next Steps, Architecture Cache) are what matter. History of how we got somewhere is **not** stored — git is the audit trail when it is needed.

## Memory layout

Two locations, clean split:

- **Repo memory — `./.claude-memory/`** (in this project's root): project-specific. Architecture cache, task journals, cross-task findings. Single source of truth for anything tied to this project.
- **Auto-memory** (harness-managed by Claude Code, lives outside the repo): cross-project / user-level only. Preferences, role context, references to external systems. **You do not manage auto-memory from this skill.**

Never duplicate project-specific content into auto-memory. If it is about this project's code, components, tasks, or decisions, it goes in `./.claude-memory/`.

Indexes (task list, component list, findings list) are generated on demand via `bin/mem-index.js` — never stored on disk.

## Startup ritual

Triggered at session start (via SessionStart hook) or by `/mem-start`.

There is **no "current/active" task**. Startup is index-first and lazy: load the lightweight index, then let the user's messages reveal which task is being resumed, and load only that journal on demand.

1. If `./.claude-memory/` does not exist: run the init flow (see Initialization section below). Offer once; do not nag again.
2. Read `./.claude-memory/architecture_cache.md` — the narrative file (project overview, DevOps surface, conventions, gotchas). Do not load `arch/<component>.md` detail pages until you need them.
3. Run `node ${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js tasks` and read its output to load the index of open tasks. The script parses per-task frontmatter — there is no on-disk index file. **Do not read any task journal yet.**
4. Let the user's messages reveal what they are resuming. When intent is clear, match it against the index (by slug, title, topics, or subject) and read only that one task's journal at `./.claude-memory/tasks/<slug>.md` in full. The journal contains only current state. If the first message already names or implies a task, match and load it immediately.
5. If intent is not yet clear, give a one-line ready signal (e.g. "Memory loaded — N open tasks indexed; what are we picking up?") rather than guessing or auto-loading a task. Open tasks are sorted most-recently-updated first as a hint, not a default selection.

Token budget target: startup reads (narrative cache + index) <= ~120 lines; load a journal only once a task is in focus.

## Architecture cache

Pattern: narrative file + per-component detail files + script-generated component index.

- `architecture_cache.md` is a **narrative-only** file. It contains parts of the architecture that are not naturally per-component: project overview, DevOps surface, conventions, known gotchas. It contains **no component table**. Target <= 80 lines.
- Each component lives at `arch/<component>.md` with required frontmatter:

````markdown
---
component: <kebab-name>
responsibility: <one-line summary>
---
````

  Body: repo-relative paths, key files, public interfaces, config keys/env vars, component-specific gotchas. Load only when about to work on that component.
- Obtain the current component index by running `node ${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js arch`. There is no on-disk component table to maintain — the script is the index.

### Narrative file content (`architecture_cache.md`)
- Project overview — purpose, top-level layout, runtimes, entry points.
- DevOps surface — Dockerfiles, compose, CI, run scripts (one-liners with paths).
- Conventions — testing layout, naming, error handling, logging style (<= 10 bullets).
- Known gotchas — non-obvious behaviors worth caching globally.

### Detail page content (per component, in `arch/<component>.md`)
- Responsibility (also in frontmatter), repo-relative paths, key files, public interfaces, config keys/env vars, component-specific gotchas.

### Rules
- Consult the narrative cache + run `mem-index arch` **before** running Glob/Grep/Read to find architectural facts.
- If the cache + index answer the question, cite the file and skip the search.
- If the code contradicts the cache, the code wins — **update the cache in the same turn** as the code change.
- Update triggers (must edit in the same turn):
  - Adding a component: create `arch/<component>.md` with frontmatter. The index auto-reflects it next time `mem-index arch` runs.
  - Renaming/moving/deleting a component: rename/move/delete the `arch/<component>.md` file. The index follows.
  - Changing a public interface, pipeline contract, or message schema.
  - Changing config keys, env vars, or external integrations.
  - Changing DevOps entrypoints.
  - Discovering a non-obvious behavior worth caching.
- Repo-relative paths only.
- Bullets and one-liners, no prose.
- If the narrative cache is missing or clearly stale, tell the user and offer to (re)build it before proceeding.

## Task journals

### Index is dynamic
There is **no on-disk master index**. Obtain the current task index by running `node ${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js tasks`. The script scans `./.claude-memory/tasks/*.md`, parses frontmatter, and prints a markdown index grouped by `status` (open / done) with title, summary, updated, topics, and link. Open tasks are sorted most-recently-updated first. Output is deterministic and always current. Legacy `active`/`paused` statuses are read as `open` automatically.

### Per-task journal — `tasks/<slug>.md`
One file per discrete task. Pure state, no diary. Required structure:

````markdown
---
title: <human title>
slug: <kebab-slug>
status: open | done
created: YYYY-MM-DD
updated: YYYY-MM-DD
summary: <one-line description used by mem-index>
topics: [tag1, tag2]
---

# <Task title>

## Goal
1-3 lines. What "done" looks like.

## Related Documents
Every .md this task depends on or produces, with one-line role notes.

## Key Findings
Durable facts learned. Code locations (`path:line`), gotchas, surprises. Current state only — when invalidated, replace in place; do not retain superseded entries.

## Decisions
Format: `YYYY-MM-DD — decision — rationale`. The rationale carries the trace (e.g. "tried X, didn't work because Y, switched to Z"). When reversed, replace in place; do not retain superseded entries.

## Open Questions
Unresolved items, blockers, things to confirm.

## Next Steps
Concrete, ordered. The first bullet is the immediate next action.
````

**No Session Log.** Findings, Decisions, Open Questions, and Next Steps are edited in place as understanding improves. Git history is the audit trail when needed.

### When to create a per-task journal
**Tier 1 — always create** when ANY is true:
- User explicitly frames a task (`task:`, `new task:`, "let's work on…", ticket ID, ticket description).
- Work involves architectural changes (new component, public interface change, schema/contract change, deployment topology).
- Work requires upfront research, design, or a plan doc before code.
- User references a planning artifact (superpowers plan, spec, design doc, RFC).

**Tier 2 — ask once** for anything else:
> "Should I treat this as a separate task with a journal, or handle it as a quick edit?"

**Never journal:** read-only questions, one-shot reformatting, single-line typo fixes, exploratory tweaks where the goal is still unclear.

**Naming:** kebab-slug, <= 5 words (e.g. `auth-middleware-rewrite.md`).

**On creation:** the per-task file's frontmatter (`status: open`, populated `summary:`) is sufficient — `mem-index tasks` picks it up automatically. No separate index update needed.

## Wrap-up protocol

Triggered by phrases (`wrap up`, `end session`, `save progress`, `compress`, `handoff`, etc.) or `/mem-wrap-up` / `/mem-end-session`.

Wrap-up operates on the **task(s) worked on this session** — identified from conversation context, not from any status flag. If more than one task was touched, wrap up each. If which task to finalize is genuinely ambiguous, ask the user before editing.

1. **Per-task journal:**
   - Bump `updated:` in frontmatter.
   - Update `summary:` in frontmatter if focus shifted (this is what `mem-index` displays).
   - Edit Findings in place: prune obsolete entries; merge new durable facts.
   - Edit Decisions in place: prune reversed entries; add new decisions with rationale.
   - Update Open Questions: remove resolved, add new.
   - Rewrite Next Steps so the first bullet is the immediate next action.
2. **Cascade to Related Documents:**
   - Plans -> mark steps done/in-progress, note scope shifts.
   - Specs / design docs -> update if decisions changed the design.
   - Architecture cache (narrative file) -> update **immediately** if architecture changed.
   - `arch/<component>.md` files -> create, rename, or delete as needed. The component index follows automatically — no separate index to maintain.
   - Mark obsolete or superseded related docs accordingly.
3. **Cross-task findings:** if any Finding in the wrapped-up task overlaps a finding in another open/recent task, promote to a shared topic file at `findings/<topic>.md` and link from each journal.
4. **Verify before claiming done:** state which files were updated and the new Next Steps first bullet, in 2-3 lines max.

## Resuming, archiving, purging

There is no "switch active task" operation, because no task is ever marked active. You move between tasks simply by talking about them.

- **Resuming a task** — when the user mentions a task (by slug, title, topic, or subject), match it against `mem-index tasks` and read only that journal, then surface its Next Steps. No status change is involved; loading a journal is just retrieval. Multiple tasks can be in focus within one session.
- **`/mem-new-task <slug-or-description>`** or `new task: <description>` — create a new per-task journal from the template with `status: open` and a populated `summary:` in frontmatter. Existing tasks are left as-is.
- **`done` / `close task`** — flip frontmatter `status:` to `done`. Run the wrap-up protocol once more to finalize.
- **`purge journal` / `clean slate`** — delete **only** explicitly named per-task files. Never delete journals without explicit user confirmation. There is no master-index file to edit.

## Cross-task findings

When a Finding appears across two or more per-task journals, promote it to a shared topic file at `./.claude-memory/findings/<topic>.md` and link from each journal's Findings section.

Topic file structure:

````markdown
---
topic: <topic slug>
summary: <one-line description used by mem-index>
created: YYYY-MM-DD
updated: YYYY-MM-DD
---

# <Topic>

## Finding
The durable fact.

## Evidence
Where it was observed (paths, runs, incidents).

## Related Tasks
- [task-slug](../tasks/task-slug.md)
````

Run `node ${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js findings` to obtain the current findings list. There is no on-disk findings index.

**Promotion trigger:** during wrap-up, scan the wrapped-up task's Findings against findings in other open/recent task journals. If overlap, promote.

## Retrieval discipline

**Use `mem-index <kind>` for lists; Grep for content.**

1. Need a list (tasks / components / findings)? Run `node ${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js <kind>`. Never grep for it; never read a stale on-disk index — there is none.
2. Looking for a specific topic across journal bodies? Use Grep against `./.claude-memory/` to locate matching sections, then read only the matched section — not the whole file.
3. Do not bulk-read all per-task journals at startup — load a journal only once its task is in focus.

**Frontmatter is the discovery primitive.** `mem-index` operates on frontmatter; the `topics:` tag enables discovery without reading bodies.

**Architecture cache.** Read the narrative file (`architecture_cache.md`) for project-wide context; run `mem-index arch` for the component list; load `arch/<component>.md` detail pages only when needed.

## Anti-patterns

- Do not maintain an on-disk index of tasks, components, or findings. The script is the index.
- Do not retain superseded Findings or Decisions. The current journal is current truth.
- Do not write a Session Log or "what I did this session" entries. Sessions are not durable artifacts.
- Do not update a per-task journal without cascading to its Related Documents.
- Do not duplicate project-specific content into auto-memory.
- Do not journal code already in git history.
- Do not journal architecture facts already in the cache.
- Do not journal narrating-the-session content. Only durable, non-derivable insights.
- Do not delete journals without explicit user confirmation.
- Do not create a per-task journal for trivial one-off edits.

## Initialization

If `./.claude-memory/` does not exist when the startup ritual fires:

1. Offer **once**:
   > "No `.claude-memory/` found here. Want me to initialize it? I'll scaffold `architecture_cache.md` (empty narrative template) and the `tasks/`, `arch/`, `findings/` directories. There is no on-disk task or findings index — `mem-index` derives those from per-file frontmatter on demand. I won't fill the architecture cache automatically — that happens on the first real task."
2. If yes: create the one template file and the three empty directories below.
3. If no: stay quiet for the rest of the session.

### Template: `architecture_cache.md` (narrative only — no component table)

````markdown
# Architecture Cache

> Narrative file. Component detail lives in `arch/<component>.md`. The component index is generated on demand via `mem-index arch`.

## Project overview
- Purpose:
- Top-level layout:
- Runtimes / languages:
- Entry points:

## DevOps surface
- _(empty)_

## Conventions
- _(empty)_

## Known gotchas
- _(empty)_
````

### Per-task template (for `/mem-new-task`)

Use the structure documented in the Task journals section above (including the `summary:` frontmatter field).

### Directories to create
- `tasks/`
- `arch/`
- `findings/`

No master task index file or findings index file is created. Those indexes are derived on demand by `bin/mem-index.js` from per-file frontmatter.
