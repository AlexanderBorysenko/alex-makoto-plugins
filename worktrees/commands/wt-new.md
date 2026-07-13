---
description: Create a standardized git worktree (announce → create → graphify clone → register).
argument-hint: <slug> [base-ref]
---

Invoke the `worktrees` skill and create a new worktree following its protocol.

Arguments: `$ARGUMENTS` — a kebab-case slug (becomes path + branch name) and an
optional base ref (defaults per `.claude-memory/worktree-notes.md`, else the
repo's main branch).

Steps (each defined in the skill — follow it, do not improvise):
1. Read `.claude-memory/worktree-notes.md`; create from the plugin template if missing.
2. Gate via WHEN TO USE — if no isolation criterion applies, say so and stop.
3. GW3 announce: state path `.claude/worktrees/<slug>` + branch; first worktree
   of the session waits for user ack.
4. W1 create (gitignore check first).
5. W1c clone the graphify index if the parent repo has one.
6. W2 register in `.claude-memory/worktrees.md` + task journal note if one exists.
7. Confirm: path, branch, registry row, and the dispatch contract block ready
   for any agent sent into it.
