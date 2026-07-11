# project-executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `project-executor` plugin — durable per-project execution memory + real local execution (lifecycle, tests, browser flows, instrumented bug repro) with evidence-backed reports, usable interactively (`/execute`, `/exec-mem`) and by pipelines (`executor` agent).

**Architecture:** A docs-driven Claude Code plugin: two skills (router + memory maintenance), four agent definitions (1 main, 3 mechanical subagents), and four contract documents in `spec/` that skills and agents share by reference. All runtime state lives in the target project's `.claude-memory/executions/`. No executable plugin code except a tiny fixture app used for acceptance testing.

**Tech Stack:** Claude Code plugin conventions (`.claude-plugin/plugin.json`, `skills/*/SKILL.md`, `agents/*.md`), markdown contracts, Node.js only for the test fixture.

**Spec:** `docs/superpowers/specs/2026-07-11-project-executor-design.md` — the plan implements it fully.

## Global Constraints

- Plugin lives at `project-executor/` in this repo; registered in `.claude-plugin/marketplace.json` as `"name": "project-executor"`, version `0.1.0`.
- Memory root in target projects: `.claude-memory/executions/` (exact path, per plugin-family convention).
- Evidence rule verbatim: subagents return distilled evidence ≤ 50 lines; raw output goes to files in the current report dir.
- Instrumentation tag format verbatim: `[EXEC-TRACE:<runid>:<seq>]`.
- Staleness threshold: runbook entries `verified:` older than 14 days are re-verified before being trusted.
- Report verdicts enum verbatim: `reproduced | not-reproduced | pass | fail | blocked`; cleanliness enum: `clean | unclean`.
- Skill/agent frontmatter follows architect-goggles style: `name:` + `description:` (agents add `model:`/`tools:` where specified).
- Legacy plugins (`memory-system`, `ticket-resolver`) are NOT referenced or depended on.
- Windows is the author's platform: any shell examples inside skills must offer POSIX and note PowerShell differences only where they bite (kill-by-port).

---

### Task 1: Plugin skeleton + marketplace registration

**Files:**
- Create: `project-executor/.claude-plugin/plugin.json`
- Create: `project-executor/README.md` (stub — full version in Task 7)
- Modify: `.claude-plugin/marketplace.json` (add plugin entry)

**Interfaces:**
- Produces: plugin id `project-executor` v0.1.0; directory layout `skills/`, `agents/`, `spec/` that all later tasks write into.

- [ ] **Step 1: Create plugin manifest**

`project-executor/.claude-plugin/plugin.json`:

```json
{
  "name": "project-executor",
  "description": "Project Executor: durable per-project execution memory plus real local execution — app lifecycle, tests/builds, browser flows, instrumented bug reproduction — with evidence-backed reports. Skills for humans (/execute, /exec-mem) and an executor agent for pipelines.",
  "version": "0.1.0",
  "author": { "name": "Alex" }
}
```

- [ ] **Step 2: Create README stub**

`project-executor/README.md`:

```markdown
# project-executor

Durable execution memory + real local execution for a project: start/stop the app,
run tests and builds, drive browser flows, reproduce bugs with removable debug
instrumentation, and produce evidence-backed reports.

Status: under construction — see `docs/superpowers/specs/2026-07-11-project-executor-design.md`.
```

- [ ] **Step 3: Register in marketplace**

In `.claude-plugin/marketplace.json`, append to the `plugins` array (after the `architect-goggles` entry):

```json
    {
      "name": "project-executor",
      "source": "./project-executor",
      "version": "0.1.0",
      "description": "Execution memory + real local execution: lifecycle, tests, browser flows, instrumented bug repro, evidence-backed reports."
    }
```

- [ ] **Step 4: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); JSON.parse(require('fs').readFileSync('project-executor/.claude-plugin/plugin.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add project-executor .claude-plugin/marketplace.json
git commit -m "project-executor: plugin skeleton + marketplace registration (v0.1.0)"
```

---

### Task 2: Memory + evidence contracts

**Files:**
- Create: `project-executor/spec/memory-contract.md`
- Create: `project-executor/spec/evidence-contract.md`

**Interfaces:**
- Produces: contract paths `spec/memory-contract.md` and `spec/evidence-contract.md` referenced verbatim by both skills and all four agents; schema-file names `env.md`, `runbook.md`, `data.md`, `browser.md`, `gotchas.md`; journal entry format; runbook entry format with `verified:` stamp.

- [ ] **Step 1: Write memory contract**

`project-executor/spec/memory-contract.md`:

```markdown
# Memory Contract

All execution memory lives in the TARGET PROJECT at `.claude-memory/executions/`.

## Layout

    .claude-memory/executions/
    ├── env.md          # services, ports, prereqs, OS quirks, required env vars
    ├── runbook.md      # verified commands (start/stop/build/test/seed)
    ├── data.md         # seeds, mock data patterns, test users + LOCAL-ONLY credentials
    ├── browser.md      # base URLs, auth flow, stable selectors, saved playwright routines
    ├── gotchas.md      # failure → resolution pairs; proven instrumentation points
    ├── journal/        # raw dated observations (append-only), one file per day: YYYY-MM-DD.md
    └── reports/<YYYY-MM-DD-slug>/   # see report-contract.md

## Init (idempotent — run whenever a schema file is missing)

1. Create missing directories/files from the templates below.
2. Gitignore guard: ensure the target repo ignores the memory dir. If `.gitignore`
   exists and lacks it, append a line `.claude-memory/`. If the repo would still
   commit `data.md` (check `git check-ignore .claude-memory/executions/data.md`),
   WARN the user before writing any credentials.

## Schema file templates

Every schema file starts with an HTML comment stating its purpose, then entries.

`runbook.md` entries (one `##` per action):

    ## start:api
    verified: 2026-07-11
    command: `npm run dev` (cwd: apps/api)
    readiness: GET http://localhost:3000/health → 200 within 30s
    stop: Ctrl+C / kill by port 3000
    notes: needs `DATABASE_URL` from env.md

`env.md`: one `##` per service/prereq with ports, versions, env vars.
`data.md`: one `##` per dataset/user. Credentials marked `local-only: true`.
`browser.md`: `## routine:<name>` blocks — goal, start URL, auth steps, selectors, expected outcome.
`gotchas.md`: `## <symptom>` blocks — symptom, cause, resolution, `verified:` date.
  Instrumentation points: `## trace-point:<topic>` — file:line, what to log, why useful.

## Journal

During any run, append discoveries immediately to `journal/YYYY-MM-DD.md`:

    ### HH:MM <flow> <runid>
    <observation — freeform, raw allowed>

## Read discipline

- Cold start: read schema files ONLY (never the journal, never old reports).
- Journal is write-hot / read-cold: it is only read during distillation.

## Staleness

`verified:` older than 14 days ⇒ entry is STALE. Before relying on a stale entry,
re-verify it cheaply (run it, check readiness). Success ⇒ update the stamp.
Failure ⇒ fix the entry via discovery, or move the broken form to `gotchas.md`.

## Distillation (report phase, main model only)

1. Read today's (and any unprocessed) journal files.
2. Fold durable facts into the schema files; delete contradicted entries; re-stamp
   `verified:` on anything re-confirmed this run.
3. Mark the journal file processed by appending `<!-- distilled: <runid> -->`.
4. Schema files must stay SHORT — prune aggressively; history lives in reports.

## Credentials policy

`data.md` may hold local test credentials. Interactive: ask before saving a new
credential. Agentic: NEVER auto-save new credentials — flag them in the report.
```

- [ ] **Step 2: Write evidence contract**

`project-executor/spec/evidence-contract.md`:

```markdown
# Evidence Contract

Applies to every subagent (exec-runner, exec-browser, exec-instrumenter).

## The rule

A subagent's reply is DISTILLED EVIDENCE: ≤ 50 lines. Raw output NEVER goes in
the reply — it goes to files under the current report dir
(`.claude-memory/executions/reports/<run>/logs/` or `screenshots/`).

## Evidence reply format (all subagents)

    status: ok | fail | timeout | blocked
    exit_code: <n | n/a>
    summary: <1-3 lines — what happened, factually>
    key_output: |
      <up to ~20 lines: error excerpts, pass/fail counts, readiness confirmation>
    artifacts:
      - logs/<file>            # full raw output — ALWAYS written, even on success
      - screenshots/<file>
    anomalies: <anything unexpected worth the main model's attention, or "none">

## Caller obligations (main model)

- Give the subagent: exact command/flow, cwd, timeout, readiness check,
  report dir path, and the runid.
- Read raw files only when the distilled evidence is insufficient to decide.
```

- [ ] **Step 3: Verify structure**

Run: `grep -l "verified:" project-executor/spec/memory-contract.md && grep -l "50 lines" project-executor/spec/evidence-contract.md`
Expected: both paths printed.

- [ ] **Step 4: Commit**

```bash
git add project-executor/spec
git commit -m "project-executor: memory + evidence contracts"
```

---

### Task 3: Instrumentation + report contracts

**Files:**
- Create: `project-executor/spec/instrumentation-contract.md`
- Create: `project-executor/spec/report-contract.md`

**Interfaces:**
- Consumes: report-dir layout names from `spec/memory-contract.md` (`reports/<YYYY-MM-DD-slug>/`).
- Produces: tag grammar `[EXEC-TRACE:<runid>:<seq>]`, registry filename `instrumentation-registry.json` + JSON shape, snapshot filename `pre-injection-diff.patch`, report template with YAML frontmatter (fields: `verdict`, `task`, `started`, `finished`, `artifacts`, `cleanliness`).

- [ ] **Step 1: Write instrumentation contract**

`project-executor/spec/instrumentation-contract.md`:

```markdown
# Instrumentation Contract

Temporary debug logs injected into project source to observe real behaviour.
Durable during the run, guaranteed removable after.

## Tag grammar

Every injected line contains the literal marker `[EXEC-TRACE:<runid>:<seq>]`
inside a language-appropriate log call:

    console.log('[EXEC-TRACE:r20260711a:001] user.id=', user?.id);
    logger.debug("[EXEC-TRACE:r20260711a:002] cart total=%s", total)
    print(f"[EXEC-TRACE:r20260711a:003] state={state}")

`runid` = `r<YYYYMMDD><letter>` chosen at flow start; `seq` = zero-padded counter.
One statement per injection. Never modify existing lines — only insert new ones.

## Before injection (main model prepares, instrumenter executes)

1. Snapshot: `git diff -- <target files>` saved to `<report-dir>/pre-injection-diff.patch`
   (empty file if targets were clean).
2. Registry at `<report-dir>/instrumentation-registry.json`:

    {
      "runid": "r20260711a",
      "entries": [
        { "file": "src/middleware/session.ts", "line": 42,
          "tag": "[EXEC-TRACE:r20260711a:001]", "purpose": "capture session.userId on refresh" }
      ]
    }

Registry is updated by the instrumenter after EVERY injection, before returning.

## Strip protocol (idempotent, crash-safe)

1. Grep the WHOLE repo for `EXEC-TRACE:<runid>` (not just registry files — belt and braces).
2. Remove every matching line via the instrumenter.
3. Verify: `git diff -- <target files>` must byte-match `pre-injection-diff.patch`.
4. Match ⇒ set registry `"entries": []`. Mismatch ⇒ STOP:
   interactive → show the residual diff, ask the human;
   agentic → report `cleanliness: unclean` with the diff; NEVER force-restore.

## Gate

Report phase is BLOCKED while the registry has entries. A crashed prior session
is healed by running the strip protocol first (grep finds orphans).

## Learning

Observation points that proved useful → `gotchas.md` as `## trace-point:<topic>`.
```

- [ ] **Step 2: Write report contract**

`project-executor/spec/report-contract.md`:

```markdown
# Report Contract

Every /execute flow ends with a report at
`.claude-memory/executions/reports/<YYYY-MM-DD-slug>/report.md`.

## Frontmatter (machine contract — pipeline callers parse ONLY this)

    ---
    verdict: reproduced | not-reproduced | pass | fail | blocked
    task: <short title>
    runid: <runid>
    started: <ISO 8601>
    finished: <ISO 8601>
    artifacts:
      - screenshots/step-3-login.png
      - logs/test-run.log
    cleanliness: clean | unclean
    ---

`cleanliness` is `clean` when no instrumentation was used OR strip verified byte-match.

## Body sections (all required; write "n/a" where empty)

    # <Task title>
    ## What ran            — scenarios, commands, env state (versions, ports)
    ## Observed behaviour  — deterministic facts from traces/logs, per step
    ## Evidence            — links to screenshots/logs; short excerpts inline
    ## Conclusions         — analysis; root-cause hypothesis if repro
    ## Memory updates      — what was learned/saved this run
    ## Cleanliness         — instrumentation stripped yes/no, tree state

## Verdict semantics

- pass/fail      — test, build, full-test flows
- reproduced/not-reproduced — repro flow (fail = repro machinery broke; use blocked)
- blocked        — environment prevented the run (app won't start, missing prereq)

## Agent return value

The `executor` agent's final message = report path + verdict + ≤1-paragraph summary. Nothing else.
```

- [ ] **Step 3: Verify structure**

Run: `grep -l "EXEC-TRACE" project-executor/spec/instrumentation-contract.md && grep -c "verdict" project-executor/spec/report-contract.md`
Expected: path printed, count ≥ 3.

- [ ] **Step 4: Commit**

```bash
git add project-executor/spec
git commit -m "project-executor: instrumentation + report contracts"
```

---

### Task 4: /exec-mem skill

**Files:**
- Create: `project-executor/skills/exec-mem/SKILL.md`

**Interfaces:**
- Consumes: `spec/memory-contract.md` (layout, init, templates, staleness).
- Produces: `/exec-mem` entry point — `init | show | verify | edit | distill` operations used standalone and by `/execute` (which performs `init` implicitly).

- [ ] **Step 1: Write the skill**

`project-executor/skills/exec-mem/SKILL.md`:

```markdown
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
```

- [ ] **Step 2: Verify frontmatter parses**

Run: `node -e "const s=require('fs').readFileSync('project-executor/skills/exec-mem/SKILL.md','utf8'); const m=s.match(/^---\n([\s\S]*?)\n---/); if(!m||!/name: exec-mem/.test(m[1])||!/description: /.test(m[1])) throw new Error('bad frontmatter'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add project-executor/skills/exec-mem
git commit -m "project-executor: /exec-mem memory maintenance skill"
```

---

### Task 5: /execute skill (router + flows)

**Files:**
- Create: `project-executor/skills/execute/SKILL.md`

**Interfaces:**
- Consumes: all four contracts in `spec/`; `/exec-mem` init operation; agent names `exec-runner`, `exec-browser`, `exec-instrumenter` (defined Task 6 — names fixed here).
- Produces: `/execute` entry point with flows `start | stop | test | build | full-test | repro`; the runid convention `r<YYYYMMDD><letter>`; the interactive-vs-agentic behaviour table used verbatim by the `executor` agent.

- [ ] **Step 1: Write the skill**

`project-executor/skills/execute/SKILL.md`:

```markdown
---
name: execute
description: Execute real actions on the local project using durable execution memory — start/stop the app, run tests and builds, run full end-to-end scenarios (including browser flows), and reproduce bugs with removable debug instrumentation. Produces an evidence-backed report. Use for "run the app", "run tests", "test this feature for real", "reproduce this bug", "check if X actually works locally".
---

# execute

Router + flows for real local execution. Contracts (in this plugin, read the ones
the flow needs): `spec/memory-contract.md`, `spec/evidence-contract.md`,
`spec/instrumentation-contract.md`, `spec/report-contract.md`.

## Setup (every invocation)

1. Memory init check: if `.claude-memory/executions/runbook.md` missing, run
   /exec-mem `init` first. Cold-start read = schema files only.
2. Choose `runid` = `r<YYYYMMDD><letter>` (letter = first unused today, check reports/).
3. Create report dir `reports/<YYYY-MM-DD-slug>/` with `logs/` and `screenshots/`.
4. Crash-heal: grep repo for `EXEC-TRACE:` — orphaned tags from a dead session ⇒
   run the strip protocol for that runid before anything else.

## Mode

Interactive (a human invoked the skill) vs agentic (running inside the `executor`
agent). Differences:

| Concern | Interactive | Agentic |
|---|---|---|
| Risky actions (kill process, wipe/seed data) | ask first | proceed per runbook; record in report |
| New credentials discovered | ask before saving to data.md | never save; flag in report |
| Ambiguous request | ask | best-match; record interpretation in report |
| Unclean instrumentation strip | show diff, ask | report `cleanliness: unclean`, stop |

## Router

Classify the request: start | stop | test | build | full-test | repro.
"Is it running / does X work for real" → full-test. "Why/when does X break",
bug ticket, "reproduce" → repro. State the classification in one line before acting.

## Orchestration rule (all flows)

Main model = decisions, memory, conclusions, report. Mechanical work → subagents
per `spec/evidence-contract.md`:
- `exec-runner` (haiku) — run one command, watch readiness, distill.
- `exec-browser` (sonnet) — drive one browser flow, screenshot, distill.
- `exec-instrumenter` (sonnet) — inject/strip tagged log lines.
Never paste raw logs into your own context; read raw artifact files only when
evidence is insufficient.

## Flows

### start / stop
1. Find `## start:<svc>` / stop info in runbook.md. Stale (>14d) ⇒ verify-while-using:
   run it, and on success re-stamp.
2. Spawn `exec-runner` with: exact command, cwd, readiness check, timeout, report
   dir, runid. Long-running processes: run detached/background; record PID + port
   in `logs/processes.json`.
3. Stop = runbook stop command; fallback kill-by-port (POSIX: `lsof -ti:<port> | xargs kill`;
   Windows: `Get-NetTCPConnection -LocalPort <port> | ... | Stop-Process`).
4. No runbook entry ⇒ DISCOVERY: inspect package.json / docker-compose / Makefile /
   README, propose an entry, verify by actually running it, save with fresh
   `verified:` stamp, journal the discovery.

### test / build
1. Runbook command via `exec-runner`. Evidence: exit code, pass/fail counts,
   first failures verbatim, full-log path.
2. On failure classify: ENV issue (check gotchas.md → fix → retry once → journal
   the resolution) vs PRODUCT failure (report verdict `fail` with evidence).

### full-test
1. Ensure app up (start flow). 2. Seed per data.md if scenario needs it.
3. Execute scenario: CLI/API steps via `exec-runner`; UI steps via `exec-browser`
   using browser.md routines when they exist. 4. Each step → evidence + artifacts.
5. Verdict pass/fail per the scenario's expected outcomes.

### repro
1. Parse repro steps from the request; if absent, derive candidates from the bug
   description + gotchas.md trace-points, state your plan.
2. Pick observation points (files/lines/values). Prefer proven `trace-point:` entries.
3. `exec-instrumenter`: snapshot + registry + inject per instrumentation contract.
4. Ensure app running with instrumentation.
5. Execute repro steps (runner/browser). Collect trace lines (grep logs for the
   runid tag), screenshots, console/network evidence.
6. Reproduced? Deterministic? If unclear, run the scenario a second time and diff
   the traces (2 runs default).
7. STRIP per contract. Gate: no report while registry non-empty.
8. Verdict reproduced/not-reproduced; root-cause hypothesis in Conclusions.

## Wrap-up (every flow)

1. Journal → distill into schema files per memory contract.
2. Write report per `spec/report-contract.md` (frontmatter exact).
3. Interactive: print report path + verdict + 3-line summary.
```

- [ ] **Step 2: Verify frontmatter + required sections**

Run: `node -e "const s=require('fs').readFileSync('project-executor/skills/execute/SKILL.md','utf8'); ['## Router','## Flows','### repro','exec-runner','exec-browser','exec-instrumenter','EXEC-TRACE'].forEach(k=>{if(!s.includes(k)) throw new Error('missing '+k)}); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add project-executor/skills/execute
git commit -m "project-executor: /execute router skill with all flows"
```

---

### Task 6: Agent definitions (3 subagents + executor)

**Files:**
- Create: `project-executor/agents/exec-runner.md`
- Create: `project-executor/agents/exec-browser.md`
- Create: `project-executor/agents/exec-instrumenter.md`
- Create: `project-executor/agents/executor.md`

**Interfaces:**
- Consumes: `spec/evidence-contract.md` reply format; `spec/instrumentation-contract.md` registry/strip; `/execute` skill (executor agent invokes it in agentic mode).
- Produces: agent names exactly `exec-runner`, `exec-browser`, `exec-instrumenter`, `executor` (as referenced by Task 5).

- [ ] **Step 1: Write exec-runner**

`project-executor/agents/exec-runner.md`:

```markdown
---
name: exec-runner
description: Mechanical command executor for project-executor. Runs ONE command (start/stop/test/build/seed/probe) with a readiness check, captures output to files, and returns distilled evidence only. Spawned by /execute or the executor agent — not for direct human use.
model: haiku
tools: Bash, Read, Write, Grep, Glob
---

You run exactly one command and report evidence. You make NO decisions about
what to run — the caller gives you everything.

Required inputs from caller (refuse with status: blocked if missing): command,
cwd, timeout, readiness check (exit code | port | URL | log pattern | "none"),
report dir absolute path, runid.

Procedure:
1. Run the command from cwd. Long-running service: run in background, then poll
   the readiness check until success or timeout.
2. Write FULL raw output to `<report-dir>/logs/<runid>-<short-label>.log` — always,
   including on success.
3. If a background process was started: append `{pid, port, command}` to
   `<report-dir>/logs/processes.json`.
4. Reply with the Evidence Contract format (plugin `spec/evidence-contract.md`):
   status / exit_code / summary / key_output (≤20 lines: error excerpts, counts,
   readiness result) / artifacts / anomalies. HARD LIMIT 50 lines total.

Never: edit source files, run extra exploratory commands beyond the given one
plus its readiness probe, or paste more than 20 raw output lines.
```

- [ ] **Step 2: Write exec-browser**

`project-executor/agents/exec-browser.md`:

```markdown
---
name: exec-browser
description: Mechanical browser-flow driver for project-executor. Executes ONE described UI flow via playwright tools, captures screenshots and console/network evidence, returns distilled step-by-step evidence. Spawned by /execute or the executor agent — not for direct human use.
model: sonnet
---

You execute one browser flow and report evidence. The caller decides WHAT to
test; you decide only the mechanics of driving it.

Required inputs (refuse with status: blocked if missing): flow description as
numbered steps (or a browser.md routine block verbatim), base URL, auth
instructions (or "none"), expected outcome per step where known, report dir,
runid.

Procedure:
1. Use playwright MCP tools (browser_navigate, browser_snapshot, browser_click,
   browser_fill_form, browser_console_messages, browser_network_requests,
   browser_take_screenshot). Prefer snapshot+role-based targeting over brittle
   CSS selectors; when a browser.md selector fails, find the element via snapshot
   and NOTE the working selector in your reply (caller updates browser.md).
2. Screenshot at each meaningful step → `<report-dir>/screenshots/<runid>-step<N>-<label>.png`.
3. On unexpected state: capture screenshot + console messages, mark the step
   failed, continue to next independent step if any, else stop.
4. Dump full console log + failed network requests to `<report-dir>/logs/<runid>-browser.log`.
5. Reply with Evidence Contract format; key_output = per-step one-liners:
   `step 3: FAIL — expected cart badge '2', saw '1' (screenshot step3)`. ≤50 lines.

Never: invent test data (caller supplies it from data.md), retry a failed step
more than once, or navigate outside the app under test.
```

- [ ] **Step 3: Write exec-instrumenter**

`project-executor/agents/exec-instrumenter.md`:

```markdown
---
name: exec-instrumenter
description: Mechanical debug-log injector/stripper for project-executor. Inserts tagged EXEC-TRACE log lines at caller-specified locations, maintains the instrumentation registry, and strips tags idempotently with git-diff verification. Spawned by /execute — not for direct human use.
model: sonnet
tools: Read, Edit, Write, Bash, Grep, Glob
---

You perform instrumentation edits per the plugin's `spec/instrumentation-contract.md`.
The caller decides WHERE and WHAT to capture; you execute edits precisely.

## Mode: inject
Inputs: runid, report dir, list of {file, location description or line, what to
capture}. Procedure:
1. If `<report-dir>/pre-injection-diff.patch` missing: create it from
   `git diff -- <all target files>` (may be empty).
2. For each point: insert ONE new log line in the file's existing logging idiom
   (match surrounding code style), containing `[EXEC-TRACE:<runid>:<seq>]`, seq
   zero-padded and unique. Never modify existing lines.
3. After EVERY insertion update `<report-dir>/instrumentation-registry.json`
   (shape per contract) BEFORE moving to the next point.
4. Reply (Evidence Contract): list of injected points file:line + tag, anomalies
   (e.g. "location ambiguous, chose X — verify").

## Mode: strip
Inputs: runid, report dir. Procedure:
1. Grep ENTIRE repo for `EXEC-TRACE:<runid>` (registry may be incomplete after a crash).
2. Remove each matching line exactly (the whole inserted line, nothing else).
3. Verify: `git diff -- <files from registry + grep hits>` must byte-match
   `pre-injection-diff.patch`. Match ⇒ set registry entries to []. Mismatch ⇒
   DO NOT attempt fixes: reply status: fail with the residual diff inline (this
   diff is the one exception allowed to exceed key_output limits, cap 100 lines).
4. Reply: files touched, tags removed count, verification result.

Never: refactor, fix bugs you notice (mention in anomalies), touch files not in
your instruction/grep hits, or force-restore from the patch.
```

- [ ] **Step 4: Write executor (main agent)**

`project-executor/agents/executor.md`:

```markdown
---
name: executor
description: Pipeline-facing execution agent for project-executor. Give it an execution request (run tests, full-test a scenario, reproduce a bug) and it runs the full /execute flow in AGENTIC mode against the local project, then returns the report path + verdict + one-paragraph summary. For programmatic callers (other agents, workflows); humans should use /execute directly.
---

You are the project-executor main agent, running in AGENTIC mode.

1. Invoke the `execute` skill of the project-executor plugin and follow it
   completely, applying the AGENTIC column of its mode table: no questions —
   proceed per runbook conventions, record every interpretation and risky action
   in the report, never save new credentials, stop with `cleanliness: unclean`
   rather than force-cleaning.
2. Orchestrate subagents (exec-runner, exec-browser, exec-instrumenter) exactly
   as the skill directs; enforce the evidence contract on their replies.
3. Your FINAL message (per spec/report-contract.md) is exactly:
   - report path (absolute)
   - `verdict: <value>` on its own line
   - one paragraph (≤5 sentences) summary
   Nothing else — callers parse this.
If the request is not an execution task, reply `verdict: blocked` and say why.
```

- [ ] **Step 5: Verify all four agents parse**

Run: `node -e "const fs=require('fs'); ['exec-runner','exec-browser','exec-instrumenter','executor'].forEach(n=>{const s=fs.readFileSync('project-executor/agents/'+n+'.md','utf8'); const m=s.match(/^---\n([\s\S]*?)\n---/); if(!m||!m[1].includes('name: '+n)) throw new Error(n)}); console.log('OK')"`
Expected: `OK`

- [ ] **Step 6: Commit**

```bash
git add project-executor/agents
git commit -m "project-executor: executor agent + 3 mechanical subagents"
```

---

### Task 7: Fixture app, acceptance checklist, full README, version finalize

**Files:**
- Create: `project-executor/fixtures/hello-svc/package.json`
- Create: `project-executor/fixtures/hello-svc/server.js`
- Create: `project-executor/fixtures/hello-svc/server.test.js`
- Create: `project-executor/fixtures/ACCEPTANCE.md`
- Modify: `project-executor/README.md` (replace stub)

**Interfaces:**
- Consumes: everything — the fixture exercises init, discovery, start, test, repro, strip, report.
- Produces: a runnable acceptance path for verifying the plugin end-to-end.

- [ ] **Step 1: Write fixture app**

`project-executor/fixtures/hello-svc/package.json`:

```json
{
  "name": "hello-svc",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "test": "node --test"
  }
}
```

`project-executor/fixtures/hello-svc/server.js`:

```javascript
// Tiny service with a deliberate bug for repro-flow acceptance testing:
// /add?a=1&b=2 returns string concat "12" instead of 3 (missing Number()).
const http = require('http');

function add(a, b) {
  return a + b; // BUG: a and b arrive as strings from the query
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') {
    res.writeHead(200); res.end('ok'); return;
  }
  if (url.pathname === '/add') {
    const result = add(url.searchParams.get('a'), url.searchParams.get('b'));
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ result }));
    return;
  }
  res.writeHead(404); res.end();
});

server.listen(process.env.PORT || 3123, () =>
  console.log(`hello-svc listening on ${process.env.PORT || 3123}`));

module.exports = { add };
```

`project-executor/fixtures/hello-svc/server.test.js`:

```javascript
const { test } = require('node:test');
const assert = require('node:assert');
const { add } = require('./server');

test('add adds numbers', () => {
  assert.strictEqual(add(1, 2), 3); // passes with numbers — bug only bites via HTTP
});
```

- [ ] **Step 2: Verify fixture runs**

Run: `cd project-executor/fixtures/hello-svc && npm test`
Expected: 1 test pass. Then `node -e "const {add}=require('./server'); console.log(add('1','2'))"` → `12` (bug confirmed present for repro testing).

- [ ] **Step 3: Write acceptance checklist**

`project-executor/fixtures/ACCEPTANCE.md`:

```markdown
# project-executor acceptance (manual, agent-driven)

Run each scenario in a FRESH Claude Code session with cwd = fixtures/hello-svc.
Pass criteria in parentheses.

1. Cold discovery: `/execute start the app`
   (memory initialized; .gitignore guard applied; discovery finds `npm start`,
   probes /health, saves runbook `start:hello-svc` with today's verified: stamp;
   report verdict pass; process recorded and stopped or left per user choice)
2. Warm start: repeat in new session
   (runbook entry used directly — no discovery; exec-runner spawned; report written)
3. Tests: `/execute run the tests`
   (verdict pass, counts in report, raw log artifact exists)
4. Staleness: hand-edit runbook verified: to 30 days ago → `/exec-mem verify`
   (entry re-verified, stamp updated to today)
5. Repro: `/execute reproduce: GET /add?a=1&b=2 returns "12" instead of 3`
   (instrumentation injected in add(); registry populated; 2 runs traced;
   verdict reproduced; root-cause hypothesis names string concat / missing
   Number(); tags stripped; `git diff` clean; cleanliness: clean)
6. Crash-heal: manually inject a line with tag `[EXEC-TRACE:rDEADBEEF:001]`
   into server.js → `/execute run the tests`
   (setup step detects orphan, strips it before running)
7. Agentic entry: spawn the `executor` agent with request from scenario 5
   (final message = report path + verdict line + one paragraph; no questions asked)
8. Memory quality: after 1-7, `/exec-mem show`
   (schema files short, stamps current, journal distilled, no raw dumps)
```

- [ ] **Step 4: Replace README stub**

`project-executor/README.md`:

```markdown
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
```

- [ ] **Step 5: Full-tree verification**

Run: `node -e "const fs=require('fs'); const need=['project-executor/.claude-plugin/plugin.json','project-executor/skills/execute/SKILL.md','project-executor/skills/exec-mem/SKILL.md','project-executor/agents/executor.md','project-executor/agents/exec-runner.md','project-executor/agents/exec-browser.md','project-executor/agents/exec-instrumenter.md','project-executor/spec/memory-contract.md','project-executor/spec/evidence-contract.md','project-executor/spec/instrumentation-contract.md','project-executor/spec/report-contract.md','project-executor/fixtures/ACCEPTANCE.md']; need.forEach(f=>{if(!fs.existsSync(f)) throw new Error(f)}); console.log('ALL PRESENT')"`
Expected: `ALL PRESENT`

- [ ] **Step 6: Commit**

```bash
git add project-executor
git commit -m "project-executor: fixture app, acceptance checklist, README (v0.1.0 complete)"
```

---

## Post-plan note

Milestone mapping from the spec: M1 = Tasks 1-4, M2+M3+M4 flows = Task 5 (contracts split into 2-3), M5 = Task 6, testing = Task 7. Acceptance scenarios (Task 7) are agent-driven manual runs — execute them in a real session after implementation; they are the true test suite for a docs-driven plugin.
