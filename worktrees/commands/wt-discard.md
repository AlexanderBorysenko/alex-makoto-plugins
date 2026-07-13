---
description: Discard a worktree and its branch (W5 discard + W6 cleanup); dirty trees need explicit confirmation.
argument-hint: <slug>
---

Invoke the `worktrees` skill and discard the worktree `$ARGUMENTS`.

Steps:
1. Locate the registry row; verify the worktree exists.
2. Check state. If DIRTY: show what would be lost and require explicit user
   confirmation before any `--force` removal (GW4 — irreversible).
3. `git worktree remove .claude/worktrees/<slug>` (add `--force` only after the
   confirmation above), then `git worktree prune`.
4. Ask whether to also delete the branch (`git branch -D <branch>`); default is
   keep unless the user confirms.
5. Delete the registry row; note the discard in the task journal if one exists.
