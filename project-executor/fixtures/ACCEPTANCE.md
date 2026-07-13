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
   (wiki pages short, index.md matches pages, stamps current, journal distilled,
   no raw dumps)
