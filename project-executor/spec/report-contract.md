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
      - screenshots/r20260711a-step3-login.png
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
