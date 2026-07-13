---
name: flow-trace
description: Generate behavioral flows (call/return/async arrow sequences) for a PCE map — happy paths, bug reproductions, edge cases. Use after arch-map when the task needs to show HOW a process runs, reproduce a bug, or explain a request lifecycle step by step.
---

# flow-trace

Adds `flows[]` to an existing map document. Obey `spec/agent-contract.md` §5.

If the document has `meta.preset` (or the human asks for flows "in simple words" — contract §11),
load `presets/<preset>.md` and follow it: trace flows on the CANONICAL map first, then project
coarse arrows (one per collapsed-group interaction, plain verb labels) into the preset map.
Stack balance applies to the projection too.

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
     Write `explanation`, `flow.title`, `flow.description` and `arrow.label` prose in the
     human's session language (contract §10); keep `arrow.type`, `edge` ids and code symbols canonical.
4. Map each arrow to its structural `edge` id — this is what synchronizes MAP and SEQUENCE.
5. Update `nodes[].metrics.flows_count`.
6. Save the map file in place; the viewer reads it live, so a browser refresh picks up the new version.

## Sanity checks before finishing
- Stack simulation over each flow balances (unbalanced = you didn't actually trace it).
- Every participant in `participants` appears in at least one arrow.
- Bug flows reference the concrete failing conditions in explanations, with code_refs.
