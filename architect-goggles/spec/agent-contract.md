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
  confirmation ("yes, that scheduler exists and does X"), (c) manifest entry, or
  (d) a grounded app run (via the shared project-executor module) that observes the
  influence — set `verified_by` honestly from the observed behavior.
- Dismissed boxes are KEPT in the document with the dismissal reason in `evidence`.
- Every `suspected_influence` edge carries its own `evidence`.
- On confirmation of a box: retype the node kind, retype/redirect its edges,
  and CHECK EXISTING FLOWS — a confirmed influence may inject arrows into them.

### 2b. Defect claims — ISSUE PROTOCOL binding

`resolution: confirmed` asserts the CODE SHAPE exists — never that the defect
FIRES. Defect epistemics follow the suite's canonical **ISSUE PROTOCOL**
(`orchestrator/index-rules.md`, injected every session). PCE bindings:

- Every `bug_path` flow and every `advisory.notes[]` `kind: risk` describing a
  defect embeds the protocol's per-issue template (in `description` / `note`).
- Verdict words in node `label`/`summary` and flow `title` only when
  `incidence: observed`; otherwise "permits X" phrasing.
- `orthogonal` issues: one line in `advisory.notes`, no flows, no extra nodes.
- Open frequency questions go to `advisory` (or ask the human live).

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
  `fan_in`/`fan_out`/`flows_count`/`cycle_flag` are recomputable from the map itself and
  are verified at registration by `spec/lint.mjs` — a mismatch is a hard reject.
  `change_coupling` comes from an explicit (expensive, opt-in) git scan; absent = 0.
- `tangle_score` (v0.4 default formula, tune later):
  `0.35*norm(fan_in*fan_out) + 0.25*norm(flows_count) + 0.25*change_coupling + 0.15*cycle_flag`
- **Hotspots are SELECTED deterministically, never nominated by the LLM.** Purpose:
  god-node / blast-radius detection — "a change here must be validated against many
  other parts, or the node needs refactoring before further changes". Eligibility
  (`spec/lint.mjs::hotspotEligible`): passes the absolute floor
  (`fan_in + fan_out >= 3 && flows_count >= 2`) AND is top-3 by `tangle_score` or
  above the map's p75. `advisory.hotspots` may only contain eligible nodes
  (lint enforces); the LLM's role is the `recommendation` text — why the coupling
  is risky, what to validate, whether to refactor first.
- Runtime/perf bottlenecks and logic-density observations are NOT hotspots (they do
  not predict breakage radius). They belong in `advisory.notes[]` (kind: perf | logic
  | risk, with `code_ref`) or the node's `summary`.
- `advisory` is the ONLY place for LLM interpretation of metrics
  ("hotspot: refactor before fixing, otherwise regression risk in flows X/Y/Z").
- Conclusion-first advisory is the failure mode this section exists to prevent: pick
  nodes from numbers, then explain — never explain first and fit numbers after.

## 8. Ephemerality & references

- Maps are per-task. Always stamp `generated_at` + `commit_hash`.
- **One canonical file per task**: `<repo>/.claude-memory/maps/<task-slug>.json`, updated
  in place across iterations of the same task/session. The file path is the map's identity —
  agents continuing the task (or other agents) load and mutate THIS file, never a copy.
  The viewer reads it live via `/?path=<url-encoded abs path>` — no copy, no registry.
- **Always set `meta.source_root`** — absolute path to the analyzed repo on the viewer's
  machine. Without it the viewer cannot resolve `source_refs` to live code (inspector
  preview + "Open in IDE" go dead) and falls back to embedded `code_snippets` only.
  A map with `source_refs` but no `source_root` and no `code_snippets` has dead links.
  **Use forward slashes, even on Windows** (`C:/Users/...`) — Node resolves them on
  every OS, and backslashes die in shell/JSON escaping layers (`\b` → backspace char
  is a real observed corruption).
- `display_id` (N1, E3, BB1) is the shared human↔AI coordinate system. When the human
  references a display_id, respond in the context of that exact element.
- Every confirmed claim should be one click from code: prefer filling `source_refs`
  (repo-relative `file:lineStart-lineEnd`, resolved against `source_root`).

## 9. Intents

- `explain` — canonical flows, playback-first, no repro runs, no diffs.
  Failure scenarios in explain are `failure_path` (designed handling under a fault),
  NEVER `bug_path` — `bug_path` asserts "an actual defect exists here" and is reserved
  for debug-intent reproductions. Mislabeling designed error handling as a bug misleads
  both the human and any downstream agent consuming the map.
- `debug` — reproduce first (local run if available), bug flow next to happy flow,
  blast radius + flow regression on any proposed fix.
- `extend` — current map + proposed diff + hotspot advisory ("you are building on a tangle").

## 10. Language

A map has two registers; do NOT mix them.

- **Canonical — ALWAYS English / verbatim, never translated:** enum values
  (`kind`, `resolution`, `scope`, `intent`, `flow.kind`, `arrow.type`, `edge.kind`,
  diff `op`), `display_id` (N1/E3/BB1), `id`, `source_refs` paths, metric keys, and
  `node.label` when it is a real code symbol (copy the identifier as it appears in the
  source — do not localize `UserService`). These are a shared human↔AI↔viewer coordinate
  system; translating them breaks references and the viewer chrome.
- **Prose — the language the human is using in this session:** all free-text explanation
  the LLM writes — `meta.title`, `meta.task`, `node.summary`, `evidence`, `relevance`,
  `edge.label`, `flow.title`, `flow.description`, `step.explanation`, `diffs[].rationale`,
  `flow_diffs[].note`, and every `advisory` string (`summary`, hotspot `recommendation`,
  `notes[].text`, `residual_uncertainty`) plus `scan_coverage` descriptive text.

Detect the language from the ONGOING conversation, not just the task prompt: if the human is
writing to you in language X, ALL prose fields are in X — mandatory, not best-effort. Default
to English ONLY when the conversation itself is English (a single ambiguous token is not a
reason to fall back). Keep ONE language across the whole document — never per-field mixed. The viewer's
own UI (buttons, tabs, hints, empty states) is always English and is NOT part of the map —
never emit UI labels into the document to "match" it.

## 11. Altitude presets

A preset changes the map's ALTITUDE (granularity + prose register), never its truth
rules — §1–§10 apply to preset maps in full. Preset instruction files live in
`presets/<name>.md`. Default (no preset) = full-detail tech map. Currently defined:
**overview** (`presets/overview.md`).

- **Trigger — MANDATORY:** whenever the human asks, in ANY phrasing, to see things
  "in simple words" / "simply" / "high level" / "big picture" / "in a nutshell" /
  "without going deep" / "overview first" (any language — match the intent, not the
  string), LOAD `presets/overview.md` BEFORE building or answering, and apply it.
  This applies to arch-map, flow-trace, and prose answers about an existing map alike.
- **Projection rule:** a preset map is DERIVED from the canonical full-detail map,
  never analyzed from code directly. No canonical map yet → build it first (perimeter
  gate included), then project. The canonical map remains the single source of truth;
  regenerate the projection whenever the canonical map changes.
- **Identity:** one file per task per preset — `<task-slug>.<preset>.json` next to the
  canonical `<task-slug>.json` (§8 in-place update rule applies to each). Preset maps
  stamp `meta.preset` and `meta.derived_from`.
- **Register guard:** presets simplify sentence shape and granularity ONLY. Technical
  vocabulary stays dev-native; analogies and metaphor renaming are forbidden (the
  reader must never reverse-translate a friendly name back into a code concept).

## 12. Tours (guided walkthroughs)

A tour turns an explanation into ordered, map-anchored steps: each step highlights
`focus` nodes/edges and shows one markdown paragraph. Every `explain`-intent map
SHOULD ship at least one tour. Verdict maps produced by bug-detective MUST ship a
verdict tour (symptom → prime suspect → evidence). Every `focus` ref must be an
existing node or edge id; `flow_ref` must name an existing flow (lint enforces both).
Keep steps to one paragraph each — the tour is the reading port, not a second report.
