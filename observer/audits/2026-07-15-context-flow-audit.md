# Context & plugin-flow audit — 2026-07-15 (FN-1334 session)

Trigger: detective drifted off-protocol (prose explainer instead of case map; no INTAKE
question; solution menu before product intent). Symptom-level patches shipped
(bug-detective 0.2.0). This doc asks the systemic question: WHY does drift happen,
and where to cut so it stops recurring as a class.

## 1. Pseudocode — how the suite is DESIGNED to work

```
session_start:
  inject architecture_cache + open-task index        (tasks-manager)
  inject execution-memory state                      (project-executor)
  inject research-tooling state                      (researcher)
  inject routing rules                               (orchestrator bundle)

on user_prompt:
  inject routing_pulse                               (orchestrator hook)
  intent = classify(prompt)
  route:
    bug/unknown-cause        -> bug-detective.investigate
    codebase question        -> graphify query / researcher
    symbol lookup            -> serena
    run/test/repro           -> project-executor./execute
    explain (architecture)   -> architect-goggles map + viewer link
    explain (product)        -> product-designer-goggles map + viewer link
    parallel branch work     -> worktrees /wt-new

bug-detective.investigate(symptom):
  INTAKE: one batched AskUserQuestion (repro, logs, screenshots
          [+ product-intent pair — added 0.2.0])
  TRIAGE: L1 fast path OR open case file (template) + case MAP (linted) + viewer link
  loop rounds <= budget:
    cheapest discriminating test   (ask-user -> code -> logs -> executor -> e2e)
    update ledger + evidence + regenerate map
  EXIT: verdict dossier + VERDICT TOUR on the map
        [intentional-design => formulated product question, no fix menu — added 0.2.0]
  HANDOFF: fix is a separate task

post-work:
  observer /observe -> audit vs rules -> gated patches -> log
```

Assessment: the DESIGN is coherent. One controller per intent, artifacts are typed
(case file, PCE/PJM map, runbook, journal), everything observer-auditable. The failure
is not the design — it is the delivery of the design to the model at runtime.

## 2. Pseudocode — what the model ACTUALLY receives in a CL session

```
context = CLAUDE.md(global: graphify)                     # rule 1x
        + CLAUDE.md(c:/Users/borys: graphify)             # same rule 2x
        + CLAUDE.md(repo: graphify)                       # same rule 3x
        + CLAUDE.md(repo/.claude: think/simplicity/surgical)
        + MEMORY.md index (~30 entries, mixed domain+process)
        + hooks: CAVEMAN (persona, ~40 lines)
        + hooks: tasks-manager startup ritual
        + hooks: project-executor state
        + hooks: PONYTAIL (persona, ~90 lines)
        + hooks: researcher state
        + hooks: plugin-bundle routing rules (10.7KB -> persisted file)
        + hooks: context-mode protection (~80 lines)
        + hooks: SUPERPOWERS ("MUST invoke skill before ANY response")
        + ~60 skill descriptions (superpowers, firecrawl, caveman, ponytail,
          goggles, researcher, executor, worktrees, observer, dataviz, ...)

per user_prompt:
        + routing_pulse (orchestrator)
        + caveman reminder

per tool_call (PreToolUse):
        + graphify tip        (on EVERY Read/Bash/Grep — even mid-execution
                               of an already-routed investigation)
        + context-mode tip    (on Bash/Grep/Read)
        + todo reminder       (periodic)
```

Assessment — four structural problems:

**P-A. No priority order between instruction sources.** Routing pulse, superpowers
("skill check BEFORE anything"), caveman/ponytail personas, CLAUDE.md pipeline rules,
memory entries, and the invoked skill's own protocol all claim authority. When
bug-detective's protocol says "batched AskUserQuestion first" but ponytail says
"never stall on an answer you can default" and caveman compresses away pleasantries,
the model resolves the tie by vibes. This session it resolved it wrong twice.

**P-B. Same rule injected N times, competing rules injected 0 times.** graphify
routing appears 3x in CLAUDE.md + per-tool hooks (~30 injections/session), while the
rule that actually failed (case map is the deliverable, goggles-first for explains)
appeared once in a skill body that scrolled out of the attention budget. Repetition
budget is spent on the rule least likely to be violated.

**P-C. Artifact conventions lived in prose memory, not in gates.** The legacy
memory (`explainers/` path) prescribed a pre-goggles convention; nothing mechanical
prevented following it. Rules that only exist as prose lose to rules that exist as
gates (lint, template, todo-gate). Fixed for detective (0.2.0 phase gate); the
pattern generalizes: EVERY skill whose output is a typed artifact should gate on
artifact existence, not on prose compliance.

**P-D. Memory and plugins overlap without an ownership rule.** Memories written
before a plugin existed stay authoritative-looking forever. Cleaned today (3 deleted,
1 trimmed); without a standing rule the drift re-accumulates with every new plugin.

## 3. Systemic changes (ranked, cause-level)

| # | Change | Cures | Where |
|---|--------|-------|-------|
| S1 | **Authority ladder, injected once.** Add to orchestrator index-rules a 5-line precedence declaration: `user's latest message > active skill protocol > routing pulse/index-rules > CLAUDE.md > memory > personas (caveman/ponytail style only, never process)`. Personas explicitly forbidden from overriding a skill's protocol steps. | P-A | orchestrator/index-rules.md |
| S2 | **Artifact gates over prose everywhere.** Suite convention in index-rules: a skill step that produces a typed artifact is complete only when the artifact exists and passes its validator (lint/template/registry). Mirror the detective 0.2.0 phase-gate wording in researcher (research doc), goggles (linted map), executor (evidence report). | P-C | index-rules + 3 SKILL.md pointers |
| S3 | **Memory ownership rule.** In index-rules: "process/workflow memories are subordinate to plugins; when a plugin covers the topic, the memory must be deleted or reduced to project-specific residue linking the plugin." Add same line to the memory-writing instructions the user maintains. | P-D | index-rules + user memory prompt |
| S4 | **Deduplicate graphify: one source.** Keep the repo CLAUDE.md rule; delete the global + home copies; ask whether the per-Read/Bash PreToolUse tip can fire only on the FIRST such call per session (it currently spends the repetition budget). | P-B | user's CLAUDE.md files + graphify hook config (outside plugin repo — suggestion only) |
| S5 | **Persona plugins declare their lane.** caveman/ponytail SKILL descriptions get one line: "style-layer only; never alters, reorders or skips steps of an invoked skill protocol". | P-A | caveman + ponytail skill md (thedotmack cache — upstream, suggestion only) |
| S6 | **Session-start compression.** The 10.7KB bundle blurb + 5 state hooks could collapse into one orchestrator-owned block (~30 lines): plugin -> state -> route. Less startup noise = more attention left for skill bodies. | P-B | orchestrator hooks (larger refactor; propose separately) |

S1-S3 are one-commit index-rules patches (next observer round can ship them).
S4-S5 touch files outside the claude-plugins repo — user decision.
S6 is a refactor; needs its own design pass.

## 4. Verdict on adequacy

Design: adequate and unusually disciplined (typed artifacts, budgets, audit loop).
Delivery: inadequate — authority is ambient, repetition is misallocated, prose
conventions outlive their replacement tooling. The FN-1334 drift was not a model
failing to know the rules; every violated rule was in context. It was the absence
of a precedence structure and of mechanical gates at the moments of violation.
Cure the delivery, not the rules' wording.
