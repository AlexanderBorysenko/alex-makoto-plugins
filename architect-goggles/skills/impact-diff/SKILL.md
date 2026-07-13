---
name: impact-diff
description: Model a proposed change on a PCE map - structural diff, behavioral flow diffs, blast radius and flow-regression analysis. Use whenever proposing a fix or extension so the human can review the change as a diagram diff before any code is written.
---

# impact-diff

Adds `diffs[]`, `flow_diffs[]` and `advisory` to an existing map. Obey `spec/agent-contract.md` §6-7.

## Procedure

1. Express the proposed change as structural ops: add/modify/remove node/edge, each with `rationale`.
2. **Derive behavioral consequences**: for every flow passing through touched nodes, compute the
   flow_diff — `removed_step_seqs`, `added_steps`, `note`. A change proposal without flow_diffs
   is incomplete: structure and behavior must both be thought through.
3. **Blast radius**: reverse-walk explicit edges from touched nodes (dependents, transitively).
   Report alongside: unresolved `suspected` nodes within the radius —
   "N explicit dependents + M unconfirmed suspicions; recommend investigating BBx first".
4. **Flow regression check**: if a flow the user did NOT intend to touch changes — red-flag it
   in `advisory` explicitly, naming the flow and the unintended arrows.
5. **Hotspot advisory**: if a touched node's tangle_score / metrics indicate a mess
   (high fan_in×fan_out, many unrelated flows, cycles, high change_coupling, black boxes clustering),
   recommend untangling BEFORE the fix, with a concrete refactoring diff as an alternative path.
6. Save the map file in place (refresh picks it up); tell the user to flip the diff toggle
   (map: green/yellow nodes; sequence: ghost arrows for removed steps).

## Hard rules
- Metrics stay deterministic; advisory is where interpretation lives.
- Never present the diff as "safe" — present blast radius + regressions + residual uncertainty.
  Final arbiters are tests and runs; the diagram tells WHERE to look.
