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

This plugin is distributed through the **`alex-makoto-plugins`** marketplace. From any machine:

```
claude plugin marketplace add AlexanderBorysenko/alex-makoto-plugins
claude plugin install memory-system@alex-makoto-plugins
```

Then **fully restart Claude Code** so the hook, commands, and skill load. On the next session start the SessionStart hook fires; if `./.claude-memory/` does not exist, Claude offers to initialize it once.

To update later: `claude plugin update memory-system@alex-makoto-plugins` (or it refreshes at startup if the marketplace has `autoUpdate` enabled).

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

Beyond the slash commands, the plugin ships a Node script you can run directly from your shell. Inside Claude Code the skill invokes it as `${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js`; from a plain shell, point at the installed copy (a marketplace install lives under the plugin cache, e.g. `~/.claude/plugins/cache/alex-makoto-plugins/memory-system/<version>/bin/mem-index.js`):

```
node <plugin-root>/bin/mem-index.js tasks
node <plugin-root>/bin/mem-index.js arch
node <plugin-root>/bin/mem-index.js findings
node <plugin-root>/bin/mem-index.js all
```

`tasks` groups by `open` / `done` (Open sorted most-recently-updated first). Flags: `--json` for machine-readable output, `--base <path>` to point at a `.claude-memory/` other than `./`.

## Memory layout

- **Repo memory — `./.claude-memory/`**: project-specific (this plugin's domain).
- **Auto-memory — harness-managed (outside the repo)**: cross-project / user-level only. The plugin does not touch it.
- Indexes (task list, component table, findings list) are derived from per-file frontmatter via `bin/mem-index.js` — never stored on disk.

Never duplicate project-specific content into auto-memory.

## Migrating from a legacy `.claude-memory/`

If your existing `.claude-memory/` follows the older format with per-task "Session Log" entries (multi-session diaries), no automated migration is needed — the plugin works against the current state of your journals. For best results, manually compress each per-task journal once: keep Findings, Decisions, Open Questions, and Next Steps; drop the Session Log section entirely. The skill will then operate on pure-state journals as designed.

**Task status.** The earlier `active | paused | done` model has been replaced by `open | done` — there is no longer a single "current/active" task. Legacy `active` and `paused` statuses are read as `open` automatically by `mem-index`, so old journals keep working with no edits. At session start Claude loads only the task index and pulls a journal once your messages reveal what you're resuming.

## Origin

Distilled from a workflow originally built for an internal crawler project. The plugin removes all project-specific identifiers (project names, tool-specific startup steps, git policies, fixed paths) so it works in any repo. Design rationale for the no-active-task model: see [docs/superpowers/specs/2026-06-02-remove-active-task-concept-design.md](docs/superpowers/specs/2026-06-02-remove-active-task-concept-design.md).

## License

Internal use.
