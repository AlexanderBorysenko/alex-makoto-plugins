# bug-detective

Claude Code plugin: stateful, budgeted bug-diagnosis controller.

**Problem:** bug reports need the opposite of a feature's lean hypothesis loop — slower, more expensive testing to falsify; hypothesis elimination and verdict dossiers to back up "fixed" over "maybe ok"; reasoning trails the user can audit.

**Solution:** case file as AUTHORITATIVE state (hypothesis ledger with explicit elimination, evidence log, questions answered, rounds spent), orchestrated investigation loop triage → test → update → verdict, local case board map for the tour, budget enforcement.

## Core concepts

- **Case file** (`.claude-memory/cases/<slug>.md`): AUTHORITATIVE state. Every round: add evidence → update hypotheses → regenerate the case map.
- **Hypothesis ledger**: hypotheses start open, move to eliminated (with reason) or confirmed (after falsification attempt). Elimination is kept — user sees the noise dossier.
- **Budget**: each case has `rounds_max` (default 3). When `rounds_used` reaches the limit, write an interim dossier and stop; continuing requires explicit user approval (bump `rounds_max`).
- **Case board map**: regenerated from the case file every round; lives at `.claude-memory/maps/case-<slug>.json`; viewer reads live from disk.
- **Verdict criteria**: one hypothesis explains the symptom AND survived falsification AND competitors are eliminated. Anything less is interim dossier.

## Workflow

1. **Open case:** `/investigate <symptom>` → parse symptom, initialize case file with `status: open`, default budget.
2. **Fast path (L1):** user can answer `is X happening?` directly → evidence log, hypothesis elimination, maybe verdict. No execution needed.
3. **Investigation loop (L2/L3):** hypotheses → cheapest discriminating test via project-executor → repro evidence → eliminate or confirm → update ledger → regenerate map.
4. **Verdict:** when one hypothesis survives and competitors are ruled out, close case with `status: verdict` + dossier (prime suspect, eliminated, parking lot, recommended fix).
5. **Interim dossier:** when budget expires, stop and write `status: interim` + current findings; user can bump budget and continue.

## Orchestration

- **researcher** (`^0.6.0`): L1 triage, tool routing for evidence gathering, grounding of claims.
- **project-executor** (`^0.5.0`): bug reproduction, test runs, instrumented logs, browser flows.
- **architect-goggles** (`^0.6.0`): codebase structure for hypothesis generation, impact assessment.
- **tasks-manager** (optional integration): case linked into the doc index when present; case slug becomes a task journal anchor.

## Planned (Phase 2)

**Click-to-answer:** User answers the case's open Questions directly in the case board viewer via a `serve.mjs` POST endpoint. Not yet built; flow reserved for future implementation.

## Layout

```
.claude-plugin/plugin.json        plugin manifest
spec/case-contract.md             case file structure + rules (binding for Task 5)
templates/case.md                 scaffold instantiated at case open
README.md                         this file
skills/investigate/SKILL.md       workflow (Task 5)
commands/investigate.md           /investigate command (Task 5)
```
