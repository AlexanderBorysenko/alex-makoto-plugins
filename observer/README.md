# observer

Self-improvement loop for the plugin suite. Audits what actually happened in a
session against what the suite's plugins prescribe, and turns findings into
concrete, user-gated unified-diff patches to plugin source in this repo —
approved patches are committed and the plugin reactivated. The repo is the
mutable prompt layer: plugins here are unpublished and free to evolve.

Adapted from the digicomply agent-factory Observer loop; per-session audit
replaces the old per-dispatch trigger (cheaper, and works for cloud/background
agents whose transcripts aren't observable — their artifacts are).

## Surface

- `/observe` — full session audit; `/observe <plugin>` or `/observe <task-slug>` — scoped.
- Offered automatically at tasks-manager wrap-up (when both plugins installed).

## How it works

1. **Gather** — [bin/mine-transcript.js](bin/mine-transcript.js) digests the
   session JSONL (errors & retries, permission denials, user corrections,
   plugin usage, hook errors; hard output cap) + reads artifacts: task
   journals, worktrees registry, research docs, session git log.
2. **Diagnose** — each finding must name the plugin rule + concrete evidence +
   failure class, or it's dropped. "No findings" is a valid outcome.
3. **Propose** — one review table; unified diffs; per-patch user approval.
4. **Apply** — commit (`observer: <plugin> — <finding>`), patch-version bump on
   behavioral change, reactivation note.
5. **Record** — one row per finding in `.claude-memory/observer-log.md`
   (recurrence detection only, not a lessons store).

## Scope guard

Patch targets: plugins in this repo only (incl. `orchestrator/index-rules.md`).
CLAUDE.md, global settings, other repos — suggestions only, never patched.
