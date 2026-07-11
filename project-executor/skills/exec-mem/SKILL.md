---
name: exec-mem
description: Inspect, edit, verify, or initialize the project's execution memory at .claude-memory/executions/ (env, runbook, data, browser, gotchas, journal). Use to review what the executor learned, correct wrong entries, re-verify stale runbook commands, or bootstrap memory in a new project. Maintenance mode only — it never starts the app or runs tests; use /execute for that.
---

# exec-mem

Memory maintenance for project-executor. Obey `spec/memory-contract.md`
(in this plugin) for layout, templates, read discipline, and staleness rules.

## Operations (pick from the user's request; default = `show`)

### init
Run the Init procedure from the memory contract: create missing dirs/files from
templates, apply the gitignore guard. Idempotent. Report what was created vs existed.

### show [file]
No arg: print a compact status table — for each schema file: exists?, entry count,
oldest/newest `verified:` stamp, stale entries flagged (> 14 days). With arg
(env|runbook|data|browser|gotchas): print that file's entries verbatim.

### verify [entry]
Re-verify runbook entries. No arg: all stale entries. With arg: that entry.
For each: run the command with its readiness check (spawn `exec-runner` per
`spec/evidence-contract.md` if output may be large). Success → update `verified:`
stamp. Failure → show evidence, propose a corrected entry, get confirmation
(interactive) before saving; move the broken form to `gotchas.md`.

### edit
Apply the user's stated correction to the named schema file. Keep entries in the
contract's template shape. Never delete `data.md` credentials without explicit
confirmation.

### distill
Run the Distillation procedure from the memory contract on unprocessed journal
files, outside a report phase (useful after a crashed session).

## Rules

- This skill NEVER injects instrumentation and never writes reports.
- Interactive credential policy applies (memory contract): ask before saving secrets.
- Keep schema files short — prune when showing reveals bloat, with user consent.
