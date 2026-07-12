# researcher

Claude Code plugin: deterministic research orchestration. v0.1.0.

**Problem:** ad-hoc investigation — wrong tool per question, context sprawl, and the classic LLM failure of imagining logic that does not exist.

**Solution:** triage → route → execute → ground → persist.

- **Triage** every research question into L1 (lookup) / L2 (investigation) / L3 (deep research); level stated before executing.
- **Route** by table: Serena for symbols, graphify for structure, context-mode for big outputs, context7/firecrawl/WebSearch for external — respecting per-project availability in `.claude-research/config.md`.
- **Ground**: every claim cites `file:line` / tool output / finding; "not found" is a valid answer; READ vs ASSUMED separated; verify-gate checklist before answering.
- **Persist**: findings docs in `.claude-research/findings/` with git-HEAD staleness marking (`bin/research-index.js list`), consumable by architect/product-designer goggles via the "For goggles" section.

## Layout

- `hooks/session-start.js` — deterministic detection (graphify-out, .serena, .claude-research), ≤10-line status block, one-time /research-setup offer.
- `skills/researcher/SKILL.md` — the workflow.
- `commands/research.md`, `commands/research-setup.md` — slash commands.
- `bin/research-index.js` — findings index + staleness CLI.
- `templates/` — config.md, research-index.md, finding.md.

## Boundaries

- Orchestrates graphify/Serena/context-mode — does not wrap or replace them.
- `.claude-memory/` (memory-system plugin) = what we're doing; `.claude-research/` = what we verified true. No cross-writes.
- No silent expensive ops: graphify indexing always needs explicit approval.

## Tests

```
node researcher/tests/session-start.test.js
node researcher/tests/research-index.test.js
```

## Acceptance checklist (manual, per spec)

- [ ] /research on L1 question → triage line, Serena/graphify used, inline answer with pointer, nothing persisted.
- [ ] /research on L2 question → graphify query/path + Serena, evidence pointers on every claim.
- [ ] /research on L3 question → findings doc + INDEX line, "For goggles" section filled.
- [ ] Question about non-existent function → answer is "not found", not invented behavior.
- [ ] Session start in empty project → ≤10 lines, single /research-setup offer.
- [ ] Evidence file changed after finding written → `research-index.js list` shows `STALE?`.
