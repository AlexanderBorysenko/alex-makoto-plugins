# product-designer-goggles

Product-side sibling of [architect-goggles](../architect-goggles/): explains
the scope you work on in product terms — purpose, user journeys, business
"why", and the full product impact of a change — with an interactive viewer
and shareable screenshot decks.

One PJM document (`spec/schema.v0.1.json`, protocol `pjm-0.1`) → two views:
- **CAPABILITY** — structure: capabilities, screens, roles, business rules,
  entities; `uses / affects / governed_by / navigates_to` relations; black
  boxes (`resolution: suspected`) at the perimeter, human-routed.
- **JOURNEY** — behavior: actor-lane step playback, each step with its
  business why and (for frontend work) a real screenshot.

## Entry points

| Surface | Use |
|---|---|
| `/product <task>` | orchestrates product-map → journey-trace → (product-impact) → (present) |
| skills directly | `product-map`, `journey-trace`, `product-impact`, `present` |

## Screenshots

Captured by the [project-executor](../project-executor/) plugin when installed
(it owns app start, auth, seeds); without it, journeys ship with `pending`
placeholders and everything else still works. Decks are self-contained HTML
(`viewer/export-deck.mjs`), screenshots embedded — shareable as one file.

## Layout

    spec/schema.v0.1.json   PJM document schema (structural fork of PCE v0.4)
    spec/agent-contract.md  generation law (§1-§10)
    spec/lint.mjs           schema + closure + journey-integrity validation
    skills/                 product-map, journey-trace, product-impact, present
    commands/product.md     /product orchestration
    manifest/PRODUCT.md     tribal product knowledge template
    viewer/                 forked architect-goggles viewer + export-deck.mjs
    fixtures/               promo-shop fixture + ACCEPTANCE.md

Outputs land in the target project at `.claude-memory/product/`
(maps/, assets/, decks/ — gitignored).

Viewer quickstart: `cd viewer && node serve.mjs` → http://localhost:4173, then open
`http://localhost:4173/?path=<url-encoded absolute path to map.json>`. The viewer reads the
file live from disk (edit + refresh = the whole update loop). Run each goggle's viewer on its
own port (`node serve.mjs 4173`, `node serve.mjs 4174`) when showing more than one.

Design spec: `docs/superpowers/specs/2026-07-12-product-designer-goggles-design.md`.
