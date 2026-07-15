# Case Contract v0.1

The case file is the AUTHORITATIVE state of an investigation. The case map JSON
(`.claude-memory/maps/case-<slug>.json`) is a PROJECTION regenerated from this file
every round — never edit the map directly.

Location: `.claude-memory/cases/<slug>.md`

## Format

```markdown
---
title: <symptom, verbatim from user>
slug: <kebab>
status: open | verdict | interim | closed
opened: <date>
budget: { rounds_max: 3, rounds_used: 0 }
task-slug: <tasks-manager journal slug, when present>
map: ../maps/case-<slug>.json
---

## Symptom (verbatim)
<user's words, unedited. Never paraphrase away details.>

## Reproduction
status: not-attempted | reproduced (evidence ref) | cannot-reproduce (what was tried)

## Hypothesis ledger
### H1 — <one line>            [open | eliminated | confirmed]
<ISSUE PROTOCOL template block — verbatim format from orchestrator/index-rules.md>
eliminated-because: <reason + evidence ref>        # only when eliminated

## Evidence log
- E1 <date> <source: user-answer|code|log|db|executor-run> — <one line + ref>

## Questions
- Q1 [asked|answered] <question> → <answer>

## Rounds
- R1: <action taken, cost class, hypotheses affected>

## Verdict / Interim dossier
prime suspect: H<n> (shape/incidence/repro one-liner)
eliminated: H2 (<reason>), H3 (<reason>)
parking lot: <orthogonal findings, one line each>
recommended fix: <one paragraph>
```

## Rules

1. **Symptom stays verbatim.** Quote the user; details you'd paraphrase away are evidence.
2. **Every hypothesis carries an ISSUE PROTOCOL block** — the canonical template lives in
   `orchestrator/index-rules.md` § ISSUE PROTOCOL (injected into every session). Use it
   verbatim; do not restate or fork the protocol here.
3. **Elimination requires reason + evidence ref.** Eliminated hypotheses are KEPT — they are
   the noise dossier the user (the judge) reviews. Mirrors dismissed black-box semantics
   (architect-goggles agent-contract §2).
4. **Budget is enforced:** `rounds_used` increments every round; when it reaches
   `rounds_max`, STOP and write an interim dossier (status: interim). Continuing requires
   the user explicitly granting more rounds (bump `rounds_max`).
5. **Map regeneration:** after every ledger/evidence update, regenerate the case map from
   this file (see SKILL §case-map). The viewer picks up the change on refresh
   (canonical-file rule, architect-goggles agent-contract §8).
6. **Verdict criteria:** one hypothesis explains the symptom AND survived a falsification
   attempt AND competitors are eliminated or downgraded. Anything less at budget end is an
   interim dossier, not a verdict.
7. **Orthogonal findings go to the parking lot**, never into the ledger.
