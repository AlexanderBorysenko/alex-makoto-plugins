---
description: Build a product-side map for a task — capability scope + user journeys, with optional impact diff and screenshot deck. Orchestrates product-map → journey-trace → (product-impact) → (present).
---

# /product

Input: the task (bug, feature, "explain this area"). Contract:
`spec/agent-contract.md` (this plugin). All documents lint before use.

1. Invoke skill `product-map` — capability scope (discovery delegated to researcher),
   STOP at the perimeter gate.
2. After the human routes black boxes, invoke `journey-trace` for the journeys
   relevant to the task (happy path + the variant where the bug/change lives).
3. If the task proposes a change: invoke `product-impact`.
4. If frontend work and the human wants visuals: invoke `present`.
5. Save the canonical map file, start `viewer/serve.mjs` (its own port per goggle) and
   give the human the `?path=<url-encoded absolute path>` viewer URL + (if exported) the deck path.
