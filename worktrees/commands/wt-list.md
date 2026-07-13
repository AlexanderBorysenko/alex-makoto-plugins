---
description: List worktrees — registry reconciled against live git state, drift flagged.
---

Invoke the `worktrees` skill and list worktrees.

Steps:
1. Read `.claude-memory/worktrees.md` (empty/missing → say "no registered worktrees").
2. Run `git worktree list --porcelain`.
3. Reconcile: for each registry row check the live worktree exists; for each
   live worktree (other than the main tree) check a row exists.
4. Refresh each row's status (clean / dirty / pushed) from `git -C <path> status --porcelain`
   and branch tracking info.
5. Output a table: path | branch | task | status. Flag DRIFT rows explicitly
   (registered-but-gone → offer `git worktree prune` + row cleanup;
   live-but-unregistered → offer to register). Never silently rewrite.
