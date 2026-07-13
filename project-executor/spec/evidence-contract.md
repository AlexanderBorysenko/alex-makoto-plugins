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
