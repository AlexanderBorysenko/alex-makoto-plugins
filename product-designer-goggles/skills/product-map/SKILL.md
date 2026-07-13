---
name: product-map
description: Build a task-scoped PJM capability map — capabilities, screens, roles, business rules, entities and their product relations, with perimeter-gated black boxes. Use at the start of work on unfamiliar functionality, a bug in unseen code, or when asked to "explain the product side" of a scope.
---

# product-map

Produces `.claude-memory/product/maps/<task-slug>.json` conforming to
`spec/schema.v0.1.json`. Obey `spec/agent-contract.md` (all §§; especially
§2 knowledge priority, §3 unsourced-why, §5 perimeter gate).

## Procedure

1. **Frame**: `meta.intent` (explain|impact|present), `meta.task`,
   `meta.analysis_scope` in product language ("checkout promo flow as the
   shopper experiences it"), `commit_hash`, `generated_at`, `source_root`.
2. **Read the PRODUCT manifest** if present (`.claude-memory/product/PRODUCT.md`
   or `manifest/PRODUCT.md` template location in the target repo — ask once
   if unsure). Manifest entries → nodes/claims with `manifest_ref`.
3. **Structure from researcher, never from memory or self-grep**: product-map does NOT grep or
   trace code. Delegate discovery to the researcher plugin and consume its grounded finding, then
   MAP the flat structural facts into PJM vocab: routes/pages → screen nodes; feature
   modules/domain services → capabilities; permission/role checks → roles; validation/pricing/
   authorization logic → rule nodes; core persisted objects → entities. Every confirmed node keeps
   its `source_refs`. If researcher is unavailable, STOP and ask the human to enable it — no
   ad-hoc grep fallback. Completeness is researcher's guarantee.
4. **Formalize the finding's boundary-hints into the product perimeter** (no self-scan): the
   grep-grade broad-scan (other screens using the in-scope capability, shared entities written
   elsewhere, rules referenced by out-of-scope code, notification/email/analytics side effects)
   runs inside researcher. Each flat boundary-hint (touchpoint + evidence + relevance) → suspected
   node + `suspected_influence` edge carrying that evidence (§5). No hint → no box.
5. **Assign display ids** (contract §4) and edges (`uses / affects /
   governed_by / navigates_to`).
6. **Lint**: `node spec/lint.mjs <map>`; stamp recomputed metrics (§8). Fix
   until clean.
7. **STOP at the perimeter gate**: present the map summary + black-box list
   with evidence; the human routes each. Agentic fallback: contract §5.
8. After routing, update resolutions/evidence, re-lint, save the map file (the viewer reads it
   live by `?path=` — refresh picks it up).

## Rules
- No node without resolution; no suspected/dismissed without evidence.
- Business "why" only with a source (§3) — else advisory.open_questions.
- Do not build journeys here — that is journey-trace.
