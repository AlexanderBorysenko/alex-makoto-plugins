# researcher

Claude Code plugin: deterministic research orchestration. v0.3.0.

**Problem:** ad-hoc investigation — wrong tool per question, context sprawl, and the classic LLM failure of imagining logic that does not exist.

**Solution:** triage → route → execute → ground → persist.

- **Triage** every research question into L1 (lookup) / L2 (investigation) / L3 (deep research); level stated before executing.
- **Route** by table: Serena for symbols, graphify for structure, context-mode for big outputs, context7/firecrawl/WebSearch for external — respecting per-project availability in `.claude-research/config.md`.
- **Ground**: every claim cites `file:line` / tool output / finding; "not found" is a valid answer; READ vs ASSUMED separated; verify-gate checklist before answering.
- **Persist**: findings docs in `.claude-research/findings/` with git-HEAD staleness marking (`bin/research-index.js list`), consumable by architect/product-designer goggles via the "For goggles" section.
- **Wiki layer** (v0.3, Karpathy LLM-wiki pattern): findings stay the immutable raw evidence layer; `.claude-research/wiki/<topic>.md` pages compile the current truth per topic once 3+ findings share it. Pages link down to findings; **wiki = navigation, findings = evidence**. The index CLI lists both and propagates staleness from findings to pages.
- **Freshness** (v0.2): index freshness validated at session start and /research step 0. Free fixes run automatically — `graphify update .` (AST-only) when stale/unbaselined, graphify-out copy from the main repo root in git worktrees, serena onboarding. Paid fixes (fresh `graphify index .`) always ask and pin indexing subagents to haiku (sonnet on explicit quality request). Baseline marker: `graphify-out/.researcher-head`.

## Layout

- `hooks/session-start.js` — deterministic status block (≤10 lines): freshness per tool, auto-fix note, one-time /research-setup offer.
- `bin/freshness.js` — freshness assessment module + CLI (graphify staleness vs `.researcher-head` marker, worktree copy detection, serena onboarding state, store status).
- `skills/researcher/SKILL.md` — the workflow.
- `commands/research.md`, `commands/research-setup.md` — slash commands.
- `bin/research-index.js` — findings + wiki index with staleness propagation.
- `templates/` — config.md, research-index.md, finding.md, wiki-topic.md.

## Boundaries

- Orchestrates graphify/Serena/context-mode — does not wrap or replace them.
- `.claude-memory/` (memory-system plugin) = what we're doing; `.claude-research/` = what we verified true. No cross-writes.
- No silent expensive ops: graphify indexing always needs explicit approval.

## Tests

```
node researcher/tests/session-start.test.js
node researcher/tests/research-index.test.js
node researcher/tests/freshness.test.js
```

## Acceptance checklist (manual, per spec)

- [ ] /research on L1 question → triage line, Serena/graphify used, inline answer with pointer, nothing persisted.
- [ ] /research on L2 question → graphify query/path + Serena, evidence pointers on every claim.
- [ ] /research on L3 question → findings doc + INDEX line, "For goggles" section filled.
- [ ] Question about non-existent function → answer is "not found", not invented behavior.
- [ ] Session start in empty project → ≤10 lines, single /research-setup offer.
- [ ] Evidence file changed after finding written → `research-index.js list` shows `STALE?`.
- [ ] Commit after baseline marker → hook shows `graphify: stale (N files changed)` + auto-fix line; /research runs `graphify update .` without asking.
- [ ] Git worktree without graphify-out but main root has one → hook shows copyable; /research copies + updates instead of reindexing.
- [ ] Fresh `graphify index .` → approval asked, indexing subagents pinned to haiku.
- [ ] Third finding on one topic → wiki page created/updated; claims cite findings, not the page.
- [ ] Supporting finding goes stale → `research-index.js list` marks the wiki page `STALE?` too.
