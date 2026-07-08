---
description: Investigate how to run & test this repo locally and draft/refresh .workbench/RUNBOOK.md.
---

Build or refresh the **local run/test RUNBOOK** for the current repo. Use when the repo has no local
run/test notes yet (empty template), or the existing RUNBOOK has gone stale.

This is **investigation + interview, merged**. It does NOT fix a ticket and does NOT touch git
history. The orchestrator is the sole writer of `.workbench/RUNBOOK.md`.

1. **Investigate (agent, read-only + allowlisted probe).** Dispatch `repro-runner` to scan the
   run/test surface — `docker-compose*.yml` / Dockerfiles, CI configs, `Makefile`, `package.json`
   scripts, `pom.xml`/Gradle, run scripts, `README`/`CONTRIBUTING`/`docs/` — and optionally do a
   light, allowlisted build/test probe to see what actually works. It returns proposed **How to
   run**, **Run & verify command allowlist**, **Scaffold allowlist**, and **Gotchas** entries, each
   with `file:line` evidence.
2. **Interview the user** for what the repo can't reveal: how the env is really run day-to-day, which
   services are usually unavailable locally and safe to stub, known flaky/slow areas, auth/seed
   shortcuts. Capture answers **verbatim**, tagged as user-supplied (vs agent-inferred).
3. **Draft `.workbench/RUNBOOK.md`** from both sources using the template sections. Mark unverified
   entries so a later REPRODUCE confirms or repairs them. Show the draft; let the user edit and
   confirm before saving.
4. **Report in 2-3 lines:** what was inferred vs user-supplied, and whether a usable reproduce recipe
   now exists. If yes, offer to proceed to a ticket's reproduce step.
