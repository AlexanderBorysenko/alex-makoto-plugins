# project-executor — Design Spec

Date: 2026-07-11
Status: approved-pending-review

## Purpose

A Claude Code plugin that acts as the "hands" for running, testing, and observing a project on the local environment. It maintains durable per-project execution memory (how to start the app, test it, seed it, what breaks and why), executes real runs (app lifecycle, tests, builds, browser flows, bug reproductions), instruments code with removable debug logs to capture real system behaviour, and produces clean evidence-backed reports. Designed to be used both interactively by a human and programmatically by other agents/pipelines (e.g. architect-goggles, future orchestrators).

Part of the new scoped plugin family (alongside architect-goggles). `memory-system` and `ticket-resolver` are legacy and are NOT dependencies. `.claude-memory/` is the standard output location for this plugin family; project-executor owns `.claude-memory/executions/`.

## Decisions (locked during brainstorming)

1. **Consumer**: both human-interactive and agent-callable, first-class from v1 (option C).
2. **Scope**: full capability set in one spec — memory, lifecycle, tests/builds, browser testing, debug-log instrumentation, bug repro, reporting, subagent orchestration (option D). Implementation staged in milestones.
3. **Memory**: hybrid — fixed schema files + append-only journal, distilled into schema files at report time (option C). Every runbook entry carries a `verified: YYYY-MM-DD` stamp; stale entries (default > 14 days) are re-verified before being trusted.
4. **Orchestration**: fixed roles (option B). Main model decides/concludes/updates memory/reports. Haiku subagents for pure mechanical runs; Sonnet subagents for judgment-lite mechanical work (browser driving, log injection). Subagents return distilled evidence only (≤ 50 lines); raw output goes to files.
5. **Instrumentation**: marker-tagged inline edits (option A) with git-diff snapshots as insurance and an instrumentation registry for idempotent cleanup.
6. **Entry surface**: hybrid (option C) — `/execute` smart router + `/exec-mem` memory-maintenance skill + `executor` agent type for pipelines.

## Architecture

```
project-executor/
├── .claude-plugin/plugin.json
├── skills/
│   ├── execute/SKILL.md        # /execute — smart router (run|test|repro|start|stop|full-test)
│   └── exec-mem/SKILL.md       # /exec-mem — inspect/edit/verify execution memory
├── agents/
│   ├── executor.md             # main agent — pipelines spawn this, returns report path + verdict
│   ├── exec-runner.md          # haiku: run command, capture output, distill evidence
│   ├── exec-browser.md         # sonnet: drive playwright flow, screenshots, distill
│   └── exec-instrumenter.md    # sonnet: inject/strip tagged debug logs at named points
└── hooks/                      # none in v1; /execute loads memory itself
```

### Role split

- **Main model** (skill invoker or `executor` agent): request classification, discovery reasoning, choice of observation points, retry/rollback decisions, journal distillation, memory updates, conclusions, report writing.
- **exec-runner (haiku)**: run one command, watch output/readiness, return structured evidence: exit code, pass/fail counts, first N error excerpts, paths to full logs.
- **exec-browser (sonnet)**: execute a described playwright flow using `browser.md` knowledge (auth, selectors), capture screenshots and console/network evidence, return distilled step-by-step result. Haiku is deliberately not used here — selector/flow handling needs more capability.
- **exec-instrumenter (sonnet)**: given exact files/locations/what-to-capture from the main model, inject or strip tagged log lines; maintain the registry.

**Evidence rule (non-negotiable)**: subagents never return raw dumps. Distilled evidence ≤ 50 lines; full raw output written to the current report directory.

## Memory layout

```
.claude-memory/executions/
├── env.md          # services, ports, prereqs, OS quirks, required env vars
├── runbook.md      # verified commands: start/stop/build/test/seed — each with `verified: YYYY-MM-DD`
├── data.md         # seeds, mock data patterns, test users + local credentials
├── browser.md      # base URLs, auth flow, stable selectors, known-good playwright routines
├── gotchas.md      # failure → resolution pairs; proven instrumentation points
├── journal/        # raw dated observations appended during runs
└── reports/<YYYY-MM-DD-slug>/
    ├── report.md
    ├── screenshots/
    ├── logs/
    ├── pre-injection-diff.patch        # git snapshot of instrumented files
    └── instrumentation-registry.json
```

Rules:
- **Cold start**: read schema files only (env, runbook, data, browser, gotchas). Journal is not read on cold start.
- **During run**: every new discovery (port change, missing prereq, flaky step, resolution of an env issue) is appended to `journal/` immediately.
- **Report phase**: main model distills journal entries into schema files, prunes stale/contradicted entries, re-stamps `verified:` on anything re-confirmed this run.
- **Staleness**: runbook entries older than 14 days are re-verified (cheaply — run and check readiness) before being trusted; stamp updated on success, entry corrected or moved to gotchas on failure.
- **Secrets**: `data.md` may hold local-only test credentials. Plugin init ensures `.claude-memory/executions/` is in `.gitignore` and warns if the repo would commit it.

## Execution flows (`/execute` router)

Router classifies the free-form request into a flow. Unknown/ambiguous requests: interactive mode asks; agentic mode picks best match and records the interpretation in the report.

### start / stop (capability b)
- Read `runbook.md`; spawn `exec-runner` with the exact command plus a readiness check (port probe / health URL / log pattern from memory).
- Background processes run detached; PID/port recorded in the report dir. Stop = graceful command from runbook, fallback kill-by-port.
- **Discovery mode** (no runbook entry): main model investigates (package.json, docker-compose, README, scripts), proposes a runbook entry, verifies it by actually running it, then saves with a fresh `verified:` stamp.

### test / build (capability c)
- Runbook command via `exec-runner`. Evidence: pass/fail counts, first N failures verbatim, full log path.
- On failure the main model classifies: environment issue (consult `gotchas.md`, fix, retry) vs real product failure (report it).

### full-test (capability e)
- Compose: ensure app up → seed data per `data.md` → execute scenario (CLI, API calls, or browser via `exec-browser`) → collect evidence → report.
- Scenarios come from the user request or saved routines in `browser.md`.

### repro (capability g) — bug reproduction protocol
1. Parse repro instructions; if absent, derive candidate steps from the bug description.
2. Main model selects observation points (files/locations/values to capture).
3. `exec-instrumenter` injects tagged logs.
4. Ensure app running with instrumentation active.
5. Execute repro steps (`exec-runner` or `exec-browser`).
6. Collect traces, screenshots, console/network evidence.
7. Analyze: reproduced? deterministic? If unclear, repeat the run (2 runs default) and compare traces.
8. Strip instrumentation (see protocol below).
9. Report + memory update.

All flows: new env discoveries → journal; failed-then-resolved issues → `gotchas.md`.

## Instrumentation protocol (capability f)

- **Tag format**: `[EXEC-TRACE:<runid>:<seq>]` embedded in a language-appropriate log statement (`console.log`, `logger.debug`, `print`, …).
- **Before injection**: `git diff` snapshot of target files saved to the report dir (`pre-injection-diff.patch`). Registry (`instrumentation-registry.json`) records file, line, tag, purpose for every injected line.
- **Injection**: main model specifies where and what to capture; `exec-instrumenter` performs the edits.
- **Strip**: grep the whole repo for `EXEC-TRACE:<runid>`, remove those lines, then verify the tree diff matches the pre-injection snapshot. On mismatch: interactive → stop and show the diff, ask; agentic → mark report `cleanliness: unclean` with details, never force-restore.
- **Idempotent**: cleanup is rerun-safe; a crashed session self-heals on the next run (registry + repo-wide tag grep).
- **Gate**: the report phase is blocked while the instrumentation registry is non-empty.
- Proven-useful observation points are saved to `gotchas.md` (e.g. "session bugs trace best at middleware/session.ts:40").

## Reporting (capability h)

`reports/<date-slug>/report.md`, with YAML frontmatter mirroring the key fields for machine consumption:

```markdown
---
verdict: reproduced | not-reproduced | pass | fail | blocked
task: <short title>
started: <iso>
finished: <iso>
artifacts:
  - screenshots/step-3-login.png
  - logs/full-test-run.log
cleanliness: clean | unclean
---
# <Task title>
## What ran            — scenarios, commands, env state (versions, ports)
## Observed behaviour  — deterministic facts from traces/logs, per step
## Evidence            — links to screenshots/logs; short trace excerpts inline
## Conclusions         — analysis, root-cause hypothesis if repro
## Memory updates      — what was learned/saved this run
## Cleanliness         — instrumentation stripped: yes/no, tree state
```

The `executor` agent's final output to a pipeline caller = report path + verdict (+ one-paragraph summary).

## Interactive vs agentic behaviour differences

| Concern | Interactive (skill) | Agentic (`executor` agent) |
|---|---|---|
| Risky actions (kill process, seed/wipe data) | ask first | proceed per runbook conventions; record in report |
| Saving credentials to `data.md` | ask first | never auto-save new credentials; flag in report |
| Ambiguous request | ask | best-match + record interpretation |
| Unclean strip | show diff, ask | report `cleanliness: unclean`, stop |

## Error handling

- Subagent failure/timeout: main model retries once with adjusted instructions; second failure → recorded in report, flow continues if the step is non-critical, otherwise verdict `blocked`.
- App won't start per runbook: consult `gotchas.md` → discovery mode → if still failing, verdict `blocked` with evidence.
- Memory contradiction discovered mid-run (e.g. wrong port): fix live, journal it, distill at report phase.

## Testing the plugin itself

- Fixture mini-projects (tiny node/express app with tests, one with a frontend page) under a test folder or separate sandbox repo.
- Scenario checks: cold-start discovery builds a correct runbook; stale-entry re-verification; repro flow injects and cleanly strips instrumentation (tree diff empty); report frontmatter parses; `/exec-mem` edits survive a following `/execute`.
- Manual acceptance: run `/execute` against a real project of the author's; verify memory quality after 2-3 sessions.

## Milestones (single spec, staged implementation)

1. **M1 — Skeleton + memory**: plugin manifest, `/exec-mem`, memory init (+ .gitignore guard), schema file formats, journal, cold-start read discipline.
2. **M2 — Lifecycle + tests**: `/execute` router, `exec-runner`, start/stop/test/build flows, discovery mode, evidence rule, basic report.
3. **M3 — Browser**: `exec-browser`, `browser.md`, full-test flow with screenshots.
4. **M4 — Instrumentation + repro**: `exec-instrumenter`, tag protocol, registry, strip gate, repro flow, determinism re-runs.
5. **M5 — Agent entry + polish**: `executor` agent for pipelines, agentic behaviour table, report frontmatter contract, fixture-based scenario tests.

## Out of scope (v1)

- Remote/CI environments — local only.
- Secret managers/encryption for `data.md` — gitignore + local-only convention.
- SessionStart hook auto-loading memory — `/execute` loads what it needs.
- Cross-project shared memory — strictly per-project.
