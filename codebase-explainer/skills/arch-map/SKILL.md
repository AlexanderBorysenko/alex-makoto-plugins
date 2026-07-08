---
name: arch-map
description: Build a task-scoped PCE map document (nodes, edges, black-box perimeter) for the current codebase task. Use at the start of any explain/debug/extend task on a non-trivial codebase, or when the user asks to "map", "visualize" or "explain the architecture of" a part of the system.
---

# arch-map

Produces `map.json` conforming to `spec/schema.v0.4.json`. Obey `spec/agent-contract.md`.

## Procedure

1. **Frame the task**: set `meta.intent` (explain|debug|extend), `meta.task`, `meta.analysis_scope`.
   Record `commit_hash` (`git rev-parse HEAD`) and `generated_at`.
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
6. **Compute metrics deterministically** (fan_in/out, flows_count once flows exist; change_coupling
   only on explicit request — it is an expensive scan). LLM writes `advisory`, never numbers.
7. **STOP at the perimeter gate**: present the map + the black-box list with evidence and ask the
   human to route each: investigate / dismiss / confirm-from-experience. On confirm-from-experience,
   offer a manifest append.
8. Register the map for the viewer: `node viewer/register-map.mjs <path-to-map.json>` and give the
   user the `http://localhost:4173/?map=<hash>` link (start `viewer/serve.mjs` if not running).

## Output requirements
- Valid against schema v0.4 (run a JSON Schema validation if ajv is available).
- Perimeter closure: nothing in scope without a resolution.
- `scan_coverage` filled honestly.
