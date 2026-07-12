---
title: <short title>
date: <YYYY-MM-DD>
level: <L1|L2|L3>
head: <git rev-parse HEAD at write time>
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

<PCE vocabulary so architect/product-designer goggles can consume this
as pre-verified evidence. Empty sections allowed.>

- Nodes: <name — file — kind (service|module|job|store|...)>
- Edges: <from → to — kind (calls|reads|writes|publishes|...)>
- Black-box suspects: <hidden influences worth a perimeter-scan: triggers, cron, broker behavior>
