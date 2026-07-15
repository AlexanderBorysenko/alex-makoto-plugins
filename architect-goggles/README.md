# Architect Goggles — Claude Code plugin

A visual surface for **looking at** a codebase: explore its structure, spot architectural
problems, ask the agent questions, and review agent-proposed changes as diagram diffs —
before any code is written.

Under the hood it's a protocol (**PCE** — the task-scoped map document format) plus a local
viewer. Agent-generated maps for explaining, debugging and extending large codebases.

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
spec/schema.v0.5.json        JSON Schema for map documents
spec/agent-contract.md       generation rules & well-formedness (the "law" for agents)
skills/                      arch-map, flow-trace, impact-diff, perimeter-scan
commands/explain.md          /explain orchestration command
viewer/                      local viewer app (reads map files live by path)
manifest/ENVIRONMENT.md      environment manifest template
```

## Viewer quickstart
```
cd viewer
node serve.mjs        # http://localhost:4173
```
Agent workflow: write the canonical map JSON to `<repo>/.claude-memory/maps/<task-slug>.json` →
`node spec/lint.mjs <file>` → open `http://localhost:4173/?path=<url-encoded absolute path>`.
The viewer reads the file live from disk (edit + refresh = the whole update loop). An example map
ships as `maps/example.json` (open `/`). Run each goggle's viewer on its own port
(`node serve.mjs 4173`, `node serve.mjs 4174`) when showing more than one.

## Status
v0.5 scaffold (renamed from `codebase-explainer`; map format still **PCE v0.4**).
Viewer implements: map + sequence + shared playback, black boxes,
suspected-influence edges, heat overlay, diff mode incl. sequence ghost-arrows, seq zoom.
Deferred by design: map accumulation/reuse, auto-layout (positions are agent-provided for now).
