---
updated: YYYY-MM-DD
---
# Local run & test runbook

> Living doc, **agent-maintained** (the orchestrator is the sole writer). Scaffolded empty on the
> first `/resolve` in this repo; it accretes know-how so later tickets go straight to the working
> pipeline instead of re-experimenting. Git-ignored (lives under `.workbench/`). One per clone,
> shared by every ticket. Prune entries that stop being true — current state, not a log.

## How to run locally
<!-- Exact commands to bring the stack up for testing. Services, env vars, ports, seed data,
     local auth shortcuts. One-liners with real commands. -->
- _(empty — filled on first reproduce)_

## Reproduce recipes (by area)
<!-- Per bug-class: the exact steps / request / fixture that triggers it. -->
- _(empty)_

## Run & verify command allowlist
<!-- SOURCE OF TR_RUN_ALLOW (design §13.4). Only commands matching these patterns may start
     services / long-running processes during REPRODUCE and VERIFY. Every long-running start must be
     backgrounded and have a teardown line. Anything not listed stays banned by the hard-ban hook. -->
- allow: _(none yet)_
- teardown: _(none yet)_

## Scaffold allowlist (temporary edits OK for local testing)
<!-- Design §13.5. Temporary code edits permitted ONLY to make the stack testable locally — stub a
     service, repoint a datasource, disable a heavy/slow bean. These go in `scaffold:` commits and
     are DROPPED before finalize. NEVER scaffold anything that changes the behavior under test. -->
- OK: _(none yet)_
- NOT OK: anything that alters the code path the ticket is about.

## System state & gotchas
<!-- What's flaky, what's slow, what's usually unavailable locally and should be stubbed. -->
- _(empty)_
