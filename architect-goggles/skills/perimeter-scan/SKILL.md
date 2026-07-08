---
name: perimeter-scan
description: Deep-dive investigation of PCE black boxes (suspected nodes) after the human routes them - confirm, dismiss, or refine hidden influences like DB triggers, scheduled jobs, broker behavior services. Use ONLY when the human explicitly picks boxes to investigate at the perimeter gate, or asks to "check the perimeter" / "investigate BBx".
---

# perimeter-scan

Resolves `suspected` nodes on an existing map. Obey `spec/agent-contract.md` §2, §4.

## Procedure

1. Take the explicit list of box display_ids the human routed for investigation.
   NEVER auto-expand to other boxes; expensive scans (git change-coupling mining) also
   only run here or on explicit request.
2. Per box, investigate the concrete evidence trail: read the migration/config/annotation,
   trace what it actually does, find where it touches the in-focus subsystem.
3. Resolve:
   - **confirm** → set proper `kind`, `resolution: confirmed`, fill `summary` + `source_refs`,
     convert `suspected_influence` edges to real kinds, and CHECK EXISTING FLOWS —
     inject new arrows/steps where the confirmed mechanism participates (e.g. "between
     steps 5 and 6 a trigger fires").
   - **dismiss** → keep the node, `resolution: dismissed`, dismissal reason in `evidence`.
4. For human "confirm-from-experience" answers: apply as confirmed with the human's description
   in `summary`, and OFFER to append the fact to the environment manifest so it becomes a
   permanent generation input.
5. Update `scan_coverage`, re-register the map.
