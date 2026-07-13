---
description: Deliver a finished worktree (W5) — surface merge options, user decides, then cleanup.
argument-hint: <slug>
---

Invoke the `worktrees` skill and deliver the worktree `$ARGUMENTS`.

Steps:
1. Locate the registry row; verify the worktree exists (drift → stop and reconcile first).
2. Report its state: branch, ahead/behind base, dirty files, pushed or not.
3. W5: present options with a recommendation — push branch + open PR | merge
   locally into the current branch | cherry-pick selected commits | discard.
   The user decides; do not pick for them.
4. Execute the chosen path.
5. W6 cleanup: `git worktree remove` + `git worktree prune`, delete the registry
   row, note the outcome in the task journal if one exists. If the tree is dirty
   and removal would lose work, stop and confirm per GW4.
