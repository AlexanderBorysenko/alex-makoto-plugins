---
name: arch-map
description: Build a task-scoped PCE map document (nodes, edges, black-box perimeter) for the current codebase task. Use at the start of any explain/debug/extend task on a non-trivial codebase, or when the user asks to "map", "visualize" or "explain the architecture of" a part of the system.
---

# arch-map

Produces `map.json` conforming to `spec/schema.v0.4.json`. Obey `spec/agent-contract.md`.

**Preset check (before step 1):** if the human asked, in any phrasing, for "simple words" /
high level / big picture / nutshell — load `presets/overview.md` and follow contract §11:
build (or reuse) the canonical map with THIS procedure first, then project the overview
map from it (`<task-slug>.overview.json`). The overview is never built from code directly.

## Procedure

1. **Frame the task**: set `meta.intent` (explain|debug|extend), `meta.task`, `meta.analysis_scope`.
   Record `commit_hash` (`git rev-parse HEAD`), `generated_at`, and `meta.source_root`
   (absolute path to the analyzed repo — without it the viewer cannot resolve
   `source_refs` to live code and "Open in IDE" goes dead; contract §8).
2. **Read the environment manifest** if present (`manifest/ENVIRONMENT.md` in the plugin, or a
   project-local equivalent — ask once if unsure). Relevant entries → confirmed nodes with `manifest_ref`.
3. **Structure from the index, never from memory**: use available code-graph tooling
   (or ripgrep + import/call tracing) to identify components in scope and their real edges.
   Every confirmed node gets `source_refs`.
4. **Cheap perimeter broad-scan** (always; no permission needed — it's grep-grade):
   migrations (triggers/procedures), scheduling annotations/cron configs, message-broker
   bindings, framework listeners/AOP, shared tables touched by out-of-scope code.
   Each concrete hint → `resolution: suspected` node (+ `suspected_influence` edge) with `evidence`
   and `relevance`. No hint → no box.
5. **Assign display_ids**: N1.. for nodes, BB1.. for suspected, E1.. for edges.
6. **Compute metrics deterministically** — do NOT hand-write numbers. Run
   `node spec/lint.mjs <map.json>`: it recomputes fan_in/out, flows_count, cycle_flag and
   tangle_score from the map and prints the hotspot-eligible set. Stamp those values into
   `node.metrics` (script them in, don't retype). `advisory.hotspots` may only contain
   eligible nodes (lint rejects others); the LLM writes only the `recommendation` text.
   Perf/logic/risk observations go to `advisory.notes[]`, never hotspots. change_coupling
   only on explicit request — it is an expensive git scan.
7. **STOP at the perimeter gate**: present the map + the black-box list with evidence and ask the
   human to route each: investigate / dismiss / confirm-from-experience. On confirm-from-experience,
   offer a manifest append.
8. **Save the canonical map file** to `<repo>/.claude-memory/maps/<task-slug>.json` —
   ONE file per task/session, updated IN PLACE on every iteration (never a new file per
   revision; the file path is the map's identity that other agents and later sessions
   reference). Run `node spec/lint.mjs <file>` — it must pass before handing the link over.
   Give the user `http://localhost:4173/?path=<url-encoded absolute path>` (start
   `viewer/serve.mjs` if not running). The viewer reads the file live from disk:
   edit + refresh is the whole update loop. No registry involved; `register-map.mjs`
   (`?map=<hash>`) remains only for sharing immutable snapshots.

## Output requirements
- Valid against schema v0.4 (run a JSON Schema validation if ajv is available).
- `node spec/lint.mjs <map.json>` passes — register-map.mjs runs the same lint and hard-rejects on errors.
- `meta.source_root` set (live code preview depends on it).
- Perimeter closure: nothing in scope without a resolution.
- `scan_coverage` filled honestly.
- Language (contract §10): write all prose fields (`summary`, `evidence`, `edge.label`,
  `meta.title/task`, advisory text…) in the human's session language; keep enums,
  `display_id`s, ids and code-symbol `label`s canonical. Viewer UI stays English.
