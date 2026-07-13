---
name: observer
description: Post-work audit and self-improvement loop for the plugin suite. Use when the user runs /observe, asks to audit the session, asks "what went wrong / what can improve", or at tasks-manager wrap-up when offered. Mines the session transcript + artifacts, maps friction to plugin rules, and proposes user-gated patches to plugin source.
---

# Observer

Audit what actually happened against what the suite's plugins prescribe; turn
findings into concrete unified-diff patches to plugin source in the
claude-plugins repo. Plugins there are unpublished and user-owned — the repo is
the mutable prompt layer, so approved patches are committed and the plugin is
reactivated.

Scope of patch targets: plugins inside the claude-plugins repo ONLY (including
`orchestrator/index-rules.md`). CLAUDE.md files, global settings, other repos:
out of scope — surface findings there as suggestions, never patch.

## 1. GATHER

- Run `node ${CLAUDE_PLUGIN_ROOT}/bin/mine-transcript.js` (flags: `--all` for
  today's sessions, `--session <path>`, `--dir <path>`). It prints a compact
  digest — errors & retry chains, permission denials, user-correction
  heuristics, plugin usage, hook errors, stats. Do NOT read raw transcript
  JSONL into context; the digest is the interface.
- Read artifacts, when present:
  - `.claude-memory/tasks/<slug>.md` journals — outcome vs stated goal
  - `.claude-memory/worktrees.md` — worktree laws followed?
  - research memory docs — grounding kept, citations intact?
  - `git log` for the session window — commit hygiene, repo-policy adherence
- Cloud/background agents leave no local transcript — audit their artifacts
  and outputs only. That is the designed degradation path, not a failure.

## 2. DIAGNOSE

For each candidate finding, name all three or drop it:
- **Rule**: plugin + file + the specific rule that failed, is missing, or is ambiguous
- **Evidence**: digest line, artifact, or git ref
- **Class**: rule-violated | rule-missing | rule-ambiguous |
  rule-correct-but-ignored (a routing/trigger problem — usually patch the
  skill description or `orchestrator/index-rules.md`)

Evidence bar is hard: no concrete evidence → no finding. "No findings" is a
valid, expected outcome. Never invent patches to look productive.

## 3. PROPOSE (gated — always)

- Check `.claude-memory/observer-log.md` for recurrence; annotate ("2nd
  occurrence; first 2026-07-01, patch rejected then").
- Present ONE review table for the whole audit:
  finding | evidence | proposed diff | expected effect | recurrence.
- Diffs are unified diffs against plugin files. Keep each patch minimal — one
  finding, one patch.
- User approves per-patch (AskUserQuestion, multiSelect). No approval → no edit.

## 4. APPLY

- Apply approved diffs. If a target file changed since the diff was drafted,
  re-read, re-derive, re-show if materially different.
- Commit to main (repo policy) — message: `observer: <plugin> — <finding slug>`.
- Behavioral change → bump the plugin's patch version in its `plugin.json` AND
  `.claude-plugin/marketplace.json`.
- Close with: "reinstall/reactivate `<plugin>` for the change to take effect".

## 5. RECORD

Append one row per finding — patched or not — to
`.claude-memory/observer-log.md` (create with header if missing):

```
# Observer log

| date | plugin | finding | evidence class | patched |
|------|--------|---------|----------------|---------|
```

Recurrence detection only — not a lessons store. Rejected findings may
resurface later with stronger evidence.

## Anti-noise rules

- Thin evidence → say "no findings", stop.
- One-off fluke with no recurrence → prefer recording over patching; propose a
  patch only when the fix is obviously right regardless of frequency.
- Never batch unrelated edits into one patch; never patch without the table
  step; never commit without per-patch approval.
