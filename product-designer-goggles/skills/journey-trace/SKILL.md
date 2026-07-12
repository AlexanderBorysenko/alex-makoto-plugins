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
