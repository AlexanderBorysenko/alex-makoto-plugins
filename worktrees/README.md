# worktrees

Law-governed git worktree protocol for agents. Standardizes how any agent in
the suite works on an isolated branch: fixed lifecycle, non-negotiable laws, a
per-project registry, and thin `/wt-*` commands as deterministic entry points.

Adapted from the digicomply agent-factory `Git Worktree Protocol.md`.

## What's inside

- [skills/worktrees/SKILL.md](skills/worktrees/SKILL.md) — the protocol:
  - **When to use** — mutating dispatches, parallel tasks, long builds; never for read-only work.
  - **Lifecycle W1–W6** — create (inside the project at `.claude/worktrees/<slug>/`,
    gitignored) → graphify index clone → announce + register → isolated work →
    sync → deliver (user decides) → cleanup.
  - **Laws GW1–GW7** — one worktree = one branch = one task; no cross-worktree
    writes; announce before create; no force-delete without user OK; subagents
    inherit the working dir via a mandatory dispatch contract; session-end sweep.
- Commands: `/wt-new <slug> [base]`, `/wt-list`, `/wt-merge <slug>`,
  `/wt-discard <slug>`, `/wt-cleanup`.
- [templates/worktree-notes.md](templates/worktree-notes.md) — per-project
  gotchas file, instantiated at `.claude-memory/worktree-notes.md`.

## State

- Registry: `.claude-memory/worktrees.md` (gitignored, per-project) — one row
  per worktree: path, branch, task, role, cleanup_policy, status. Always
  reconciled against `git worktree list`; drift is surfaced, never hidden.
- Task linkage: when a tasks-manager journal exists for the task, the worktree
  is noted there too (hub-and-spoke: this plugin owns the registry).

## Relation to native mechanisms

Native `EnterWorktree` / Agent `isolation: "worktree"` /
`superpowers:using-git-worktrees` remain usable as creation mechanics — this
protocol governs them (announce, registry, path convention, cleanup laws).
