# Pull-request body template (filled by the orchestrator at FINALIZE)

Use this structure for the PR description. Keep it factual and short; link the ticket.

```markdown
## <TICKET-KEY> — <ticket title>

Fixes <TICKET-KEY>. <one-line summary of the fix.>

### Root cause
<the cited cause, with `path:line`.>

### Change
<what changed and why this boundary — minimal-fix rationale. Note the regression test added.>

### Acceptance criteria
- [x] <criterion 1> — verified by <test / repro / check>
- [x] <criterion 2> — …
<!-- Every criterion from the ticket. Unmet ones appear under Debt below, not as a silent gap. -->

### Verification
- Suite: <pass/fail counts>; own-caused failures: none (baseline-diffed).
- Acceptance: reproduction <recipe> now passes (was failing pre-fix).

### Debt (if any)
<!-- Omit this whole section when the fix is complete. -->
- **<severity>** — <deferred criterion>: <justification>. Follow-up: <TICKET or "none">.

### Notes
- Branch `bugfix/<KEY>` off `<base>@<base_sha>`. Temporary test scaffolds were dropped before this PR.
```

Rules:
- Never describe a deferred criterion as done. If a criterion is unmet, it goes under **Debt** with a
  severity and justification — mirroring the INDEX `## Debt` section.
- Do not include scaffold changes; the push diff must be the fix + tests only.
