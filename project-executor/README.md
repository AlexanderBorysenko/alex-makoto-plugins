# project-executor

Durable execution memory + real local execution for a project. The plugin is the
"hands": it starts/stops the app, runs tests and builds, drives browser flows,
reproduces bugs with removable debug instrumentation, and writes evidence-backed
reports — while maintaining per-project memory so every future run starts smart.

## Entry points

| Surface | Use |
|---|---|
| `/execute <request>` | run/test/full-test/repro — smart-routed |
| `/exec-mem [op]` | inspect/edit/verify/init execution memory |
| `executor` agent | programmatic callers (pipelines, other agents) — returns report path + verdict |

## Memory (per target project)

`.claude-memory/executions/` — `env.md`, `runbook.md` (verified: stamps, 14-day
staleness), `data.md` (local-only credentials, gitignore-guarded), `browser.md`,
`gotchas.md`, `journal/`, `reports/`. See `spec/memory-contract.md`.

## Design principles

- Main model decides; haiku/sonnet subagents execute mechanically and return
  distilled evidence (≤50 lines) — raw output goes to report artifacts.
- Debug logs are tagged `[EXEC-TRACE:<runid>:<seq>]`, registered, and stripped
  with git-diff verification; reports are blocked until the tree is clean.
- Reports carry machine-readable YAML frontmatter (verdict, artifacts, cleanliness).

Contracts: `spec/`. Acceptance: `fixtures/ACCEPTANCE.md`.
Design spec: `docs/superpowers/specs/2026-07-11-project-executor-design.md`.
