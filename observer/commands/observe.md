---
description: Audit the session against plugin rules and propose gated patches to plugin source.
argument-hint: [plugin-name | task-slug]
---

Invoke the `observer` skill and run its audit protocol.

Arguments: `$ARGUMENTS` — optional scope:
- empty → full audit of the current session (transcript digest + artifacts)
- a plugin name (e.g. `worktrees`) → scope diagnosis to that plugin's surface
- a task slug → scope to that task's journal + related evidence

Steps: GATHER (mine-transcript digest + artifacts) → DIAGNOSE (rule/evidence/
class, hard evidence bar) → PROPOSE (one review table, per-patch approval) →
APPLY (commit + version bump + reactivation note) → RECORD (observer-log row
per finding). "No findings" is a valid outcome — report it plainly.
