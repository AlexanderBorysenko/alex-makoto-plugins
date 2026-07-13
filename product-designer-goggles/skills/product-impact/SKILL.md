---
name: product-impact
description: Model a proposed change on a PJM map — structural product diff, journey regressions, and blast radius in product terms ("which user journeys and business rules change"). Use before writing code whenever the task changes behavior, so the human reviews the change as a product diagram diff.
---

# product-impact

Extends the task's PJM map with `diffs[]` and `flow_diffs[]`. Obey
`spec/agent-contract.md` §10. `meta.intent` becomes `impact`.

## Procedure

1. State the proposed change in one product sentence.
2. **Structural diff** (`diffs[]`): add/modify/remove nodes and edges the
   change causes — new screens, changed rules, capabilities gaining/losing
   consumers. Every op: `rationale` in product language.
3. **Blast radius**: walk edges outward from changed nodes (`uses/affects/
   governed_by` both directions); every reached node is affected — list in
   `advisory.notes` (kind: risk) with what the user would notice. Unexpected
   areas found this way are the POINT of this skill — never trim them to
   keep the diff tidy.
4. **Journey regressions** (`flow_diffs[]`): for each journey touching a
   changed node: `removed_step_seqs` + `added_steps` describing the new user
   experience; `note` for behavior-identical-but-riskier cases.
5. Lint; save the map file; the human reviews the diff in the viewer BEFORE any code
   is written. Present the affected-journeys list in chat too (one line each).

## Rules
- Product language everywhere ("shopper loses saved promo"), not
  implementation language ("PromoService signature changes").
- No silent scope-trimming: if blast radius is huge, SAY it is huge.
