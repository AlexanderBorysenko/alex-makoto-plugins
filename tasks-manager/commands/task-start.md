---
description: Run the tasks-manager startup ritual now — load architecture cache and the open-task index (no task auto-loaded).
---

Invoke the `tasks-manager` skill and execute the **Startup ritual** section against this project:

1. If `./.claude-memory/` does not exist, run the Initialization offer.
2. Otherwise: read `./.claude-memory/architecture_cache.md` (narrative) and run `node ${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js tasks` to load the index of open tasks. There is no "current/active" task — do **not** read any task journal yet.
3. When the user's message reveals which task they are resuming, match it against the index and read only that one journal at `./.claude-memory/tasks/<slug>.md`, then surface its Next Steps. If intent is not yet clear, give a one-line ready signal ("Memory loaded — N open tasks indexed; what are we picking up?") instead of guessing.
