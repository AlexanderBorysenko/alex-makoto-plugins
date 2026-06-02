# Design: Remove the "active task" concept

Date: 2026-06-02

## Problem

The memory-system plugin designates exactly one task as `status: active`. The
SessionStart hook eagerly loads that one task's journal at startup. Users who
context-switch frequently find this disruptive: the auto-loaded "active" task is
often not what they intend to work on this session, and maintaining the single
active flag (via `/mem-switch-task`) is friction that adds no value.

## Goal

Remove the "current active task" concept entirely. Tasks are stored in the index;
at session start the agent loads only the lightweight index and lets the user's
messages reveal which task is being resumed, then loads that journal on demand.

## Decisions (confirmed with user)

- "Workflow" is not a new entity — it was loose phrasing for the existing tasks.
- Startup behavior: **silent, match on intent**. Load index + arch cache only;
  do not pick or announce a "current" task; match the user's stated intent.
- Status model: **`open | done`** (binary). No focus/paused state.
- `/mem-switch-task` is **removed** — resuming a task is just mentioning it.
- Legacy `paused` normalizes to `open` (no distinct shelved state preserved).

## Design

### 1. Status model: `open | done`

A task is unfinished (`open`) or finished (`done`). `mem-index tasks` groups by
**Open** / **Done**. Open is sorted by `updated` descending so the most recently
touched work surfaces first — an aid for intent-matching, not a designated
"current" task.

**Backward compatibility:** `mem-index.js` normalizes legacy status values before
validation: `active` → `open`, `paused` → `open`. `open` and `done` pass through.
Any other value is invalid (skipped with a warning, as today). Existing journals
keep working without manual migration.

### 2. Startup ritual: index-first, lazy-match

Replaces today's eager "identify the active task and read its journal":

1. Read `architecture_cache.md` (narrative).
2. Run `mem-index tasks` to load the index of open tasks.
3. Do **not** read any task journal yet.
4. When the user's messages reveal what they're resuming, match against the index
   and read that one journal on demand.
5. If the first message already names/implies a task, match and load immediately.
   Otherwise emit a one-line ready signal (e.g. "Memory loaded — N open tasks
   indexed; what are we picking up?") rather than guessing.

This is strictly less eager than today — lower startup token cost, no wrong-task
disturbance.

### 3. `/mem-switch-task` removed

Delete `commands/mem-switch-task.md`. The skill's "Switching" section is rewritten
to describe intent-based resumption instead of flag-flipping. Resuming = mention
the task; the agent matches the index and loads the journal.

### 4. `/mem-wrap-up` operates on the in-focus task

With no `active` flag, wrap-up targets the task worked on this session (known from
conversation context), not `status: active`. If multiple tasks were touched and
the target is ambiguous, the agent asks which to finalize. Marking done flips
status to `done`.

### 5. `/mem-new-task` creates `status: open`

Template and command default changes from `active` to `open`.

## Files touched

- `bin/mem-index.js` — status enum (`open | done`), legacy normalization
  (`active`/`paused` → `open`), Open/Done grouping labels.
- `hooks/session-start-reminder.js` — rewrite ritual text (index-first, lazy-match,
  no eager journal read).
- `skills/memory-system/SKILL.md` — rewrite Startup ritual, Task journals (status
  values + template), Wrap-up protocol (in-focus task), Switching/archiving
  section (drop switch-task, describe resumption), Anti-patterns; remove all
  "active task" framing.
- `commands/mem-start.md` — index-first, no active-task identification.
- `commands/mem-wrap-up.md` — target in-focus task instead of `status: active`.
- `commands/mem-end-session.md` — follows mem-wrap-up (verify wording).
- `commands/mem-new-task.md` — `status: open`.
- `commands/mem-switch-task.md` — **delete**.
- `README.md` — commands table (drop switch-task), status description, philosophy.
- `tests/mem-index.test.js` — legacy normalization, Open/Done labels, grouping.
- `tests/session-start-reminder.test.js` — new reminder text expectations.

## Non-goals

- No new "workflow" entity.
- No automated rewrite of users' existing journal files (normalization handles
  legacy status transparently at index time).
- No changes to architecture cache or findings mechanics beyond removing "active"
  references.

## Testing

- `mem-index.js`: legacy `active`/`paused` journals appear under Open; `open`/`done`
  group correctly; invalid status still skipped; sort-by-updated-desc within Open.
- `session-start-reminder.js`: output matches the new index-first ritual text.
- Run the existing node test suite; update assertions to match new labels/text.
