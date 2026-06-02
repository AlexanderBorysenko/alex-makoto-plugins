#!/usr/bin/env node

const reminder = `Memory system plugin active. If \`./.claude-memory/\` exists in this project, run the startup ritual now:

1. Read \`./.claude-memory/architecture_cache.md\` (the narrative file — project overview, DevOps, conventions, gotchas).
2. Run \`node \${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js tasks\` and read its output to load the index of open tasks. Do NOT read any task journal yet — there is no "current/active" task to auto-load.
3. Let the user's messages reveal what they are resuming. When intent is clear, match it against the index and read only that one task's journal at \`./.claude-memory/tasks/<slug>.md\` (current state only — no historical log). If the first message already names or implies a task, match and load it immediately.
4. If intent is not yet clear, give a one-line ready signal (e.g. "Memory loaded — N open tasks indexed; what are we picking up?") instead of guessing a task.

If \`./.claude-memory/\` does not exist, offer once to initialize it; do not nag again in the same session. See the \`memory-system\` skill for the init template and full workflow.`;

process.stdout.write(reminder + '\n');
