# product-designer-goggles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `product-designer-goggles` plugin — product-side sibling of architect-goggles: PJM maps (CAPABILITY structure + JOURNEY behavior with screenshots), perimeter-gated product scoping, impact diffs, and shareable HTML decks, with optional project-executor screenshot capture.

**Architecture:** PJM v0.1 is a deliberate structural fork of PCE v0.4 — same `nodes/edges/flows(+arrows)` document shape so the forked architect-goggles viewer keeps its layout/playback/diff machinery; product semantics live in new `kind` vocabularies, journey metadata (`actor`, `goal`, `variant`), and step extras (`screen`, `business_why`, `screenshot`). Skills are markdown contracts; the only new executable code is the lint fork, the deck exporter, viewer adaptations, and a fixture page.

**Tech Stack:** Claude Code plugin conventions; JSON Schema draft-07; plain Node (no deps) for lint/serve/register/export; forked single-file viewer (`index.html` + vendored dagre).

**Spec:** `docs/superpowers/specs/2026-07-12-product-designer-goggles-design.md`.

## Global Constraints

- Plugin lives at `product-designer-goggles/` (dir exists, holds only `intro.md` — keep it); marketplace name `product-designer-goggles`, version `0.1.0`.
- Protocol id: `protocol_version` const `"pjm-0.1"`; schema file `spec/schema.v0.1.json`.
- Node kinds (recommended set, open like PCE): `capability | role | rule | entity | screen`. Edge kinds (closed enum): `uses | affects | governed_by | navigates_to | suspected_influence`.
- Display ids: `C1..` capabilities, `R1..` roles, `BR1..` rules, `S1..` screens, `E1..` entities, `BB1..` black boxes, `J1` journeys / `J1.s3` steps, `PE1..` edges.
- `meta.intent` enum: `explain | impact | present`.
- Epistemic states verbatim from PCE: `confirmed | suspected | dismissed`; `evidence` mandatory for suspected/dismissed; unsourced business "why" = suspected.
- Storage in target projects: `.claude-memory/product/` with `maps/`, `assets/`, `decks/`.
- project-executor integration OPTIONAL — degradation: `screenshot: "pending"`, deck placeholders, never block generation on visuals.
- Viewer is a FORK of `architect-goggles/viewer/` — copy, then adapt; do not import from architect-goggles at runtime.
- No BOM in any created text file; no legacy-plugin (memory-system/ticket-resolver) references.
- Viewer/serve ports: keep architect-goggles' default (4173) — the two viewers are separate installs; if both run simultaneously the user passes `PORT`.

---

### Task 1: Plugin skeleton + marketplace registration

**Files:**
- Create: `product-designer-goggles/.claude-plugin/plugin.json`
- Create: `product-designer-goggles/README.md` (stub — full version in Task 9)
- Modify: `.claude-plugin/marketplace.json` (append entry)

**Interfaces:**
- Produces: plugin id `product-designer-goggles` v0.1.0; directory layout `spec/`, `skills/`, `commands/`, `manifest/`, `viewer/` used by later tasks.

- [ ] **Step 1: Create plugin manifest**

`product-designer-goggles/.claude-plugin/plugin.json`:

```json
{
  "name": "product-designer-goggles",
  "description": "Product Designer Goggles: the product-side sibling of Architect Goggles — task-scoped product maps (PJM) with a structural CAPABILITY view and a behavioral JOURNEY view, perimeter-gated product scoping, change review as product-impact diffs, user-flow presentations with real screenshots (via project-executor when installed), and a local viewer + HTML deck export.",
  "version": "0.1.0",
  "author": { "name": "Alex" }
}
```

- [ ] **Step 2: Create README stub**

`product-designer-goggles/README.md`:

```markdown
# product-designer-goggles

Product-side sibling of architect-goggles: explains the scope you work on in
product terms — purpose, user journeys, business "why", full product impact of
a change — with diagrams, journey playback, and screenshot presentations.

Status: under construction — see `docs/superpowers/specs/2026-07-12-product-designer-goggles-design.md`.
```

- [ ] **Step 3: Register in marketplace**

In `.claude-plugin/marketplace.json`, append to `plugins` after the `project-executor` entry:

```json
    {
      "name": "product-designer-goggles",
      "source": "./product-designer-goggles",
      "version": "0.1.0",
      "description": "Product maps (PJM): capability view + journey playback with screenshots, product impact diffs, HTML deck export."
    }
```

- [ ] **Step 4: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8')); JSON.parse(require('fs').readFileSync('product-designer-goggles/.claude-plugin/plugin.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add product-designer-goggles .claude-plugin/marketplace.json
git commit -m "product-designer-goggles: plugin skeleton + marketplace registration (v0.1.0)"
```

---

### Task 2: PJM schema v0.1 + example map

**Files:**
- Create: `product-designer-goggles/spec/schema.v0.1.json`
- Create: `product-designer-goggles/viewer/maps/example.json`

**Interfaces:**
- Consumes: PCE v0.4 schema at `architect-goggles/spec/schema.v0.4.json` (fork source — read it first).
- Produces: PJM document shape used by lint (Task 3), skills (Tasks 5-6), viewer (Task 7), deck export (Task 8). Key deltas from PCE listed in Step 1; everything not listed is kept verbatim from PCE v0.4.

- [ ] **Step 1: Write the schema (fork PCE v0.4 with these exact deltas)**

Copy `architect-goggles/spec/schema.v0.4.json` to `product-designer-goggles/spec/schema.v0.1.json`, then apply ALL of the following edits (everything else stays byte-identical):

1. `$id`: `"pjm/schema/v0.1"`. `title`: `"PJM Map Document"`. `description`: `"Task-scoped product map: one model, rendered as CAPABILITY (structure) and JOURNEY (behavior) projections."`
2. `protocol_version`: `{ "const": "pjm-0.1" }`.
3. `meta.intent`: `{ "enum": ["explain", "impact", "present"], "description": "explain: product understanding, canonical journeys. impact: proposed change -> product blast radius + journey regressions (diffs populated). present: journeys destined for screenshot capture + deck export." }`
4. `meta.environment_manifest_ref` description: replace `manifest` wording with `"Path/URL of the PRODUCT.md manifest consumed during generation, if any."`
5. Remove `meta.preset` and `meta.derived_from` properties (presets out of scope v0.1).
6. Remove top-level `expanded_children` property and the `rect` definition (expansion out of scope v0.1); remove `"expandable"` from node properties.
7. `definitions.node.kind` description: `"WHAT it is. Open set; common: capability, screen, role, rule, entity, external_system. NOTE: black box is NOT a kind — it is resolution=suspected."`
8. `definitions.node.metrics`: keep only `fan_in`, `fan_out`, `flows_count` (delete `change_coupling`, `tangle_score`).
9. `advisory.hotspots`: DELETE the property (hotspot machinery not in v0.1). Keep `summary`, `notes` (change `notes.items.properties.kind` enum to `["ux", "business", "risk"]`), `residual_uncertainty`. Add property `"open_questions": { "type": "array", "items": { "type": "string" }, "description": "Unroutable black boxes / unconfirmed whys left for the human." }`.
10. `definitions.edge.kind`: `{ "enum": ["uses", "affects", "governed_by", "navigates_to", "suspected_influence"], "description": "Product-scope relations. suspected_influence: dashed '?' edge from/to a black box." }`
11. `definitions.flow`: add optional properties `"actor": { "type": "string", "description": "Primary actor (role node id) of this journey." }`, `"goal": { "type": "string" }`, `"variant": { "type": "string", "description": "Scenario variant label, e.g. 'empty cart', 'error'." }`; `kind` enum stays as in PCE. In the flow description wording, flows ARE journeys (JOURNEY view renders them).
12. `definitions.step`: add optional properties `"screen": { "type": "string", "description": "Screen node id where this step happens (journey integrity: must exist)." }`, `"business_why": { "type": "string", "description": "Why this step exists for the user/business. Unsourced why must be reflected as suspected via the owning node or advisory." }`, `"screenshot": { "type": "string", "description": "Path relative to the map file, or the literal 'pending'." }`.
13. `flow_diffs` description: `"Proposed BEHAVIORAL changes: how journeys transform under the proposed change. Rendered as ghost/added arrows in JOURNEY view."`

- [ ] **Step 2: Verify schema is valid JSON and deltas landed**

Run: `node -e "const s=JSON.parse(require('fs').readFileSync('product-designer-goggles/spec/schema.v0.1.json','utf8')); if(s.properties.protocol_version.const!=='pjm-0.1')throw 1; if(!s.definitions.edge.properties.kind.enum.includes('navigates_to'))throw 2; if(s.properties.expanded_children)throw 3; if(s.properties.advisory.properties.hotspots)throw 4; if(!s.definitions.step.properties.screenshot)throw 5; console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Write the example map**

`product-designer-goggles/viewer/maps/example.json` — a small self-consistent document exercising every feature (screens, roles, capability, rule, black box, one journey with screenshots pending, one variant, advisory):

```json
{
  "protocol_version": "pjm-0.1",
  "meta": {
    "title": "Checkout — promo code handling",
    "intent": "explain",
    "task": "Understand product scope before fixing promo-code rounding bug",
    "generated_at": "2026-07-12T10:00:00Z",
    "commit_hash": "0000000",
    "analysis_scope": "Cart + checkout promo flow as the shopper experiences it"
  },
  "nodes": [
    { "id": "role_shopper", "display_id": "R1", "kind": "role", "label": "Shopper", "resolution": "confirmed", "scope": "in_focus", "summary": "Buys products; applies promo codes at checkout.", "source_refs": [] },
    { "id": "cap_promo", "display_id": "C1", "kind": "capability", "label": "Promo codes", "resolution": "confirmed", "scope": "in_focus", "summary": "Percentage and fixed-amount discounts applied to the cart total.", "source_refs": ["src/promo/apply.ts:10-80"] },
    { "id": "scr_cart", "display_id": "S1", "kind": "screen", "label": "Cart", "resolution": "confirmed", "scope": "in_focus", "summary": "Shows items, totals, promo input.", "source_refs": ["src/pages/cart.tsx:1-40"] },
    { "id": "scr_checkout", "display_id": "S2", "kind": "screen", "label": "Checkout", "resolution": "confirmed", "scope": "in_focus", "summary": "Payment + final total incl. discount.", "source_refs": ["src/pages/checkout.tsx:1-60"] },
    { "id": "rule_single_promo", "display_id": "BR1", "kind": "rule", "label": "One promo per order", "resolution": "confirmed", "scope": "in_focus", "summary": "Business rule: promos do not stack.", "source_refs": ["src/promo/apply.ts:22-30"] },
    { "id": "bb_loyalty", "display_id": "BB1", "kind": "capability", "label": "Loyalty points interaction?", "resolution": "suspected", "scope": "peripheral", "evidence": "loyalty service reads cart_total in loyalty/accrual.ts:15 — discount may change points earned", "relevance": "high", "source_refs": ["loyalty/accrual.ts:15-15"] }
  ],
  "edges": [
    { "id": "e_shopper_cart", "display_id": "PE1", "from": "role_shopper", "to": "scr_cart", "kind": "uses" },
    { "id": "e_cart_checkout", "display_id": "PE2", "from": "scr_cart", "to": "scr_checkout", "kind": "navigates_to" },
    { "id": "e_promo_rule", "display_id": "PE3", "from": "cap_promo", "to": "rule_single_promo", "kind": "governed_by" },
    { "id": "e_cart_promo", "display_id": "PE4", "from": "scr_cart", "to": "cap_promo", "kind": "uses" },
    { "id": "e_promo_loyalty", "display_id": "PE5", "from": "cap_promo", "to": "bb_loyalty", "kind": "suspected_influence", "evidence": "shared cart_total field" }
  ],
  "flows": [
    {
      "id": "j_apply_promo", "title": "Apply promo code at checkout", "kind": "happy_path",
      "actor": "role_shopper", "goal": "Pay less using a promo code", "variant": "valid code",
      "participants": ["role_shopper", "scr_cart", "cap_promo", "scr_checkout"],
      "verified_by": "static_analysis",
      "steps": [
        { "seq": 1, "explanation": "Shopper enters code SAVE10 in the cart.", "screen": "scr_cart", "business_why": "Discounts drive conversion; entry point is the cart.", "screenshot": "pending",
          "arrows": [ { "from": "role_shopper", "to": "scr_cart", "type": "call", "label": "enter SAVE10", "edge": "e_shopper_cart" } ] },
        { "seq": 2, "explanation": "Cart asks promo capability to validate and price the discount; single-promo rule enforced.", "screen": "scr_cart", "business_why": "Rule BR1 protects margins.", "screenshot": "pending",
          "arrows": [ { "from": "scr_cart", "to": "cap_promo", "type": "call", "label": "validate+apply", "edge": "e_cart_promo" }, { "from": "cap_promo", "to": "scr_cart", "type": "return", "label": "new total" } ] },
        { "seq": 3, "explanation": "Shopper proceeds to checkout; discounted total shown.", "screen": "scr_checkout", "business_why": "Total transparency before payment reduces abandonment.", "screenshot": "pending",
          "arrows": [ { "from": "scr_cart", "to": "scr_checkout", "type": "async", "label": "navigate", "edge": "e_cart_checkout" } ] }
      ]
    }
  ],
  "advisory": {
    "summary": "Promo application is cart-centric; checkout only displays results. Loyalty interaction is the open risk.",
    "notes": [ { "node": "cap_promo", "kind": "business", "note": "Rounding of percentage discounts is where the reported bug lives." } ],
    "open_questions": [ "BB1: does discount change loyalty accrual?" ],
    "residual_uncertainty": "Marketing attribution of promo usage not scanned."
  }
}
```

- [ ] **Step 4: Verify example parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('product-designer-goggles/viewer/maps/example.json','utf8')); console.log('OK')"`
Expected: `OK` (full schema validation comes with lint in Task 3).

- [ ] **Step 5: Commit**

```bash
git add product-designer-goggles/spec product-designer-goggles/viewer
git commit -m "product-designer-goggles: PJM schema v0.1 + example map"
```

---

### Task 3: Lint fork

**Files:**
- Create: `product-designer-goggles/spec/lint.mjs` (fork of `architect-goggles/spec/lint.mjs` — read the source fully before adapting)

**Interfaces:**
- Consumes: `spec/schema.v0.1.json`, example map (Task 2).
- Produces: CLI `node spec/lint.mjs <map.json>` — exit 0 + recomputed metrics on stdout when valid; exit 1 with itemized errors when not. Checks used by skills and acceptance: schema conformance, perimeter closure, evidence rules, journey integrity, screenshot path existence.

- [ ] **Step 1: Fork and adapt**

Copy `architect-goggles/spec/lint.mjs` → `product-designer-goggles/spec/lint.mjs`. Keep its generic machinery (schema load/validate approach, ref-integrity checks, metric recomputation, CLI shape). Apply:

1. Schema path → `schema.v0.1.json`; accept only `protocol_version === "pjm-0.1"`.
2. Delete tangle_score/change_coupling computation and the hotspot-eligible set logic entirely (schema no longer has them). Metrics recomputed and printed: `fan_in`, `fan_out` (from `edges`), `flows_count` (participation in `flows`).
3. Keep/port existing checks: every `edge.from/to` references an existing node id; every `flow.participants[]` entry references a node; every `arrow.from/to` is in that flow's participants; `arrow.edge` (when set) references an existing edge; `resolution: suspected|dismissed` requires non-empty `evidence`; `suspected_influence` edges require `evidence`.
4. ADD journey-integrity checks (new `function checkJourneys(doc, mapDir)`):

```javascript
function checkJourneys(doc, mapDir) {
  const errs = [];
  const nodeById = new Map(doc.nodes.map(n => [n.id, n]));
  for (const flow of doc.flows ?? []) {
    if (flow.actor && !nodeById.has(flow.actor))
      errs.push(`journey ${flow.id}: actor '${flow.actor}' is not a node`);
    for (const step of flow.steps ?? []) {
      if (step.screen) {
        const s = nodeById.get(step.screen);
        if (!s) errs.push(`journey ${flow.id} step ${step.seq}: screen '${step.screen}' is not a node`);
        else if (s.kind !== 'screen') errs.push(`journey ${flow.id} step ${step.seq}: '${step.screen}' is kind '${s.kind}', expected 'screen'`);
      }
      if (step.screenshot && step.screenshot !== 'pending') {
        const p = path.resolve(mapDir, step.screenshot);
        if (!fs.existsSync(p)) errs.push(`journey ${flow.id} step ${step.seq}: screenshot missing: ${step.screenshot}`);
      }
    }
  }
  return errs;
}
```

Call it from the main validation sequence with `mapDir = path.dirname(path.resolve(mapFile))`; merge its errors into the failure output.

- [ ] **Step 2: Verify lint passes the example map**

Run: `node product-designer-goggles/spec/lint.mjs product-designer-goggles/viewer/maps/example.json`
Expected: exit 0; output includes recomputed metrics; no errors.

- [ ] **Step 3: Verify lint catches a broken map**

Run: `node -e "const m=JSON.parse(require('fs').readFileSync('product-designer-goggles/viewer/maps/example.json','utf8')); m.flows[0].steps[0].screen='nope'; m.flows[0].steps[1].screenshot='missing.png'; require('fs').writeFileSync('product-designer-goggles/spec/.lint-test.json', JSON.stringify(m))" && node product-designer-goggles/spec/lint.mjs product-designer-goggles/spec/.lint-test.json; node -e "require('fs').unlinkSync('product-designer-goggles/spec/.lint-test.json')"`
Expected: lint exits non-zero, errors mention `screen 'nope' is not a node` and `screenshot missing`.

- [ ] **Step 4: Commit**

```bash
git add product-designer-goggles/spec/lint.mjs
git commit -m "product-designer-goggles: PJM lint (schema + closure + journey integrity)"
```

---

### Task 4: Agent contract + PRODUCT.md template + /product command

**Files:**
- Create: `product-designer-goggles/spec/agent-contract.md`
- Create: `product-designer-goggles/manifest/PRODUCT.md`
- Create: `product-designer-goggles/commands/product.md`

**Interfaces:**
- Consumes: schema/lint (Tasks 2-3). Reference for tone/shape: `architect-goggles/spec/agent-contract.md` (read once).
- Produces: contract §§ referenced by all skills; `/product` entry that orchestrates the four skills (Tasks 5-6).

- [ ] **Step 1: Write the agent contract**

`product-designer-goggles/spec/agent-contract.md`:

```markdown
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
```

- [ ] **Step 2: Write the PRODUCT.md template**

`product-designer-goggles/manifest/PRODUCT.md`:

```markdown
# PRODUCT manifest (template)

Slow-changing product knowledge that is NOT derivable from code. Copy to the
target project (suggested: `.claude-memory/product/PRODUCT.md`) and fill in.
Agents consume it per agent-contract §2 — entries referenced in maps get
`manifest_ref`.

## Personas
<!-- one per line: name — who they are, what they want. e.g.
Shopper — end customer; wants fast checkout, trusts totals. -->

## Business rules not visible in code
<!-- rules enforced by ops/legal/convention. e.g.
Refunds over 500 EUR require manual approval (ops process, not in code). -->

## Domain glossary
<!-- term — meaning as THIS product uses it. -->

## Out-of-code processes
<!-- manual steps, external systems, support workflows that complete a journey. -->

## Known product debt / sharp edges
<!-- places where behavior surprises users; historical reasons. -->
```

- [ ] **Step 3: Write the /product command**

`product-designer-goggles/commands/product.md`:

```markdown
---
description: Build a product-side map for a task — capability scope + user journeys, with optional impact diff and screenshot deck. Orchestrates product-map → journey-trace → (product-impact) → (present).
---

# /product

Input: the task (bug, feature, "explain this area"). Contract:
`spec/agent-contract.md` (this plugin). All documents lint before use.

1. Invoke skill `product-map` — capability scope, STOP at the perimeter gate.
2. After the human routes black boxes, invoke `journey-trace` for the journeys
   relevant to the task (happy path + the variant where the bug/change lives).
3. If the task proposes a change: invoke `product-impact`.
4. If frontend work and the human wants visuals: invoke `present`.
5. Register the map with the viewer (`node viewer/register-map.mjs <map>`) and
   give the human the viewer URL + (if exported) the deck path.
```

- [ ] **Step 4: Verify files exist and command frontmatter parses**

Run: `node -e "const fs=require('fs'); ['spec/agent-contract.md','manifest/PRODUCT.md','commands/product.md'].forEach(f=>{const s=fs.readFileSync('product-designer-goggles/'+f,'utf8'); if(!s.length) throw new Error(f)}); const c=fs.readFileSync('product-designer-goggles/commands/product.md','utf8'); if(!/^---\n[\s\S]*?description:[\s\S]*?\n---/.test(c)) throw new Error('frontmatter'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add product-designer-goggles/spec/agent-contract.md product-designer-goggles/manifest product-designer-goggles/commands
git commit -m "product-designer-goggles: agent contract, PRODUCT.md template, /product command"
```

---

### Task 5: Skills — product-map + journey-trace

**Files:**
- Create: `product-designer-goggles/skills/product-map/SKILL.md`
- Create: `product-designer-goggles/skills/journey-trace/SKILL.md`

**Interfaces:**
- Consumes: agent contract §§ (Task 4), schema/lint (Tasks 2-3).
- Produces: skill names `product-map`, `journey-trace` referenced by `/product` and ACCEPTANCE.

- [ ] **Step 1: Write product-map skill**

`product-designer-goggles/skills/product-map/SKILL.md`:

```markdown
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
3. **Derive structure from code, never from memory**: routes/pages → screen
   nodes; feature modules/domain services → capabilities; permission/role
   checks → roles; validation/pricing/authorization logic → rule nodes;
   core persisted objects → entities. Every confirmed node: `source_refs`.
4. **Product perimeter broad-scan** (always; grep-grade, no permission needed):
   other screens using the in-scope capability; shared entities written
   elsewhere; rules referenced by out-of-scope code; notification/email/
   analytics side effects. Concrete hint → suspected node +
   `suspected_influence` edge + evidence + relevance (§5).
5. **Assign display ids** (contract §4) and edges (`uses / affects /
   governed_by / navigates_to`).
6. **Lint**: `node spec/lint.mjs <map>`; stamp recomputed metrics (§8). Fix
   until clean.
7. **STOP at the perimeter gate**: present the map summary + black-box list
   with evidence; the human routes each. Agentic fallback: contract §5.
8. After routing, update resolutions/evidence, re-lint, register with viewer.

## Rules
- No node without resolution; no suspected/dismissed without evidence.
- Business "why" only with a source (§3) — else advisory.open_questions.
- Do not build journeys here — that is journey-trace.
```

- [ ] **Step 2: Write journey-trace skill**

`product-designer-goggles/skills/journey-trace/SKILL.md`:

```markdown
---
name: journey-trace
description: Add user journeys (flows with actor lanes, screens, business whys) to an existing PJM map — happy path, edge variants, and the scenario where a bug manifests. Use after product-map when the task needs "how it works for the user" step by step.
---

# journey-trace

Extends an existing PJM map's `flows[]`. Obey `spec/agent-contract.md`
(§6 journeys, §3 unsourced-why, §7 screenshots).

## Procedure

1. Load the task's map (`.claude-memory/product/maps/<task-slug>.json`);
   product-map must have run (nodes exist, gate passed or fallback recorded).
2. Pick journeys the task needs: the canonical happy path; the variant where
   the bug/change lives (`kind: bug_path` for actual defects, `edge_case` for
   unusual-but-valid); each variant = separate flow with `variant` label.
3. For each journey: `actor` (role node id), `goal`, ordered `participants`
   (actor first, then screens/capabilities in first-touch order).
4. Steps: `seq`, `explanation` (actor action + system response, product
   language), `screen` (screen node id), `business_why` (sourced — else
   suspect it, §3), `arrows` (actor→screen `call` for user actions,
   screen→capability `call`/`return` for system work, `async` for
   navigation/background). `arrow.edge` links to structural edges where they
   exist.
5. `verified_by`: `static_analysis` (derived from code) or `hypothesis`
   (needs confirmation); upgraded to `local_run`/`static_and_run` only by the
   present skill after real captures.
6. Screenshots: leave unset, or `pending` for steps the present skill should
   capture (frontend steps worth showing).
7. Lint, fix, re-register the map.

## Rules
- Every step's screen must be a screen node (lint enforces).
- Never mark verified_by local_run without an actual run.
- Bug journeys show WHERE the product breaks for the user, not stack traces.
```

- [ ] **Step 3: Verify frontmatter of both**

Run: `node -e "const fs=require('fs'); [['product-map','skills/product-map/SKILL.md'],['journey-trace','skills/journey-trace/SKILL.md']].forEach(([n,f])=>{const s=fs.readFileSync('product-designer-goggles/'+f,'utf8'); const m=s.match(/^---\n([\s\S]*?)\n---/); if(!m||!m[1].includes('name: '+n)) throw new Error(n)}); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add product-designer-goggles/skills/product-map product-designer-goggles/skills/journey-trace
git commit -m "product-designer-goggles: product-map + journey-trace skills"
```

---

### Task 6: Skills — product-impact + present

**Files:**
- Create: `product-designer-goggles/skills/product-impact/SKILL.md`
- Create: `product-designer-goggles/skills/present/SKILL.md`

**Interfaces:**
- Consumes: agent contract (Task 4), journeys (Task 5 vocabulary), deck exporter CLI `node viewer/export-deck.mjs <map.json> [--out <dir>]` (Task 8 — name fixed here).
- Produces: skill names `product-impact`, `present`.

- [ ] **Step 1: Write product-impact skill**

`product-designer-goggles/skills/product-impact/SKILL.md`:

```markdown
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
5. Lint; register; the human reviews the diff in the viewer BEFORE any code
   is written. Present the affected-journeys list in chat too (one line each).

## Rules
- Product language everywhere ("shopper loses saved promo"), not
  implementation language ("PromoService signature changes").
- No silent scope-trimming: if blast radius is huge, SAY it is huge.
```

- [ ] **Step 2: Write present skill**

`product-designer-goggles/skills/present/SKILL.md`:

```markdown
---
name: present
description: Turn PJM journeys into a shareable presentation — capture real screenshots of each journey step via the project-executor plugin (when installed and the app runs locally), attach them to the map, and export a self-contained HTML deck. Use for frontend work when the human wants to SEE how the flow looks and behaves per scenario.
---

# present

Obey `spec/agent-contract.md` §7 (screenshots) and §9 (storage). Degrades
gracefully: no project-executor → no captures, deck ships with placeholders.

## Procedure

1. Load the map; collect journeys with steps marked `screenshot: "pending"`.
2. **Detect project-executor**: is the `execute` skill or `executor` agent
   available? NO → skip to step 5 (placeholders). YES →
3. **Capture per journey**: compose a scenario from the journey steps (start
   URL, actions per step, expected state per step, one screenshot per
   pending step named `<journey-id>-s<seq>.png`). Hand it to project-executor:
   interactive → `/execute` full-test with the scenario; agentic → spawn the
   `executor` agent. project-executor owns app start, auth, seeds, selectors.
   Variants = separate runs of the same journey with different state.
4. **Attach**: copy captured screenshots from the project-executor report dir
   into `.claude-memory/product/assets/<journey-id>/`; set each step's
   `screenshot` to the relative path (from the map file); upgrade the
   journey's `verified_by` to `local_run` (or `static_and_run`). Steps whose
   capture failed keep `pending`; record the failure + report verdict in
   `advisory.notes` (kind: risk).
5. **Lint** (screenshot paths must exist), then **export the deck**:
   `node viewer/export-deck.mjs <map.json> --out .claude-memory/product/decks/`
   → one self-contained HTML file; print its path.
6. Report: captured X of Y steps, deck path, any degradations.

## Rules
- Never fake, stage, or edit screenshots; a placeholder is honest, a mockup
  is not.
- Never block on capture: app won't start / executor blocked → placeholders
  + advisory note, deck still exports.
- Screenshots may contain real local data — they live under `.claude-memory/`
  (gitignored, §9); warn if the target repo would commit them.
```

- [ ] **Step 3: Verify frontmatter of both**

Run: `node -e "const fs=require('fs'); [['product-impact','skills/product-impact/SKILL.md'],['present','skills/present/SKILL.md']].forEach(([n,f])=>{const s=fs.readFileSync('product-designer-goggles/'+f,'utf8'); const m=s.match(/^---\n([\s\S]*?)\n---/); if(!m||!m[1].includes('name: '+n)) throw new Error(n)}); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add product-designer-goggles/skills/product-impact product-designer-goggles/skills/present
git commit -m "product-designer-goggles: product-impact + present skills"
```

---

### Task 7: Viewer fork + adaptation

**Files:**
- Create: `product-designer-goggles/viewer/` — fork of `architect-goggles/viewer/` (`index.html`, `serve.mjs`, `register-map.mjs`, `vendor/`, plus `maps/example.json` already added in Task 2; do NOT copy architect-goggles' `maps/example.json` over it)
- Modify: `product-designer-goggles/viewer/index.html` (the adaptation)

**Interfaces:**
- Consumes: PJM schema fields (Task 2): edge kinds, node kinds, `flow.actor/goal/variant`, `step.screen/business_why/screenshot`.
- Produces: working viewer at `node viewer/serve.mjs` (port 4173, `PORT` env override if the fork already supports it — do not add new env handling); `node viewer/register-map.mjs <file>` registry flow, used by skills and ACCEPTANCE.

**NOTE for the implementer:** this task requires reading the forked `index.html` (≈1000 lines) fully before editing. The list below is the complete required delta; apply it in the fork's existing style. If the fork's internal structure makes an item ambiguous, report NEEDS_CONTEXT with the specific conflict instead of improvising.

- [ ] **Step 1: Copy the viewer**

```bash
cp architect-goggles/viewer/serve.mjs architect-goggles/viewer/register-map.mjs product-designer-goggles/viewer/
cp architect-goggles/viewer/index.html product-designer-goggles/viewer/index.html
mkdir -p product-designer-goggles/viewer/vendor && cp architect-goggles/viewer/vendor/* product-designer-goggles/viewer/vendor/
```

(`viewer/maps/` already exists with the PJM example from Task 2. Copy `architect-goggles/viewer/.gitignore` too if it exists.)

- [ ] **Step 2: Adapt index.html — required delta (complete list)**

1. **Protocol acceptance**: wherever the viewer checks `protocol_version` (search `"0.4"` / `protocol_version`), accept `"pjm-0.1"` (and only it). Page `<title>` and visible branding → "Product Designer Goggles".
2. **View names**: rename UI labels MAP → CAPABILITY, SEQUENCE → JOURNEY (labels/buttons/legend only — keep internal function/variable names unchanged to minimize diff).
3. **Edge kind styling**: the style/legend table keyed by edge kind (search `sync_call`) gains the PJM kinds — `uses` (solid), `navigates_to` (solid + arrowhead emphasis), `governed_by` (dotted), `affects` (dashed), `suspected_influence` (keep the existing dashed-`?` black-box styling verbatim). Remove `sync_call/async_msg/data_dep` entries.
4. **Node kind shapes**: where node kind affects rendering (search for kind-based branches; if none exist beyond labels, add a small kind→CSS-class map at node render): `screen` = rectangle with a top title bar stripe, `role` = rounded pill, `rule` = diamond-ish (CSS transform or border trick acceptable), `entity` = plain rectangle, `capability` = the existing default node look. Kinds outside the set fall back to default. Keep black-box (suspected) styling untouched.
5. **JOURNEY view**: participants render as lanes exactly as SEQUENCE lifelines do today (no structural change); if the flow has `actor`, prefix the flow title with `«actor-label»`; show `goal` and `variant` (when set) in the flow header/subtitle.
6. **Screenshot side-panel** (the one genuinely new component): in JOURNEY view, add a collapsible right-hand panel. During playback, when the current step has `screenshot` set and ≠ `pending`, load the image (path resolved relative to the map's own URL/dir) into the panel with the step's `business_why` as caption; click image → full-size overlay (reuse the viewer's existing overlay/modal pattern if present, else a minimal fixed-position lightbox div). Steps with `pending`/no screenshot → panel shows a neutral placeholder block with the text "no capture". New code in the fork's existing vanilla-JS style; suggested skeleton:

```html
<div id="shotPanel" class="shot-panel">
  <div id="shotFrame"><img id="shotImg" alt=""/><div id="shotEmpty">no capture</div></div>
  <div id="shotWhy" class="shot-why"></div>
</div>
```

```javascript
function updateShotPanel(step, mapBaseUrl) {
  const img = document.getElementById('shotImg'), empty = document.getElementById('shotEmpty');
  const why = document.getElementById('shotWhy');
  why.textContent = step?.business_why || '';
  if (step?.screenshot && step.screenshot !== 'pending') {
    img.src = new URL(step.screenshot, mapBaseUrl).href;
    img.style.display = 'block'; empty.style.display = 'none';
  } else {
    img.style.display = 'none'; empty.style.display = 'block';
  }
}
```

Call `updateShotPanel(currentStep, mapBaseUrl)` from the existing playback step-change handler.
7. **Diff mode + heat overlay**: keep working as-is (they read `diffs`/`flow_diffs`/metrics that PJM retains). Only rename user-visible labels if they say "code"/"component" where "product"/"capability" is meant.
8. **Serve static assets**: confirm `serve.mjs` serves files referenced relative to maps (screenshots under `.claude-memory/...` are ABSOLUTE-path outside the viewer dir — for v0.1 the deck covers screenshot viewing outside the viewer; the viewer panel must handle a failed image load by falling back to the placeholder (add `img.onerror`), not break playback).

- [ ] **Step 3: Verify — registry + serve smoke test**

Run: `cd product-designer-goggles/viewer && node register-map.mjs maps/example.json`
Expected: prints a hash/registration confirmation (same behavior as architect-goggles).

Run: `cd product-designer-goggles/viewer && node serve.mjs & sleep 1; curl -s http://localhost:4173/ | grep -qi "product designer goggles" && curl -s "http://localhost:4173/maps/example.json" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{JSON.parse(d);console.log('SERVE OK')})"; kill %1`
Expected: `SERVE OK` (and grep succeeds). On Windows run the two commands in separate shells if job control misbehaves.

- [ ] **Step 4: Verify — browser smoke test (playwright MCP or manual)**

With serve.mjs running, open `http://localhost:4173/?map=example`: CAPABILITY view renders 6 nodes (5 confirmed + BB1 dashed), JOURNEY view shows flow `J? Apply promo code` with actor lane `Shopper`, playback advances 3 steps, screenshot panel shows "no capture" placeholders (all pending), no console errors. Record what was checked in the report.

- [ ] **Step 5: Commit**

```bash
git add product-designer-goggles/viewer
git commit -m "product-designer-goggles: viewer fork adapted (capability/journey views, screenshot panel)"
```

---

### Task 8: Deck exporter

**Files:**
- Create: `product-designer-goggles/viewer/export-deck.mjs`

**Interfaces:**
- Consumes: PJM map JSON (any lint-clean document).
- Produces: CLI `node viewer/export-deck.mjs <map.json> [--out <dir>]` → writes `<out>/<map-basename>-deck.html` (default out: map's directory), self-contained (screenshots embedded as base64 data URIs), prints the written path. Used by the present skill (Task 6) and ACCEPTANCE.

- [ ] **Step 1: Write the exporter**

`product-designer-goggles/viewer/export-deck.mjs`:

```javascript
#!/usr/bin/env node
// Export PJM journeys as a self-contained HTML deck (screenshots inlined as data URIs).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const mapFile = args.find(a => !a.startsWith('--'));
const outIdx = args.indexOf('--out');
if (!mapFile) { console.error('usage: node export-deck.mjs <map.json> [--out <dir>]'); process.exit(1); }

const mapPath = path.resolve(mapFile);
const mapDir = path.dirname(mapPath);
const outDir = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : mapDir;
const doc = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
if (doc.protocol_version !== 'pjm-0.1') { console.error(`not a PJM v0.1 document: ${doc.protocol_version}`); process.exit(1); }

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nodeById = new Map((doc.nodes ?? []).map(n => [n.id, n]));
const label = id => nodeById.get(id)?.label ?? id;

function shotDataUri(rel) {
  if (!rel || rel === 'pending') return null;
  const p = path.resolve(mapDir, rel);
  if (!fs.existsSync(p)) return null;
  const ext = path.extname(p).slice(1).toLowerCase();
  const mime = ext === 'jpg' ? 'jpeg' : ext;
  return `data:image/${mime};base64,${fs.readFileSync(p).toString('base64')}`;
}

const journeyHtml = (doc.flows ?? []).map(f => {
  const steps = (f.steps ?? []).map(s => {
    const uri = shotDataUri(s.screenshot);
    const shot = uri
      ? `<img src="${uri}" alt="step ${s.seq}">`
      : `<div class="ph">no capture${s.screenshot === 'pending' ? ' (pending)' : ''}</div>`;
    return `<div class="card">
      <div class="shot">${shot}</div>
      <div class="txt">
        <div class="step-no">Step ${s.seq}${s.screen ? ` · ${esc(label(s.screen))}` : ''}</div>
        <div class="expl">${esc(s.explanation)}</div>
        ${s.business_why ? `<div class="why">Why: ${esc(s.business_why)}</div>` : ''}
        ${s.code_ref ? `<div class="ref">${esc(s.code_ref)}</div>` : ''}
      </div>
    </div>`;
  }).join('\n');
  const sub = [f.actor ? `Actor: ${esc(label(f.actor))}` : '', f.goal ? `Goal: ${esc(f.goal)}` : '', f.variant ? `Variant: ${esc(f.variant)}` : '', f.verified_by ? `Verified: ${esc(f.verified_by)}` : '']
    .filter(Boolean).join(' · ');
  return `<section><h2>${esc(f.title)}</h2><div class="sub">${sub}</div>${steps}</section>`;
}).join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(doc.meta?.title ?? 'PJM deck')}</title>
<style>
 body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f5f5f7;color:#1c1c1e}
 header{padding:24px 32px;background:#fff;border-bottom:1px solid #ddd}
 h1{margin:0 0 4px;font-size:22px} .meta{color:#666;font-size:13px}
 section{max-width:960px;margin:32px auto;padding:0 16px}
 h2{font-size:18px;margin:0 0 2px} .sub{color:#666;font-size:13px;margin-bottom:16px}
 .card{display:flex;gap:16px;background:#fff;border:1px solid #ddd;border-radius:10px;padding:16px;margin-bottom:12px}
 .shot{flex:0 0 380px} .shot img{max-width:100%;border:1px solid #ccc;border-radius:6px}
 .ph{width:100%;min-height:120px;display:flex;align-items:center;justify-content:center;background:#eee;border-radius:6px;color:#999;font-size:13px}
 .txt{flex:1} .step-no{font-weight:600;font-size:13px;color:#888;margin-bottom:4px}
 .expl{margin-bottom:6px} .why{font-size:13px;color:#4a5;font-style:italic}
 .ref{font-size:12px;color:#999;font-family:monospace;margin-top:4px}
 @media(max-width:720px){.card{flex-direction:column}.shot{flex:none}}
</style></head><body>
<header><h1>${esc(doc.meta?.title ?? '')}</h1>
<div class="meta">${esc(doc.meta?.task ?? '')} · generated ${esc(doc.meta?.generated_at ?? '')} · commit ${esc(doc.meta?.commit_hash ?? '')}</div></header>
${journeyHtml}
</body></html>`;

fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `${path.basename(mapPath, '.json')}-deck.html`);
fs.writeFileSync(outFile, html);
console.log(outFile);
```

- [ ] **Step 2: Verify — export the example map**

Run: `node product-designer-goggles/viewer/export-deck.mjs product-designer-goggles/viewer/maps/example.json --out "$TMPDIR_OR_SCRATCH"` (use any scratch dir; then `node -e` check):
`node -e "const s=require('fs').readFileSync(process.argv[1],'utf8'); ['Apply promo code','no capture (pending)','Why: '].forEach(k=>{if(!s.includes(k))throw new Error(k)}); console.log('DECK OK')" <printed path>`
Expected: `DECK OK`

- [ ] **Step 3: Verify — screenshot embedding**

Run (creates a 1px png, points a copy of the example at it, exports, checks data URI):

```bash
node -e "
const fs=require('fs'),path=require('path');
const dir='product-designer-goggles/viewer/maps';
fs.writeFileSync(path.join(dir,'.t.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'));
const m=JSON.parse(fs.readFileSync(path.join(dir,'example.json'),'utf8'));
m.flows[0].steps[0].screenshot='.t.png';
fs.writeFileSync(path.join(dir,'.t.json'),JSON.stringify(m));
"
node product-designer-goggles/viewer/export-deck.mjs product-designer-goggles/viewer/maps/.t.json
node -e "const s=require('fs').readFileSync('product-designer-goggles/viewer/maps/.t-deck.html','utf8'); if(!s.includes('data:image/png;base64,')) throw new Error('no data uri'); console.log('EMBED OK')"
node -e "['maps/.t.json','maps/.t.png','maps/.t-deck.html'].forEach(f=>require('fs').unlinkSync('product-designer-goggles/viewer/'+f))"
```

Expected: `EMBED OK`, temp files cleaned.

- [ ] **Step 4: Commit**

```bash
git add product-designer-goggles/viewer/export-deck.mjs
git commit -m "product-designer-goggles: HTML deck exporter"
```

---

### Task 9: Fixture page, acceptance checklist, full README, finalize

**Files:**
- Create: `product-designer-goggles/fixtures/promo-shop/server.js`
- Create: `product-designer-goggles/fixtures/promo-shop/package.json`
- Create: `product-designer-goggles/fixtures/ACCEPTANCE.md`
- Modify: `product-designer-goggles/README.md` (replace stub)

**Interfaces:**
- Consumes: everything.
- Produces: runnable acceptance path.

- [ ] **Step 1: Write the fixture (tiny two-page shop, no deps)**

`product-designer-goggles/fixtures/promo-shop/package.json`:

```json
{
  "name": "promo-shop",
  "private": true,
  "scripts": { "start": "node server.js" }
}
```

`product-designer-goggles/fixtures/promo-shop/server.js`:

```javascript
// Two-page fixture for product-designer-goggles acceptance: cart with promo
// input -> checkout with total. Promo SAVE10 gives 10% off a 100.00 cart.
const http = require('http');

const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8">
<title>${title}</title><style>body{font:16px sans-serif;max-width:480px;margin:40px auto}
input,button{font:inherit;padding:6px}</style></head><body>${body}</body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') { res.writeHead(200); res.end('ok'); return; }
  if (url.pathname === '/cart') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page('Cart', `<h1>Cart</h1><p>Concert ticket — 100.00</p>
      <form action="/checkout" method="get">
        <input name="promo" placeholder="Promo code" aria-label="Promo code">
        <button type="submit">Checkout</button></form>`));
    return;
  }
  if (url.pathname === '/checkout') {
    const promo = url.searchParams.get('promo') || '';
    const total = promo === 'SAVE10' ? '90.00' : '100.00';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(page('Checkout', `<h1>Checkout</h1>
      <p>Promo: ${promo ? promo : 'none'}</p><p id="total">Total: ${total}</p>
      <button>Pay</button>`));
    return;
  }
  res.writeHead(302, { location: '/cart' }); res.end();
});

if (require.main === module) {
  server.listen(process.env.PORT || 3124, () =>
    console.log(`promo-shop listening on ${process.env.PORT || 3124}`));
}

module.exports = { server };
```

- [ ] **Step 2: Verify fixture serves**

Run: `cd product-designer-goggles/fixtures/promo-shop && node -e "const {server}=require('./server'); server.listen(3124,async()=>{const t=await (await fetch('http://localhost:3124/checkout?promo=SAVE10')).text(); if(!t.includes('90.00')) throw new Error('promo math'); console.log('FIXTURE OK'); server.close();})"`
Expected: `FIXTURE OK`

- [ ] **Step 3: Write acceptance checklist**

`product-designer-goggles/fixtures/ACCEPTANCE.md`:

```markdown
# product-designer-goggles acceptance (manual, agent-driven)

Fixture: `fixtures/promo-shop` (`npm start`, port 3124). Run scenarios in a
fresh session with cwd = the fixture dir (init a throwaway git repo in it
first: `git init && git add -A && git commit -m x` — maps need commit_hash).

1. Map build + gate: `/product explain the promo checkout flow`
   (product-map produces a lint-clean map with screen nodes /cart /checkout,
   promo capability, shopper role, SAVE10 rule; STOPS at the perimeter gate
   before journeys)
2. Journey trace: continue after routing
   (journey with actor lane, 3+ steps, business_why on each, screenshots
   pending on UI steps; lint clean; map registered; viewer URL printed)
3. Viewer: open the URL
   (CAPABILITY renders kinds with distinct shapes; JOURNEY playback works;
   screenshot panel shows placeholders)
4. Present WITHOUT project-executor (uninstall/disable it or answer "skip"):
   `/product` step 4 → present
   (no failure; deck exported to .claude-memory/product/decks/ with
   placeholder blocks; advisory notes the skipped capture)
5. Present WITH project-executor installed and fixture running:
   (executor captures cart→checkout screenshots; assets land under
   .claude-memory/product/assets/<journey>/; steps get real paths;
   verified_by upgraded to local_run; deck embeds real images side by side
   for variants "valid code" and "no code")
6. Impact: `/product what changes if promo codes become stackable?`
   (diffs modify BR1 rule node with product rationale; flow_diffs show the
   journey gaining a second-promo step; blast radius names checkout total +
   any suspected loyalty-style black boxes; viewer diff mode renders it)
7. Hygiene: `.claude-memory/` gitignored in the fixture repo; no map fails
   lint at any point; unsourced whys appear as open_questions, not facts.
```

- [ ] **Step 4: Replace README stub**

`product-designer-goggles/README.md`:

```markdown
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

Viewer quickstart: `cd viewer && node serve.mjs` → http://localhost:4173,
`node register-map.mjs <map.json>` to register.

Design spec: `docs/superpowers/specs/2026-07-12-product-designer-goggles-design.md`.
```

- [ ] **Step 5: Full-tree verification**

Run: `node -e "const fs=require('fs'); const need=['.claude-plugin/plugin.json','spec/schema.v0.1.json','spec/agent-contract.md','spec/lint.mjs','skills/product-map/SKILL.md','skills/journey-trace/SKILL.md','skills/product-impact/SKILL.md','skills/present/SKILL.md','commands/product.md','manifest/PRODUCT.md','viewer/index.html','viewer/serve.mjs','viewer/register-map.mjs','viewer/export-deck.mjs','viewer/maps/example.json','fixtures/promo-shop/server.js','fixtures/ACCEPTANCE.md','README.md','intro.md']; need.forEach(f=>{if(!fs.existsSync('product-designer-goggles/'+f)) throw new Error(f)}); console.log('ALL PRESENT')"`
Expected: `ALL PRESENT`

Run lint once more end-to-end: `node product-designer-goggles/spec/lint.mjs product-designer-goggles/viewer/maps/example.json`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add product-designer-goggles
git commit -m "product-designer-goggles: fixture, acceptance checklist, README (v0.1.0 complete)"
```

---

## Post-plan note

Milestone mapping: M1 = Tasks 1-3, M2 = Tasks 4-6, M3 = Task 7, M4 = Task 8 (+ present skill in Task 6), M5 = Task 9. Task 7 (viewer) is the judgment-heavy task — dispatch it on a capable model; Tasks 1, 5, 6, 9 are transcription-grade. ACCEPTANCE scenarios are agent-driven manual runs post-implementation — the true test suite; scenario 5 additionally exercises the project-executor integration end-to-end.
