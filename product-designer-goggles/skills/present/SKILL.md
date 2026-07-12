---
name: present
description: Turn PJM journeys into a shareable presentation — capture real screenshots of each journey step via the project-executor plugin (when installed and the app runs locally), attach them to the map, and export a self-contained HTML deck. Use for frontend work when the human wants to SEE how the flow looks and behaves per scenario.
---

# present

Obey `spec/agent-contract.md` §7 (screenshots) and §9 (storage). Degrades
gracefully: no project-executor → no captures, deck ships with placeholders.

## Procedure

1. Load the map; collect journeys with steps marked `screenshot: "pending"`.
2. **Detect project-executor**: is the `execute` skill or `executor` agent
   available? NO → skip to step 5 (placeholders). YES →
3. **Capture per journey**: compose a scenario from the journey steps (start
   URL, actions per step, expected state per step, one screenshot per
   pending step named `<journey-id>-s<seq>.png`). Hand it to project-executor:
   interactive → `/execute` full-test with the scenario; agentic → spawn the
   `executor` agent. project-executor owns app start, auth, seeds, selectors.
   Variants = separate runs of the same journey with different state.
4. **Attach**: copy captured screenshots from the project-executor report dir
   into `.claude-memory/product/assets/<journey-id>/`; set each step's
   `screenshot` to the relative path (from the map file); upgrade the
   journey's `verified_by` to `local_run` (or `static_and_run`). Steps whose
   capture failed keep `pending`; record the failure + report verdict in
   `advisory.notes` (kind: risk).
5. **Lint** (screenshot paths must exist), then **export the deck**:
   `node viewer/export-deck.mjs <map.json> --out .claude-memory/product/decks/`
   → one self-contained HTML file; print its path.
6. Report: captured X of Y steps, deck path, any degradations.

## Rules
- Never fake, stage, or edit screenshots; a placeholder is honest, a mockup
  is not.
- Never block on capture: app won't start / executor blocked → placeholders
  + advisory note, deck still exports.
- Screenshots may contain real local data — they live under `.claude-memory/`
  (gitignored, §9); warn if the target repo would commit them.
