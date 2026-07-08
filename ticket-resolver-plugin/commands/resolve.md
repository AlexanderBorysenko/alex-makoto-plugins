---
description: Resolve a JIRA bug ticket end-to-end (analyze → implement → review → verify → PR), human-gated. /resolve <KEY> to run or resume; /resolve to list open tickets.
argument-hint: "[TICKET-KEY]"
---

Invoke the `resolve-ticket` skill and run its **SETUP** entry, then drive the state machine.

Argument: `$ARGUMENTS`

- **`/resolve <KEY>`** (a ticket key was given) → run that ticket. If `.workbench/<KEY>-*/INDEX.md`
  already exists, **resume** from its recorded `state:` and surface `next_action`; otherwise start a
  fresh run (git preconditions → workbench setup → fetch ticket via Atlassian MCP → worktree →
  ANALYZE).
- **`/resolve`** (no argument) → run `node ${CLAUDE_PLUGIN_ROOT}/bin/workbench-index.js` and show the
  open tickets, then ask which to resume. Do not start anything until the user picks.

Always honor the skill's invariants: one ticket per session, a human gate between phases, and no
outward action (commit/push/PR/Jira) without an explicit human word. Inject
`${CLAUDE_PLUGIN_ROOT}/rules/agent-rules.md` into every subagent Task prompt.
