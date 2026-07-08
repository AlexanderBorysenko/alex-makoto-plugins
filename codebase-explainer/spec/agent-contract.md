# PCE Agent Contract v0.4

The rules any agent MUST follow when producing or mutating a PCE map document.
Skills reference this file; violations make the map invalid.

## 1. Ground truth hierarchy

1. **Code index** (graph tooling / tree-sitter / LSP / grep of real files) — the only source of STRUCTURE.
2. **Local runs / traces** — the preferred source for confirming FLOWS (`verified_by`).
3. **Environment manifest** — human-confirmed facts not derivable from code. Read it BEFORE broad-scan. Relevant entries become nodes with `resolution: confirmed` + `manifest_ref`.
4. **Git history** — deterministic metrics + change-coupling suspicion generator.
5. **LLM reasoning** — allowed ONLY for: summaries, explanations, advisory, suspicion triage. NEVER for inventing structure. If the index doesn't show a relationship, the agent may at most create a *suspected* element with evidence — never a confirmed one.

## 2. Epistemic rules (Black Boxes)

- `resolution: suspected` requires a **concrete artifact hint** in `evidence`
  (a migration line, an annotation, a binding config, a change-coupling stat).
  "Large systems usually have X" is NOT evidence. No hint → no box. Spam kills the feature.
- Confirmed elements NEVER skip through: broad-scan may only produce `suspected`;
  promotion to `confirmed` happens via (a) deep-dive investigation, (b) explicit human
  confirmation ("yes, that scheduler exists and does X"), or (c) manifest entry.
- Dismissed boxes are KEPT in the document with the dismissal reason in `evidence`.
- Every `suspected_influence` edge carries its own `evidence`.
- On confirmation of a box: retype the node kind, retype/redirect its edges,
  and CHECK EXISTING FLOWS — a confirmed influence may inject arrows into them.

## 3. Perimeter closure invariant

Within `meta.analysis_scope`, every element the scan touched is in exactly one state:
`confirmed | suspected | dismissed` (or explicitly out of scope in `analysis_scope` wording).
**The map is not "everything known" — it is "no silent gaps".**
A linter MAY verify: no node without resolution; no suspected node without evidence.

Residual uncertainty (unknown unknowns) is declared, not hidden:
fill `meta.scan_coverage.scanned_sources / not_scanned` and `advisory.residual_uncertainty`.

## 4. Two-phase protocol (manual perimeter gate)

**Phase 1 — build:** map from easily/medium-reachable sources + cheap artifact broad-scan
(migrations, annotations, configs, manifest). Surface Black Boxes. STOP.

**Phase 2 — human routes:** for each box the human picks: investigate / dismiss / confirm-from-experience.
The agent NEVER auto-launches expensive deep-dives (incl. git change-coupling mining)
without an explicit go, unless the task command says otherwise.

When the human confirms a fact from experience, OFFER to append it to the environment manifest.

## 5. Flow well-formedness

- Steps contain `arrows` (atomic call/return/async events); this is the single source
  for both projections. MAP lights `arrow.edge`; SEQUENCE simulates the stack.
- **Stack must balance**: every `call` is eventually matched by a `return`
  (possibly `err:true`) within the flow, or the flow explains why not (async handoff).
  This doubles as an anti-hallucination check — an unbalanced flow means the agent
  didn't actually trace it.
- `async` arrows never get a return.
- Mid-process flows MUST carry `preface` context arrows.
- Every step: `explanation` (what + why it matters) and, when possible, `code_ref`.
- Set `verified_by` honestly. `hypothesis` is allowed — hidden hypothesis is not.

## 6. Diffs

- Structural change → `diffs[]` ops with `rationale` each.
- Behavioral consequence → `flow_diffs[]`: which steps disappear, which appear, per flow.
  Proposing a change REQUIRES thinking through both. If a flow the human did not intend
  to touch changes — flag it in advisory (flow regression).
- Blast radius over explicit edges must be accompanied by unresolved suspected nodes
  in the radius: "N explicit dependents + M unconfirmed suspicions — recommend
  investigating BBx before changing".

## 7. Metrics & advisory

- `metrics` are computed deterministically (index + git). The LLM never writes numbers.
- `tangle_score` (v0.4 default formula, tune later):
  `0.35*norm(fan_in*fan_out) + 0.25*norm(flows_count) + 0.25*change_coupling + 0.15*cycle_flag`
- `advisory` is the ONLY place for LLM interpretation of metrics
  ("hotspot: refactor before fixing, otherwise regression risk in flows X/Y/Z").

## 8. Ephemerality & references

- Maps are per-task. Always stamp `generated_at` + `commit_hash`.
- `display_id` (N1, E3, BB1) is the shared human↔AI coordinate system. When the human
  references a display_id, respond in the context of that exact element.
- Every confirmed claim should be one click from code: prefer filling `source_refs`.

## 9. Intents

- `explain` — canonical flows, playback-first, no repro runs, no diffs.
- `debug` — reproduce first (local run if available), bug flow next to happy flow,
  blast radius + flow regression on any proposed fix.
- `extend` — current map + proposed diff + hotspot advisory ("you are building on a tangle").
