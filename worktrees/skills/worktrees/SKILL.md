---
name: worktrees
description: Law-governed git worktree protocol. Use whenever work needs an isolated branch — user asks for parallel task work, an agent dispatch will mutate tracked files, two branches must be checked out at once, or a long build/test would block the main tree. Also use when the user mentions worktrees, isolated branches, or invokes any /wt-* command. Governs native EnterWorktree / isolation:"worktree" too.
---

# Git Worktree Protocol

Single source of truth for git worktree handling. Any agent that needs to
operate on an isolated branch without disturbing the user's main working tree
follows this protocol. The `/wt-*` commands are deterministic entry points into
it; natural-language triggers land here too.

Project-specific gotchas live in `.claude-memory/worktree-notes.md` — read it
before any worktree action; create it from
`${CLAUDE_PLUGIN_ROOT}/templates/worktree-notes.md` if missing.

## WHEN TO USE A WORKTREE

USE when:
- User explicitly asks for parallel task work
- An agent dispatch will MUTATE tracked files (not just run probes)
- Two dispatches need different branches checked out at the same time
- A long-running build / test would block the user's main tree

DO NOT use when:
- Work is purely read-only (grep, file read, status)
- Work touches only gitignored state (e.g. `.claude-memory/`)
- Dispatch finishes inside a few minutes on a clean branch

A repo's CLAUDE.md branch policy (e.g. "work on main, no branches") stays the
default. A worktree is the sanctioned exception ONLY when a gate above passes.

## LIFECYCLE

### W1. CREATE
- Path convention: INSIDE the project at `<project-root>/.claude/worktrees/<slug>/`.
  Not an external sibling directory.
- Verify `.claude/worktrees/` is gitignored; add the entry BEFORE creating if missing.
- New branch: `git worktree add .claude/worktrees/<slug> -b <branch> [base-ref]`
- Existing branch: `git worktree add .claude/worktrees/<slug> <branch>`

### W1b. RELOCATE
- ONLY via `git worktree move <old> <new>`. NEVER plain `mv` — git records the
  worktree's absolute path in its `.git` linkage; a bare `mv` orphans it.

### W1c. CLONE THE GRAPHIFY INDEX
- If the parent repo has `graphify-out/` at its root: the fresh worktree starts
  without one, so graph-aware work there would miss context or query the parent's
  stale-vs-branch graph.
- Immediately after W1, from inside the worktree:
  copy `graphify-out/` from the parent repo root into the worktree, then run
  `graphify update .` (copy first so the incremental extractor has cached AST to
  diff against; the update re-extracts only files that differ on the branch).
- If the parent has no `graphify-out/` → skip and note it in the registry row.

### W2. ANNOUNCE + REGISTER
- Add a row to the registry `.claude-memory/worktrees.md` (format below);
  create the file with its header if missing.
- If a tasks-manager journal exists for the owning task
  (`.claude-memory/tasks/<slug>.md`), add a one-line worktree note there
  pointing at the registry.

### W3. WORK IN ISOLATION
- All file edits, builds, and commits happen inside the worktree.
- The main repo tree is read-only from this worktree's perspective.
- Subagents inherit the worktree's working dir — see GW5 and the dispatch contract.

### W4. SYNC
- To pull main-branch updates: `git fetch && git rebase <main>` inside the worktree.
- Never `git pull` in a worktree without confirming no in-flight subagent edits.

### W5. MERGE / DELIVER
- Surface finished-work options to the user:
  push branch + open PR (preferred for shared review) | merge locally |
  cherry-pick to current branch | discard (experiment failed / exploratory).
- The DECISION is the user's, never the agent's.

### W6. CLEANUP
- After merge or discard: `git worktree remove .claude/worktrees/<slug>`,
  then `git worktree prune`.
- `--force` ONLY with explicit user OK (GW4).
- Delete the registry row; note the final outcome in the task journal if one exists.

## NON-NEGOTIABLE LAWS

- **GW1. ONE WORKTREE = ONE BRANCH = ONE TASK.** No stacking tasks in one
  worktree — race risk, harder cleanup.
- **GW2. NO CROSS-WORKTREE WRITES.** An agent dispatched into worktree A never
  writes to worktree B or to the main repo. Cross-pollination = state corruption.
- **GW3. ANNOUNCE BEFORE CREATE.** Tell the user "creating worktree at <path>
  on branch <branch>" and wait for ack on the FIRST worktree of the session.
  Subsequent ones may proceed without ack unless the user revokes.
- **GW4. NEVER FORCE-DELETE WITHOUT USER OK.** `git worktree remove --force`
  requires explicit user approval — irreversible.
- **GW5. INHERIT THE WORKING DIR.** Every subagent dispatched into a worktree
  gets the dispatch contract (below) in its prompt: the absolute worktree path,
  and the instruction to run all commands with `git -C <path>` / cd into it.
  A subagent must never silently escape to the main tree.
- **GW6. CLEAN STATE ON SESSION END.** At wrap-up (or on request): list all
  live worktrees + state (clean / dirty / pushed) and ask the user what to
  keep, merge, or discard. If a tasks-manager wrap-up runs while the registry
  is non-empty, trigger this sweep.
- **GW7. WORKTREES LIVE INSIDE THE PROJECT, GITIGNORED.** Always under
  `<project-root>/.claude/worktrees/<slug>/`; `.claude/worktrees/` must be
  gitignored. Relocate only via `git worktree move` (W1b).

## DISPATCH CONTRACT

Any Agent-tool dispatch that runs inside a worktree MUST include this block in
the subagent's prompt (and the subagent forwards it to its own children):

```
working_dir:    <absolute worktree path>
branch:         <branch checked out in worktree>
worktree_role:  primary | sibling | experiment
parent_repo:    <main repo path — read-only reference, no writes>
cleanup_policy: keep | merge-then-remove | remove-after | force-remove (needs user OK)
```

## REGISTRY

`.claude-memory/worktrees.md` — spoke-owned, gitignored, per-project:

```
# Worktrees registry

| path | branch | task | role | cleanup_policy | status | created |
|------|--------|------|------|----------------|--------|---------|
```

Status: `clean` | `dirty` | `pushed`. Reconcile against
`git worktree list --porcelain` whenever listing: a registry row without a live
worktree, or a live worktree without a row, is DRIFT — surface it, never
silently rewrite.

## PRECEDENCE OVER OTHER MECHANISMS

- Native `EnterWorktree`, Agent `isolation: "worktree"`, and
  `superpowers:using-git-worktrees` are acceptable creation MECHANICS, but this
  protocol governs them: announce (GW3), registry (W2), path convention (GW7 —
  when the mechanism allows choosing), and cleanup (GW4/GW6) still apply.
  If a native mechanism creates a worktree elsewhere, register that path.

## ANTI-SHORTCUT RULES

- Create worktree without announcing first → reject
- Two tasks in one worktree → reject, split
- Cross-worktree write → reject, redispatch
- Force-remove without user OK → reject
- Subagent escapes working_dir → reject, redispatch with explicit path
- Session ends with unreviewed dirty worktrees → reject, run GW6

## USER COMMANDS

| User says | Do |
|---|---|
| "work on X in parallel" | Gate via WHEN TO USE → propose worktree per W1 + GW3 |
| "what worktrees are open" / `/wt-list` | Registry ⋈ live git state, flag drift |
| "merge worktree X" / `/wt-merge` | W5 — surface options, user picks target |
| "discard worktree X" / `/wt-discard` | W5 discard + W6; confirm if dirty |
| "clean up worktrees" / `/wt-cleanup` | GW6 sweep |
