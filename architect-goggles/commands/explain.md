---
description: Build an interactive PCE architecture map for a task (explain / debug / extend) and open it in the local viewer
argument-hint: "<intent: explain|debug|extend> <task description>"
---

Run the Architect Goggles workflow for: $ARGUMENTS

1. Use the **arch-map** skill: frame intent/scope, read the environment manifest, delegate
   discovery to the researcher plugin (structural facts + boundary-hints — architect does not
   grep), formalize its finding into the PCE map, assign display_ids, register the map and give
   me the viewer link. STOP at the perimeter gate and present the black-box list for my routing.
2. After my routing: use **perimeter-scan** for boxes I marked to investigate.
3. Use **flow-trace** to produce the flows relevant to the intent (happy path for explain;
   reproduction + contrast for debug; affected flows for extend).
4. If the task proposes changes: use **impact-diff** — structural diff, flow diffs, blast radius,
   flow-regression and hotspot advisory. Do NOT write code before I review the diff on the diagram.

Throughout: honor spec/agent-contract.md. Use display_ids (N2, E3, BB1) when we discuss elements.
If my task asks for "simple words" / high level / big picture in any form, apply the altitude
preset per contract §11 (presets/overview.md): canonical map first, overview projection second,
and give me BOTH viewer links.
