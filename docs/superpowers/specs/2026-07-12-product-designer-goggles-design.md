# product-designer-goggles — Design Spec

Date: 2026-07-12
Status: approved-pending-review

## Purpose

The product-side sibling of architect-goggles. Where architect-goggles explains a codebase in implementation terms (components, calls, dependencies), product-designer-goggles explains the same scope in product terms: what actually happens for the user and the business, why the functionality exists, which user journeys pass through the code being worked on, and what the full product impact of a change is. For frontend work it additionally produces user-flow presentations with real screenshots captured from the locally running app.

Driving use case (from `product-designer-goggles/intro.md`): a developer starts work on an unfamiliar part of the app, or fixes a bug in functionality they have never seen — they need the plain product explanation (purpose, flow, the "why"), diagrams and the big picture, a cleanly defined scope that covers unexpected affected areas, and — for frontend work — visual walkthroughs of how the part looks and behaves in different scenarios.

Part of the new scoped plugin family (architect-goggles, project-executor). `.claude-memory/` is the family's standard output location; this plugin owns `.claude-memory/product/`.

## Decisions (locked during brainstorming)

1. **Form**: standalone sibling plugin with its own viewer and schema; architect-goggles is the UI/vision reference, not a dependency (option B).
2. **Model**: dual projection mirroring architect-goggles — one JSON document (**PJM, Product Journey Map**) renders as a structural CAPABILITY view and a behavioral JOURNEY view (option C).
3. **Screenshots**: optional integration with project-executor, graceful degradation — real screenshots when it is installed and the app runs; diagram-only journeys with `screenshot: pending` placeholders otherwise. No own browser-driving logic (option B).
4. **Viewer**: fork the architect-goggles viewer and adapt (vocabulary, journey lanes, screenshot panel), plus a self-contained HTML deck export (option A + deck).

## Concepts inherited from architect-goggles

- **Epistemic states** on every node and business claim: `confirmed / suspected / dismissed` + `evidence`. Code-derived facts (routes, UI copy, validation rules, permissions) are `confirmed` with `source_refs`; anything inferred from naming, README, or docs is `suspected`.
- **Perimeter gate**: the agent builds from reachable sources, surfaces product black boxes ("this component also appears used in the checkout flow?"), and STOPS for the human to route each: investigate / dismiss / confirm-from-experience.
- **Unsourced-why rule**: the agent never states a business "why" as fact without a source. An unsourced why is `suspected` and must surface at the gate. This is what makes "cleanly define the actual scope" honest.
- **Ephemeral maps**: generated per task, stamped `generated_at` + `commit_hash`; no cache invalidation problem.
- **Manifest input**: slow-changing tribal knowledge as a generation input — here `manifest/PRODUCT.md` (personas, business rules not visible in code, domain glossary, out-of-code processes).

## Architecture

```
product-designer-goggles/
├── .claude-plugin/plugin.json
├── spec/
│   ├── schema.v0.1.json          # PJM document schema
│   └── agent-contract.md         # generation rules (product-scope law for agents)
├── skills/
│   ├── product-map/SKILL.md      # build capability map for the task scope
│   ├── journey-trace/SKILL.md    # build journeys (happy path, edge cases, bug scenario)
│   ├── product-impact/SKILL.md   # proposed change → product blast radius + journey regressions
│   └── present/SKILL.md          # capture screenshots (via project-executor) + export HTML deck
├── commands/product.md           # /product orchestration entry
├── manifest/PRODUCT.md           # template: tribal product knowledge
└── viewer/                       # forked architect-goggles viewer, adapted
```

## The PJM model (schema v0.1)

One JSON document per task, registered with the viewer like PCE maps.

- `meta`: `intent: explain | impact | present`, `task`, `analysis_scope`, `commit_hash`, `generated_at`, `source_root`.
- `nodes[]`: `kind: capability | role | rule | entity | screen`, `resolution: confirmed | suspected | dismissed`, `evidence`, `source_refs[]`, optional `manifest_ref`.
- `edges[]`: `kind: uses | affects | governed-by | navigates-to` (+ `suspected_influence` for black-box edges).
- `journeys[]`: `actor`, `goal`, `variant` label (e.g. "empty cart" / "full cart" / "error"), `steps[]`: `{actor_action, screen, system_response, business_why, screenshot?, source_refs[]}`.
- `advisory`: impact notes, open questions.
- Display ids: `C1..` capabilities, `R1..` roles, `BR1..` business rules, `S1..` screens, `E1..` entities, `BB1..` black boxes, `J1` journeys / `J1.s3` steps.

Lint: `spec/lint.mjs` (fork of architect-goggles lint) validates schema conformance, perimeter closure (no node without an explicit resolution), and journey integrity (every step's `screen` refs an existing screen node; `screenshot` paths exist when set).

## Projections

- **CAPABILITY view** (structure): node kinds rendered with distinct shapes; edges `uses / affects / governed-by / navigates-to`; heat overlay = product blast radius for impact tasks; black boxes rendered as in architect-goggles.
- **JOURNEY view** (behavior): actor lanes (instead of component lifelines); step-by-step playback reusing the sequence playback machinery; **screenshot side-panel** — when the current step carries a `screenshot` ref, the panel shows it, click for full size; steps without screenshots show a placeholder.
- **Diff mode** (kept from the fork): product-impact renders structural diffs and journey ghost-arrows = flow regressions before any code is written.

## Skills flow

`/product <task>` orchestrates:

1. **product-map** — frame intent/task/scope; read `manifest/PRODUCT.md` (or project-local equivalent) if present; derive capability nodes from code (routes, screens, permissions, validation — `confirmed` + `source_refs`) and from naming/docs (`suspected`); STOP at the perimeter gate — human routes black boxes.
2. **journey-trace** — build the journeys relevant to the task: how the feature works for the user, where the bug manifests, edge variants. Each step sourced; unsourced business_why stays `suspected`.
3. **product-impact** (only when the task is a change) — model the change on the map: structural diff, affected capabilities/rules/journeys, journey regression flows. Mirrors architect-goggles impact-diff.
4. **present** (only for frontend work, on request) — screenshots + deck (below).

Knowledge priority: `PRODUCT.md` manifest → code-derived facts → inference (always `suspected`).

## Present pipeline

Capture:
1. Detect project-executor (is the `/execute` skill / `executor` agent available). Absent → skip capture; journey steps keep `screenshot: pending`; deck renders placeholders. Present →
2. For each journey needing visuals, `present` composes a scenario from the journey steps and hands it to project-executor (spawn `executor` agent, or `/execute full-test` interactively). project-executor owns app start, auth, seeds, selectors via its own memory. Screenshots land in its report dir; `present` copies them to the map's asset dir and stamps `screenshot` refs on the steps.
3. Scenario variants = separate journey runs; the deck shows variants side-by-side.

Deck export: one self-contained HTML file per journey set — step cards: screenshot (or placeholder) + actor action + system response + business why + source ref. No server needed to view. Generated from the PJM JSON by `viewer/export-deck.mjs`.

## Storage (per target project)

```
.claude-memory/product/
├── maps/       # PJM JSON documents
├── assets/     # screenshots copied from project-executor reports, per journey
└── decks/      # exported HTML decks
```

## Viewer

Fork `architect-goggles/viewer/` (serve.mjs, register-map.mjs, dagre, playback machinery). Adapt:
- Node kind shapes/colors for the product vocabulary; edge kind labels.
- SEQUENCE → JOURNEY: actor lanes, step playback, screenshot side-panel.
- Keep: registry, diff mode, heat overlay, black-box rendering, zoom.
- Defer (as architect-goggles does): auto-layout beyond dagre, map accumulation/reuse.

## Error handling

- project-executor missing or app won't start: capture skipped, `screenshot: pending`, deck with placeholders; never block map/journey generation on visuals.
- project-executor run returns verdict `blocked`/`fail`: record in `advisory`, keep placeholders, surface to human.
- Lint failure: fix the document, never hand an invalid map to the viewer.
- Unroutable black boxes (human unavailable in agentic contexts): leave `suspected`, list in `advisory.open_questions`.

## Testing

- Lint-driven: schema + closure + journey integrity checks on example maps (a shipped `maps/example.json` like architect-goggles).
- Fixture acceptance: a tiny frontend fixture (static HTML page(s) served by a small node server, may extend `project-executor/fixtures/hello-svc` with a page) — scenarios: map build with gate stop; journey trace; present WITH project-executor (real screenshots land, deck renders them); present WITHOUT it (placeholders, no failure); product-impact diff render.
- Manual acceptance on a real project after 1-2 sessions.

## Milestones

1. **M1 — Spec + schema + lint**: plugin skeleton, PJM schema v0.1, agent-contract, lint, example map.
2. **M2 — Skills**: product-map, journey-trace, product-impact, /product command, PRODUCT.md template.
3. **M3 — Viewer fork**: capability + journey views, playback, screenshot panel, diff mode.
4. **M4 — Present**: project-executor integration, asset pipeline, deck export, degradation path.
5. **M5 — Fixture + acceptance**: fixture page, acceptance checklist, README, marketplace registration.

## Out of scope (v1)

- Own browser automation (delegated to project-executor).
- Map accumulation/reuse across tasks; auto-layout beyond dagre.
- Product analytics/telemetry integration (usage data as evidence) — future evidence source.
- Cross-plugin node links (product node ↔ architect-goggles code node) — deliberate future direction, schema keeps `source_refs` compatible to enable it later.
