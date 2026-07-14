# PJM Agent Contract (v0.1)

Law for agents generating PJM documents. Schema: `spec/schema.v0.1.json`;
validation: `node spec/lint.mjs <map.json>` — a map that fails lint is never
opened in the viewer or exported.

## §1 Ephemerality
Maps are per-task. Stamp `generated_at` and `commit_hash` (`git rev-parse HEAD`).
Set `meta.source_root` (absolute path, forward slashes) so source_refs resolve.

## §2 Knowledge priority
1. `manifest/PRODUCT.md` (or project-local equivalent) — tribal product truth.
   Entries used become nodes/claims with `manifest_ref`.
2. Code-derived facts — routes, screens, UI copy, validation, permissions,
   pricing logic — obtained through the researcher plugin's grounded finding
   (product-map does not grep). Always `resolution: confirmed` + `source_refs`.
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
The product-perimeter broad-scan (shared entities, other screens using the same
capability, rules referenced elsewhere, notification / email side effects) runs
inside researcher, not here. Formalize each flat boundary-hint from its finding →
suspected node + `suspected_influence` edge + evidence + relevance. Then STOP:
present map + black-box list, human routes each (investigate / dismiss /
confirm-from-experience). A routed runtime/side-effect box may be confirmed by a
grounded run through the shared project-executor module (`verified_by` honest).
In agentic contexts with no human: leave suspected, list in `advisory.open_questions`.

## §6 Journeys
A journey = flow with `actor` (role node id), `goal`, optional `variant`.
Steps carry `screen` (screen node id), `explanation` (actor action + system
response), `business_why`, and `arrows` (actor/screen/capability events —
the playback machinery consumes arrows exactly as in PCE). `verified_by`
honesty marker: `static_analysis | local_run | static_and_run | hypothesis`;
journeys that got real screenshots via project-executor are `local_run` or
`static_and_run`.

## §7 Screenshots
`step.screenshot` = filesystem path relative to the MAP FILE, `pending`, or an
absolute `data:` / `http(s):` URL. The viewer serves relative paths through
`/asset?mapPath=<abs>&rel=<rel>` (guarded to the map's directory); lint enforces
on-disk existence for non-pending, non-URL values. Capture is delegated to
project-executor (see present skill). Never fake a screenshot; never block map
generation on capture.

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

## §11 Language
A map has two registers; do NOT mix them.

- **Canonical — ALWAYS English / verbatim, never translated:** enum values (`kind`,
  `resolution`, `edge.kind`, `arrow.type`, `verified_by`, diff `op`), `display_id`
  (C1/S2/R3/BR1/E1/BB1, journeys J1, edges PE2), `id`, `source_refs` paths, metric keys,
  and any `label` that is a real code symbol or route (`/checkout`, `PromoService`). These
  are a shared human↔AI↔viewer coordinate system; translating them breaks references and
  viewer chrome.
- **Prose — the NATURAL LANGUAGE the human is using in this session:** all free-text the LLM
  writes — `meta.title`, `meta.task`, `meta.analysis_scope`, `node.summary`, `business_why`,
  `evidence`, `relevance`, `edge.label`, journey `goal`, `step.explanation`, `diffs[].rationale`,
  `flow_diffs[].note`, and every `advisory` string.

Detect the language from the ONGOING conversation, not just the task prompt: if the human is
writing to you in language X, ALL prose is in X — mandatory, not best-effort. Default to English
ONLY when the conversation itself is English. Keep ONE language across the whole document — never
per-field mixed.

**Do not confuse the two axes.** "Product language" everywhere else in this contract (§8, §10)
means product-vs-implementation REGISTER ("shopper loses saved promo", not "PromoService
signature changes") — it is ORTHOGONAL to natural language. Write the product register IN the
session's natural language: a Ukrainian session yields Ukrainian product-register prose, not
English. The viewer UI (buttons, tabs, hints) is always English and is NOT part of the map.
