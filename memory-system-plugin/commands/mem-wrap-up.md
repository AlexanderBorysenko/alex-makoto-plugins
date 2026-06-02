---
description: Run the memory system wrap-up protocol — prune, update, cascade, report.
---

Invoke the `memory-system` skill and execute the **Wrap-up protocol** against the task(s) worked on this session.

Steps:
1. Identify the task worked on this session from conversation context — there is no `status: active` flag. If more than one task was touched, wrap up each. If the target is genuinely ambiguous, ask the user before editing. Use `node ${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js tasks` only to resolve the exact slug/path of the task in focus.
2. In its per-task journal: bump `updated:`, update `summary:` in frontmatter if focus shifted (this is what `mem-index` displays), prune superseded Findings, prune reversed Decisions (keeping rationale of current ones), update Open Questions, rewrite Next Steps so the first bullet is the immediate next action.
3. Cascade updates to Related Documents listed in the journal: plans, specs, architecture cache (narrative file). If components changed, create/rename/delete the relevant `./.claude-memory/arch/<component>.md` files.
4. Check Cross-task findings: if any Finding in the wrapped-up task overlaps a finding in another open/recent task, promote to `./.claude-memory/findings/<topic>.md` (with `summary:` in frontmatter) and link.
5. Verify and report in 2-3 lines: files updated + new first-bullet Next Step.
