---
description: Run the memory system wrap-up protocol — prune, update, cascade, report.
---

Invoke the `memory-system` skill and execute the **Wrap-up protocol** against the task(s) worked on this session.

Steps:
1. Identify the task worked on this session from conversation context — there is no `status: active` flag. If more than one task was touched, wrap up each. If the target is genuinely ambiguous, ask the user before editing. Use `node ${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js tasks` only to resolve the exact slug/path of the task in focus.
2. In its per-task journal: bump `updated:`, update `summary:` in frontmatter if focus shifted (this is what `mem-index` displays), prune superseded Findings, prune reversed Decisions (keeping rationale of current ones), update Open Questions, rewrite Next Steps so the first bullet is the immediate next action.
3. Link spoke documents: run `node ${CLAUDE_PLUGIN_ROOT}/bin/mem-index.js docs --task <slug>` and fold new links into the journal's Related Documents (link + one-line role note, never copied content). Stamp `task-slug: <slug>` into the frontmatter of any doc produced this session that belongs to the task but lacks it.
4. Cascade updates to Related Documents listed in the journal: plans, specs, architecture cache (narrative file). If components changed, create/rename/delete the relevant `./.claude-memory/arch/<component>.md` files. Do not edit spoke-owned documents (findings, reports, wiki pages) — their plugins own them.
5. Check Cross-task findings: if `.claude-research/` exists, promote overlapping findings there (researcher owns verified facts) and link; otherwise fall back to `./.claude-memory/findings/<topic>.md` (with `summary:` in frontmatter).
6. Verify and report in 2-3 lines: files updated + new first-bullet Next Step.
