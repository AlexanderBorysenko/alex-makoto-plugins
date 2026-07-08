# Preset: overview

Altitude preset for the "lazy developer" reading: the whole picture at subsystem
granularity, dev-native vocabulary, zero implementation detail. Used for orientation
before diving in, and for architectural decisions that only need boundaries and
interactions — not internals.

This file is loaded when the trigger in agent-contract §11 fires. It changes HOW MUCH
detail the map carries and HOW prose is phrased. It never changes the rules of truth:
contract §1–§10 stay fully in force.

## Audience & register

- Reader is a DEVELOPER, not a manager. Keep the technical vocabulary they already
  own: service, controller, queue, consumer, handler, retry, transaction, webhook.
- **NO analogies, NO metaphors, NO vocabulary flipping.** "Payment brain" is banned;
  `PaymentService` is fine. An analogy forces the reader to reverse-translate — that
  is more work, not less.
- Simplification lives in SENTENCE SHAPE and GRANULARITY, not in word choice:
  - Good: "OrderService calls PaymentService and waits for confirmation."
  - Good: "On success it publishes an event; nobody waits for the outcome."
  - Bad: "The order brain asks the money desk for a green light."
  - Bad: "invokes `PaymentService#authorize(AuthorizationRequest)` via the resilience4j-wrapped feign client" (that is full-detail register — belongs in the canonical map).

## Derivation — projection, not analysis

An overview map is a LOSSY PROJECTION of the canonical full-detail map. Never
re-analyze the codebase to produce it.

1. Locate the canonical map: `<repo>/.claude-memory/maps/<task-slug>.json`.
   - Exists → project from it. Input = that JSON. No code scan.
   - Missing → build it first with the **arch-map** skill (full procedure, perimeter
     gate included), THEN project.
2. Collapse nodes to subsystem/service granularity. Budget: **≤ 8 confirmed nodes**
   (guideline, not lint rule — cross it only when merging would be a lie).
   A collapsed node's `source_refs` point at the group's entry points (the file a
   reader would open first). Keep stable `id`s where a node survives uncollapsed;
   merged nodes get a new id + fresh `display_id` numbering.
3. Keep the black-box perimeter. Suspected/dismissed nodes copy over WITH their
   resolutions and evidence — boundaries and hidden influences are exactly what
   high-altitude architectural decisions need. Do NOT re-run the perimeter gate:
   routing already happened on the canonical map.
4. Collapse flows the same way: one arrow per collapsed-group interaction, plain
   verb labels ("calls and waits", "fires async, doesn't wait", "reads shared table").
   Stack balance (contract §5) still applies. Inherit `verified_by` from the source
   flow (a projection cannot raise verification level).
5. Prose limits: `node.summary` ≤ 2 sentences; `step.explanation` ≤ 2 sentences;
   `edge.label` one plain clause. Say what happens and why it matters — never how.
6. Drop from the projection: `advisory.hotspots`, `advisory.notes`,
   `expanded_children`, per-node `metrics` (recomputed numbers on merged boxes
   describe the projection, not the system — omitting beats misleading).
   Keep `advisory.summary` (≤ 3 sentences) and a short `residual_uncertainty`.

## Output

- File: `<repo>/.claude-memory/maps/<task-slug>.overview.json` — sibling of the
  canonical map, one per task, updated in place (same identity rule as contract §8).
- Stamp `meta.preset: "overview"` and `meta.derived_from: "<abs path of canonical map>"`
  (forward slashes). Copy `commit_hash` from the canonical map — the projection is
  valid exactly as long as its source.
- `node spec/lint.mjs <file>` must pass before handing the link over.
- Staleness: whenever the canonical map changes, regenerate the projection (cheap —
  map-to-map, no code scan). Never edit the overview to encode facts missing from
  the canonical map; fix the canonical map first, then re-project.
