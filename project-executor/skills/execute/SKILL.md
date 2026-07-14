---
name: execute
description: Execute real actions on the local project using durable execution memory — start/stop the app, run tests and builds, run full end-to-end scenarios (including browser flows), and reproduce bugs with removable debug instrumentation. Produces an evidence-backed report. Use for "run the app", "run tests", "test this feature for real", "reproduce this bug", "check if X actually works locally".
---

# execute

Router + flows for real local execution. Contracts (in this plugin, read the ones
the flow needs): `spec/memory-contract.md`, `spec/evidence-contract.md`,
`spec/instrumentation-contract.md`, `spec/report-contract.md`.

## Setup (every invocation)

1. **Memory init check (BLOCKING).** If `.claude-memory/executions/runbook.md`
   is missing OR any of the five canonical pages (`env.md`, `runbook.md`,
   `data.md`, `browser.md`, `gotchas.md`) is missing, you MUST auto-run
   /exec-mem `init` immediately — do not proceed to step 2 until the wiki
   layout exists. Init is idempotent and takes <1s. Do NOT fall back to raw
   Bash/Docker for start/test/repro when init is the correct next step; the
   whole point of /execute is durable memory. Cold-start read after init =
   `index.md`, then only the wiki pages the flow needs (never journal/reports).
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
| Browser flow, no `## auth-strategy` in browser.md, app needs auth | negotiate strategy with user (see Browser auth) | return blocked — never invent auth |

Absent an explicit agentic directive from the `executor` agent, treat the invocation as interactive.

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

### pre-flight (ALL flows, before any probe)
Read gotchas.md + env.md + the relevant browser.md routine FIRST. If a
documented gotcha names the target environment as blocked (auth wall, dead
dependency, missing key), surface the blocker to the caller immediately with
unblock options — zero probing. A documented blocker rediscovered by probing
is wasted budget.

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
2a. **Backend-readiness probe (before the FIRST `exec-browser` dispatch):** if
   the scenario depends on a backend capability with a cheap probe (an endpoint
   named in env.md/gotchas.md — e.g. a warm-data GET like
   `/embeddings/<id>/single-summary-stream`), spawn `exec-runner` to curl it
   first (seconds). Probe cold/404/5xx ⇒ verdict `blocked` with the probe as
   evidence — never burn a browser flow discovering what a curl already proved.
3. Execute scenario: CLI/API steps via `exec-runner`; UI steps via `exec-browser`
   using browser.md routines when they exist. 4. Each step → evidence + artifacts.
5. Verdict pass/fail per the scenario's expected outcomes. When the scenario
   verifies a UI change, the `exec-browser` dispatch MUST carry the
   target-surface precondition (URL pattern + container selector) and the pass
   verdict MUST cite its per-surface DOM confirmation — a screenshot of a
   similar-looking element on another surface is a false PASS.

### Browser auth (gate before any UI step)

Before the FIRST `exec-browser` dispatch of a run, read `browser.md`
`## auth-strategy` (spec: memory-contract.md, Browser auth strategy).

- Block exists ⇒ pass it to `exec-browser` (state file path / profile dir /
  api-login steps). Stale or expired state ⇒ rerun the linked login routine
  first, refresh the state file, re-stamp.
- No block and app needs auth ⇒ BLOCKING (interactive): propose options ranked
  by speed — api-login > storageState > persistent-profile > manual-handoff —
  agree with the user, execute the login once, save the state artifact under
  `.claude-memory/executions/.auth/`, write the `## auth-strategy` block.
  Agentic ⇒ blocked.
- After every browser flow, fold what exec-browser learned (working selectors,
  async gotchas) into `browser.md` `## page:<route>` blocks at distillation —
  next run must not re-discover the same UI.

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

1. Journal → distill into the wiki per memory contract (update/supersede
   entries, regenerate `index.md`).
2. Write report per `spec/report-contract.md` (frontmatter exact).
3. Interactive: print report path + verdict + 3-line summary.
