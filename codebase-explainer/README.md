# Protocol Codebase Explainer (PCE) — Claude Code plugin

Agent-generated, **task-scoped** architecture maps for explaining, debugging and extending large codebases.

One JSON model → two synchronized projections:
- **MAP** — structure: who exists, who depends on whom, blast radius, heat overlay
- **SEQUENCE** — behavior: calls/returns/async, activation bars (call stack), flow playback

Core ideas baked into the spec:
- **Epistemic states** on every node: `confirmed / suspected (Black Box) / dismissed` + `evidence`
- **Perimeter closure invariant**: within the analysis scope nothing is left without an explicit resolution
- **Manual perimeter gate**: agent builds from easily/medium reachable sources, surfaces Black Boxes, human routes further investigation
- **Ephemeral maps**: generated per task, stamped with `generated_at` + `commit_hash`, no cache invalidation problem
- **Environment manifest**: slow-changing tribal knowledge (non-derivable from code) as a generation input
- **Intents**: `explain | debug | extend` — not only bugs

## Layout
```
.claude-plugin/plugin.json   plugin manifest
spec/schema.v0.4.json        JSON Schema for map documents
spec/agent-contract.md       generation rules & well-formedness (the "law" for agents)
skills/                      arch-map, flow-trace, impact-diff, perimeter-scan
commands/explain.md          /explain orchestration command
viewer/                      local viewer app + map registry
manifest/ENVIRONMENT.md      environment manifest template
```

## Viewer quickstart
```
cd viewer
node serve.mjs        # http://localhost:4173
```
Agent workflow: write map JSON → `node register-map.mjs <file>` → returns hash → open
`http://localhost:4173/?map=<hash>`. An example map ships as `maps/example.json` (open `/?map=example`).

## Status
v0.4 scaffold. Viewer implements: map + sequence + shared playback, black boxes,
suspected-influence edges, heat overlay, diff mode incl. sequence ghost-arrows, seq zoom.
Deferred by design: map accumulation/reuse, auto-layout (positions are agent-provided for now).
