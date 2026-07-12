# PJM Agent Contract (v0.1)

Law for agents generating PJM documents. Schema: `spec/schema.v0.1.json`;
validation: `node spec/lint.mjs <map.json>` — a map that fails lint is never
registered with the viewer or exported.

## §1 Ephemerality
Maps are per-task. Stamp `generated_at` and `commit_hash` (`git rev-parse HEAD`).
Set `meta.source_root` (absolute path, forward slashes) so source_refs resolve.

## §2 Knowledge priority
1. `manifest/PRODUCT.md` (or project-local equivalent) — tribal product truth.
   Entries used become nodes/claims with `manifest_ref`.
2. Code-derived facts — routes, screens, UI copy, validation, permissions,
   pricing logic. Always `resolution: confirmed` + `source_refs`.
3. Inference from naming/README/docs — ALWAYS `resolution: suspected` + `evidence`.

## §3 The unsourced-why rule
Never state a business "why" as fact without a source (manifest or code).
An unsourced `business_why` keeps its owning claim suspected, or goes to
`advisory.open_questions`. Plausible-sounding ≠ true.

## §4 Node & edge vocabulary
Node kinds (open set; prefer): `capability, screen, role, rule, entity,
external_system`. Edge kinds (closed): `uses | affects | governed_by |
navigates_to | suspected_influence`. Display ids: C#/S#/R#/BR#/E#/BB# nodes,
PE# edges, J# journeys (steps J#.s#). Black box = `resolution: suspected`,
never a kind.

## §5 Perimeter gate
Broad-scan the product perimeter of the task scope: shared entities, other
screens using the same capability, rules referenced elsewhere, notification /
email side effects. Each concrete hint → suspected node + `suspected_influence`
edge + evidence + relevance. Then STOP: present map + black-box list, human
routes each (investigate / dismiss / confirm-from-experience). In agentic
contexts with no human: leave suspected, list in `advisory.open_questions`.

## §6 Journeys
A journey = flow with `actor` (role node id), `goal`, optional `variant`.
Steps carry `screen` (screen node id), `explanation` (actor action + system
response), `business_why`, and `arrows` (actor/screen/capability events —
the playback machinery consumes arrows exactly as in PCE). `verified_by`
honesty marker: `static_analysis | local_run | static_and_run | hypothesis`;
journeys that got real screenshots via project-executor are `local_run` or
`static_and_run`.

## §7 Screenshots
`step.screenshot` = path relative to the map file, or literal `pending`.
Capture is delegated to project-executor (see present skill). Never fake a
screenshot; never block map generation on capture.

## §8 Metrics & advisory
`node.metrics` (fan_in/fan_out/flows_count) come from lint recomputation —
script them in, never hand-write. Advisory: `summary`, `notes`
(kind: ux|business|risk), `open_questions`, `residual_uncertainty`.

## §9 Storage
Target-project outputs: `.claude-memory/product/maps/<task-slug>.json`,
assets `.claude-memory/product/assets/<journey-id>/`, decks
`.claude-memory/product/decks/`. Ensure `.claude-memory/` is gitignored
(create/append `.gitignore` if needed).

## §10 Impact documents
`meta.intent: impact`: populate `diffs` (structural product changes) and
`flow_diffs` (journey regressions). Every diff op carries `rationale` in
product language ("shoppers with saved carts lose the promo banner"), not
implementation language.
