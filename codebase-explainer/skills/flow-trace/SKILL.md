---
name: flow-trace
description: Generate behavioral flows (call/return/async arrow sequences) for a PCE map — happy paths, bug reproductions, edge cases. Use after arch-map when the task needs to show HOW a process runs, reproduce a bug, or explain a request lifecycle step by step.
---

# flow-trace

Adds `flows[]` to an existing map document. Obey `spec/agent-contract.md` §5.

## Procedure

1. Identify the flows that matter for `meta.intent`:
   explain → canonical happy paths; debug → reproduction path + adjacent happy path for contrast;
   extend → flows through the region being extended.
2. **Trace, don't imagine**: derive the arrow sequence from the call chain in the index.
   For debug, prefer an actual local run/trace when the environment allows; set `verified_by`
   honestly (`static_analysis` / `local_run` / `static_and_run` / `hypothesis`).
3. Build steps of atomic `arrows` {from,to,type: call|return|async,label,edge,err?}:
   - every sync call eventually returns (err:true for exceptions) — the stack must balance;
   - async arrows get no return;
   - mid-process flows start with `preface` context arrows;
   - each step: `explanation` (what + why it matters) + `code_ref` where possible.
4. Map each arrow to its structural `edge` id — this is what synchronizes MAP and SEQUENCE.
5. Update `nodes[].metrics.flows_count`.
6. Re-register the map (`node viewer/register-map.mjs`) so the viewer picks up the new version.

## Sanity checks before finishing
- Stack simulation over each flow balances (unbalanced = you didn't actually trace it).
- Every participant in `participants` appears in at least one arrow.
- Bug flows reference the concrete failing conditions in explanations, with code_refs.
