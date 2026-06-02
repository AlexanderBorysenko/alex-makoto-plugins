# memory-system

A Claude Code plugin that packages a disciplined project-memory and task-journal workflow into a generic, drop-in artifact.

## Philosophy

The journal is the project's current truth, not a diary. Sessions are the interface that produces durable artifacts (Findings, Decisions, Open Questions, Next Steps, Architecture Cache). History of how we got somewhere is not stored — git is the audit trail when it is needed.

## What it gives you

- **Architecture cache** — an index + lazy-loaded detail pages under `./.claude-memory/arch/`. Claude reads the index at session start and loads detail pages on demand.
- **Per-task journals** — one file per task at `./.claude-memory/tasks/<slug>.md`. Pure state, no diary. Frontmatter (`title`, `slug`, `status` (`open` | `done`), `summary`, `created`, `updated`, `topics`) plus Goal, Related Documents, Findings, Decisions, Open Questions, Next Steps. There is no "active/current" task — at session start Claude loads only the index and loads a journal once your messages reveal what you're resuming.
- **Dynamic indexes** — `bin/mem-index.js` generates the task / component / findings indexes on demand from per-file frontmatter. Nothing to keep in sync.
- **Cross-task findings** — durable facts shared across tasks live in `./.claude-memory/findings/<topic>.md`.
- **SessionStart hook** — quietly reminds Claude to run the startup ritual (load the index, not a specific task).
- **Slash commands** — `/mem-start`, `/mem-new-task`, `/mem-wrap-up`, `/mem-end-session`.

## Install

1. Copy or symlink `memory-system-plugin/` into your Claude Code plugins directory (typically `~/.claude/plugins/memory-system/`).
2. Restart your Claude Code session, or enable the plugin via Claude Code's plugin manager.
3. On the next session start, the SessionStart hook fires. If `./.claude-memory/` does not exist, Claude offers to initialize it once.

**Prerequisites:** Node.js available on PATH (used by the SessionStart hook script).

## Commands

| Command | What it does |
|---|---|
| `/mem-start` | Run the startup ritual now (load architecture cache + open-task index; no task auto-loaded). |
| `/mem-new-task <slug-or-description>` | Create a new per-task journal. |
| `/mem-wrap-up` | Prune, update, cascade, report — finalize the task(s) worked on this session. |
| `/mem-end-session` | Alias for `/mem-wrap-up`. |

Trigger phrases (`wrap up`, `end session`, `new task:`, etc.) also work — the skill auto-invokes on these. To resume an existing task, just mention it; Claude matches it against the index and loads its journal.

## CLI utility

Beyond the slash commands, the plugin ships a Node script you can run directly from your shell:

```
node ~/.claude/plugins/memory-system/bin/mem-index.js tasks
node ~/.claude/plugins/memory-system/bin/mem-index.js arch
node ~/.claude/plugins/memory-system/bin/mem-index.js findings
node ~/.claude/plugins/memory-system/bin/mem-index.js all
```

Flags: `--json` for machine-readable output, `--base <path>` to point at a `.claude-memory/` other than `./`.

## Memory layout

- **Repo memory — `./.claude-memory/`**: project-specific (this plugin's domain).
- **Auto-memory — harness-managed (outside the repo)**: cross-project / user-level only. The plugin does not touch it.
- Indexes (task list, component table, findings list) are derived from per-file frontmatter via `bin/mem-index.js` — never stored on disk.

Never duplicate project-specific content into auto-memory.

## Migrating from a legacy `.claude-memory/`

If your existing `.claude-memory/` follows the older format with per-task "Session Log" entries (multi-session diaries), no automated migration is needed — the plugin works against the current state of your journals. For best results, manually compress each per-task journal once: keep Findings, Decisions, Open Questions, and Next Steps; drop the Session Log section entirely. The skill will then operate on pure-state journals as designed.

## Origin

Distilled from a workflow originally built for the il-crawlers project. The plugin removes all project-specific identifiers (project names, tool-specific startup steps, git policies, fixed paths) so it works in any repo. Full design rationale: see the [design spec](../docs/superpowers/specs/2026-05-12-memory-system-plugin-design.md) (in the source repo).

## License

Internal use.
