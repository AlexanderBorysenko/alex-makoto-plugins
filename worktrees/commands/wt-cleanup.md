---
description: Session-end worktree sweep (GW6) — list all live worktrees, ask keep/merge/discard for each.
---

Invoke the `worktrees` skill and run the GW6 sweep.

Steps:
1. Reconcile registry vs `git worktree list --porcelain` (as in /wt-list).
2. For each live worktree: report branch, status (clean / dirty / pushed), task.
3. Ask the user per worktree: keep | merge (→ /wt-merge flow) | discard
   (→ /wt-discard flow). Batch the question; execute the answers.
4. Prune stale entries; leave the registry matching reality exactly.
5. Summarize the end state in one short table.
