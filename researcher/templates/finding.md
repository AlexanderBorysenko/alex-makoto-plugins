---
title: <short title>
date: <YYYY-MM-DD>
level: <L1|L2|L3>
head: <git rev-parse HEAD at write time>
task-slug: <tasks-manager task journal slug — remove this line if no task is in focus>
files:
  - <evidence file path 1>
  - <evidence file path 2>
---

# <short title>

**Question:** <the research question as asked>

**Answer:** <2-6 sentence summary. Claims without evidence pointers below must
be prefixed "unverified:".>

## Evidence

- `<file>:<line>` — <what this shows>
- <tool> `<query>` → <what it returned, one line>

## For goggles

<FLAT facts only, so architect/product-designer goggles can consume this as pre-verified
evidence. NO PCE vocabulary — no display_ids, no resolution states, no suspected_influence
edges. Researcher emits raw facts + hints; goggles does the PCE interpretation. Empty
sections allowed.>

- Structural facts: <name — file:line — kind (service|module|job|store|...)>. Every one carries
  a `source_ref`; these become confirmed nodes/edges in the map.
- Edges: <from → to — kind (calls|reads|writes|publishes|...) — file:line>
- Boundary-hints: <raw out-of-scope touchpoint reaching into the in-scope subsystem — file:line
  evidence — one-line relevance>. E.g. a migration trigger, cron/scheduler, broker binding,
  shared table. Flat only: do NOT assign a box id, resolution, or edge — goggles formalizes these
  into `suspected` black boxes at its perimeter gate.
