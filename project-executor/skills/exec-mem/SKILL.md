---
name: exec-mem
description: Inspect, edit, verify, or initialize the project's execution memory wiki at .claude-memory/executions/ (index, schema, env, runbook, data, browser, gotchas, concept pages, journal). Use to review what the executor learned, correct wrong entries, re-verify stale runbook commands, or bootstrap memory in a new project. Maintenance mode only — it never starts the app or runs tests; use /execute for that.
---

# exec-mem

Memory maintenance for project-executor. The memory is an LLM Wiki; obey
`spec/memory-contract.md` (in this plugin) for layout, wiki conventions,
templates, read discipline, staleness, and supersession rules — and the
project's own `schema.md` where it refines them.

## Operations (pick from the user's request; default = `show`)

### init
Run the Init procedure from the memory contract: create missing dirs/files from
templates, apply the gitignore guard. Idempotent. Report what was created vs existed.

### show [page]
No arg: print a compact status table — for each wiki page (canonical + `wiki/`
concept pages): exists?, entry count, oldest/newest `verified:` stamp, stale
entries flagged (> 14 days); plus whether `index.md` matches the actual pages and
whether `schema.md` has drifted from the contract defaults. With arg
(env|runbook|data|browser|gotchas|index|schema|wiki/<slug>): print that page's
entries verbatim.

### verify [entry]
Re-verify runbook entries. No arg: all stale entries. With arg: that entry.
For each: run the command with its readiness check (spawn `exec-runner` per
`spec/evidence-contract.md` if output may be large). Success → update `verified:`
stamp. Failure → show evidence, propose a corrected entry, get confirmation
(interactive) before saving; apply the contract's Supersession procedure (replace
in place, journal the supersession, gotcha if the old form is a trap).

### edit
Apply the user's stated correction to the named wiki page. Keep entries in the
contract's template shape; fix wikilinks and `index.md` if the edit renames or
removes an entry. Never delete `data.md` credentials without explicit
confirmation.

### distill
Run the Distillation procedure from the memory contract on unprocessed journal
files, outside a report phase (useful after a crashed session).

## Rules

- This skill NEVER injects instrumentation and never writes reports.
- Interactive credential policy applies (memory contract): ask before saving secrets.
- Keep wiki pages short — prune when showing reveals bloat, with user consent.
- Journal and reports are raw sources: never edit them retroactively.
