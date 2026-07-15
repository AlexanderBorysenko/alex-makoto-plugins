---
name: investigate
description: Open or resume a budgeted bug investigation — case file, hypothesis ledger, cheapest-test-first loop, verdict dossier with map tour. Triggers on "investigate", "it's broken", "users report", or bug with unknown cause.
---

# investigate — budgeted bug diagnosis

Diagnosis only. This skill NEVER implements fixes — it ends at a verdict + handoff.
All defect epistemics follow the ISSUE PROTOCOL in `orchestrator/index-rules.md`
(injected every session): two-axis shape/incidence rating, counterfactual-trace check,
ask-don't-assume frequency, relevance triage, executor-over-rhetoric. Every hypothesis
ledger entry uses its per-issue template verbatim.

## 0. Readiness

Auto-init `.claude-memory/cases/` if missing (idempotent, print one init line — suite
readiness protocol). If researcher or project-executor is unusable, STOP and surface
options incl. "waive for this question". If a case slug for this symptom exists, resume it.

**Phase gate (anti-drift):** the moment TRIAGE opens a case, create one todo per
remaining phase (INTAKE transcription, HYPOTHESIZE, ROUND LOOP, EXIT, HANDOFF).
A phase todo may be completed ONLY when its artifacts exist — case file from
`templates/case.md` at `.claude-memory/cases/<slug>.md`, a linted case map, the
viewer link posted. Skipping any phase or artifact requires saying so in chat
with a reason; silent drift into ad-hoc files/prose is a protocol violation.

## 1. INTAKE

Record the symptom VERBATIM (destined for the case title + Symptom section). Ask for repro steps,
logs, screenshots in ONE batched AskUserQuestion. The SAME batch MUST include the
product-intent pair: (1) what behavior is EXPECTED here, and (2) why is the current
behavior considered wrong — and by whom (user observation, product owner, or guess).
A symptom is only a delta against an expectation; without the expectation on record
the investigation has no target. Hold the symptom text and answers in
working memory — do not open the case file yet, triage first. Transcribe them into the
case file only if/when TRIAGE below opens one.

## 2. TRIAGE — L1 fast path

One look (a grep, one file read, the obvious log line). If it yields an obvious culprit
WITH evidence in hand: answer directly, no case, no map. Offer to open a case only if the
user wants the paper trail. Otherwise: create `.claude-memory/cases/<slug>.md` from
`templates/case.md`, generate the initial case map, lint it
(`node architect-goggles/spec/lint.mjs <map>`), and give the user the viewer link
(`/?path=<abs map path>`). The map is the LIVE CASE BOARD — regenerate it every round.

## 3. HYPOTHESIZE

Enumerate plausible causes: use `/research` for structural evidence; consult
architecture cache / tasks-manager memory when present. Each hypothesis = one ledger
entry with an ISSUE PROTOCOL block. ALWAYS include at least one
"environment/data, not code" hypothesis. Rank by prior plausibility.

## 4. ROUND LOOP  (while open hypotheses AND rounds_used < rounds_max)

a. Pick the CHEAPEST DISCRIMINATING TEST — the action that best splits the open
   hypotheses per unit cost. Round 1 first checks whether the INTAKE answers already
   discriminate between hypotheses (reuse as evidence, cost: free) before issuing a
   fresh AskUserQuestion — never re-ask what intake already answered. Cost ladder
   (cheapest first):
   1. ask the user (free — batch all questions in one AskUserQuestion)
   2. read code / git blame (cheap)
   3. logs / DB read-only (cheap)
   4. project-executor repro (expensive)
   5. full E2E (most expensive)
b. Run it. Routing: questions → AskUserQuestion (batched); static evidence → researcher
   (/research); dynamic evidence → project-executor (/execute). Never re-derive what an
   evidence log entry already answers.
c. Update the ledger (eliminate / downgrade / promote — with evidence refs), the
   Evidence log, the Rounds section; increment rounds_used.
d. Regenerate the case map from the case file; remind the user the board refreshes.

## 5. EXIT

- Verdict criteria met (one hypothesis explains the symptom AND survived a falsification
  attempt AND competitors eliminated/downgraded): write the Verdict dossier (prime
  suspect + eliminated list + parking lot + recommended fix), set status: verdict, and
  add a VERDICT TOUR to the case map (MANDATORY — walk symptom → prime suspect →
  evidence; agent-contract §12).
- **Intentional-design verdict**: when provenance (git blame / origin ticket) shows the
  suspect code shape was introduced DELIBERATELY, the product model outranks the code.
  The dossier's "recommended fix" is then a FORMULATED PRODUCT QUESTION — name the
  domain entity whose intended model is ambiguous and the competing models — addressed
  to the product owner/senior. Do NOT enumerate code-fix options until the intent is
  confirmed; a fix menu presented first anchors the user on implementation and can
  break product logic that is the senior card.
- Budget hit first: write the Interim dossier (ranked suspects + "what I'd test next"),
  set status: interim, STOP. The user decides: continue (raise rounds_max) or close.
  NEVER run a round past budget silently.

## 6. HANDOFF

Verdict → offer the normal fix flow (separate task; this skill does not fix). Link the
case into tasks-manager's doc index when that plugin is present. The case file is the
observer-auditable trail — leave it complete.

## Case map generation (every round)

`.claude-memory/maps/case-<slug>.json` — a valid PCE map (architect-goggles schema
v0.5, must pass lint):
- each hypothesis → node `kind: "hypothesis"`; resolution: open→`suspected`,
  eliminated→`dismissed` (reason in `evidence`), confirmed→`confirmed`;
  put the ISSUE PROTOCOL block's `shape:`/`incidence:` lines into the node summary/evidence
  text (the viewer renders badges from them);
- suspected code locations/services → normal PCE nodes with `source_refs` (`"file:line"` STRINGS, never `{file,line}` objects — lint rejects objects; they render as `[object Object]`);
- evidence links → edges `kind: "evidenced_by"` / `"refuted_by"` (evidence/code node → hypothesis node);
- rounds → `meta.case_rounds` [{round, action, outcome}] and `meta.case_rounds_max`;
- verdict → `advisory.summary` + the verdict tour in `tours`;
- `meta.intent: "debug"`; `meta.session_language` = the human's session language code (all case-map prose in that language — contract §10). LLM never writes metric numbers (lint recomputes).

## Hard rules

- No fix implementation inside this skill.
- Never exceed budget silently.
- Orthogonal findings → parking lot, not the ledger.
- Symptom text stays verbatim.
- All epistemics via the ISSUE PROTOCOL pointer — never restate it.
- While a case is open this loop supersedes superpowers:systematic-debugging.
