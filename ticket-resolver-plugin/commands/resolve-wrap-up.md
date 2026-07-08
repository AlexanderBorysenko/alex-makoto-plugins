---
description: Wrap up the active ticket — clean pause + handoff so a later session can resume it.
---

Run the ticket-resolver **wrap-up** on the ticket worked on this session.

This is **NOT finalize**: it never commits, pushes, opens a PR, or transitions Jira. It only makes
the ticket safe to leave and cheap to resume in a new session. (Finalize stays the explicit,
human-gated `finalize` action.)

**Identify the ticket** from conversation context — the `<TICKET>` whose
`.workbench/<TICKET>-*/INDEX.md` you have been driving. If it is genuinely ambiguous, run
`node ${CLAUDE_PLUGIN_ROOT}/bin/workbench-index.js` and ask which ticket to wrap up.

Steps:

1. **Rewrite `.workbench/<TICKET>-*/INDEX.md` in full to current truth** (it is rewritten, not
   appended — current state, never a log):
   - **Frontmatter:** set `state:` to the current state, bump `updated:`, refresh `summary:` if
     focus shifted, and set `next_action:` to the *single immediate next step* a resuming session
     should take (e.g. "awaiting user `continue` at GATE_IMPL", or "re-run change-verifier on the
     export module").
   - **Body:** prune superseded Core findings and reversed Decisions, update Architecture nuances,
     and rewrite `## Next action` to match `next_action:`.
2. **Fold durable run/test findings into `.workbench/RUNBOOK.md`.** Anything learned this session
   about running the env, reproducing the bug, or which scaffolds were needed goes into the RUNBOOK
   (the orchestrator is its sole writer) so the next ticket skips the experimentation. Prune entries
   that are no longer true.
3. **Leave git mostly untouched.** Do not push and do not finalize. Existing `scaffold:` commits stay
   in place (they are dropped only at finalize). Keep the worktree and `bugfix/<KEY>` branch intact;
   if there is uncommitted WIP, describe it in the body so the next session knows where things stand.
4. **Verify and report in 2-3 lines:** ticket key, current state, the `next_action`, and the
   INDEX.md path. Tell the user how to resume: **`/resolve <KEY>`** in a new session (or `/resolve`
   with no key to list all open tickets).
