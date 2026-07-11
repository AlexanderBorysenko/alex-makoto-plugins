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
