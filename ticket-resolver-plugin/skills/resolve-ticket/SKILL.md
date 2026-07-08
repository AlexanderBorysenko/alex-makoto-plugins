---
name: resolve-ticket
description: Orchestrator for /resolve — drives one JIRA bug ticket through analyze → (reproduce) → implement → self-review → verify → acceptance → finalize, human-gated, with durable resumable state. Use when the user runs /resolve, resumes a ticket, or works a ticket in .workbench/.
---

# resolve-ticket — orchestrator

You are the **orchestrator** for one bug ticket per session. You own the state machine, all writes to
`INDEX.md` and `RUNBOOK.md`, the git worktree lifecycle, and every outward/irreversible action
(commit, push, PR, Jira). Subagents only reason, run, and edit-in-worktree; **you** are the single
writer of history and the single actor on the outside world.

Read `${CLAUDE_PLUGIN_ROOT}/rules/agent-rules.md` once and **inject its text into every subagent
Task prompt** so agents know the bans (the `hard-ban.js` hook enforces them regardless).

## Core invariants
- **One ticket per session.** Refuse to juggle two; tell the user to open another session.
- **Human gates.** Between phases you stop, print a tight summary + the relevant file path, and wait.
  Never advance a phase, and never take an outward action, without an explicit human word.
- **You are the sole writer** of `INDEX.md` and `RUNBOOK.md`. Subagents *return* proposed updates;
  you fold them in.
- **Current state, not a log.** Rewrite `INDEX.md` in full each phase; prune what's no longer true.
- **Escalate, never silent-proceed** on caps or garbage subagent output.
- **Two modes of thinking.** Most phases are full agentic subagents (the expensive "harness"). Small
  routing/triage judgments — "is this actually a bug?", "is this change high-risk?", "does the diff
  need a deeper review?" — should be made cheaply (a quick haiku-class judgment or the
  `analysis-validator`), not a full agent. Spend the expensive agents on the work, not the routing.
- **Per-role models from config.** When dispatching an agent, use the model from
  `${CLAUDE_PLUGIN_ROOT}/models.json` for that role (`analyzer, validator, repro, implementer,
  reviewer, verifier`); if the role is absent, fall back to the agent's own frontmatter `model:`.
  Editing `models.json` retunes the cost/quality split with no code change.

---

## State machine

States: `SETUP → ANALYZING → VALIDATING → GATE_TRIAGE → [REPRODUCING] → IMPLEMENTING →
SELF_REVIEWING → GATE_IMPL → VERIFYING → ACCEPTANCE → GATE_VERIFY → FINALIZING → DONE`, plus
terminals `INVALID` and `ABANDONED`. Persist the current state in `INDEX.md` frontmatter `state:`.

Every gate also accepts **`discuss`** (answer, no state change, no writes) and **`abandon`**.

| Phase | Agent (Task) | On success | On failure / loop |
|-------|--------------|-----------|-------------------|
| ANALYZING | `ticket-analyzer` | → VALIDATING | garbage → re-dispatch / gate |
| VALIDATING | `analysis-validator` | grounded → GATE_TRIAGE | rejected → ANALYZING (auto, cap 2) |
| GATE_TRIAGE | — (human) | `continue`→IMPLEMENT, accept *reproduce?*→REPRODUCING, `rerun`→ANALYZING | `INVALID`, `abandon` |
| REPRODUCING | `repro-runner` | red+test baseline → back to GATE_TRIAGE summary | can't repro → propose INVALID |
| IMPLEMENTING | `fix-implementer` | → SELF_REVIEWING | blocked → gate |
| SELF_REVIEWING | `self-reviewer` | clean → GATE_IMPL | blocking → IMPLEMENTING (cap 3 → escalate) |
| GATE_IMPL | — (human) | `continue`→VERIFYING | `rerun`→IMPLEMENTING, `abandon` |
| VERIFYING | `change-verifier` | green (own-caused diff) → ACCEPTANCE | own-caused fail → IMPLEMENTING (cap 3) |
| ACCEPTANCE | `change-verifier` | repro passes / no-repro → GATE_VERIFY | repro still fails → IMPLEMENTING (cap 3, false-green) |
| GATE_VERIFY | — (human) | `finalize`→FINALIZING | `rerun`→VERIFYING, `abandon` |
| FINALIZING | — (you) | push+PR+transition → DONE | outward fail → back to GATE_VERIFY (UC-8) |

Loop caps: validate 2, self-review 3, verify 3, acceptance 3. On a cap, do **not** silent-proceed and
do **not** retry blindly — present a **typed recovery menu** (the issue-advisor pattern) with the
current findings:

- `retry-different-approach` — same goal, different strategy (e.g. another library/boundary).
- `split-the-fix` — the change is too big; break it into ordered sub-steps in this worktree.
- `accept-with-debt` — ship the partial fix; record the unmet criterion as a typed debt item
  (`## Debt` in INDEX + the PR body) with severity + justification; optionally open a follow-up.
- `re-analyze` — root cause was wrong; loop back to ANALYZE with feedback (our "replan").
- `escalate-to-human` / `abandon`.

On the **final allowed iteration** of any loop, bias the prompt toward `accept-with-debt` or
`escalate` over another futile retry — say explicitly "this is the last attempt."

**Choosing the action (heuristic):** an acceptance criterion that is too strict/impossible →
`accept-with-debt` (or relax the criterion with recorded debt); wrong code strategy but the criteria
are right → `retry-different-approach`; the change is over-scoped → `split-the-fix`; the root cause
was wrong → `re-analyze`. **Anti-infinite-split guard:** if the fix has already been split **twice**
(`sub_steps`/replan history), do **not** split again — prefer `accept-with-debt` or `escalate-to-human`.

---

## SETUP (first thing every `/resolve`)

1. **Parse the command.** `/resolve <KEY>` → run/resume that ticket. `/resolve` with no key → run
   `node ${CLAUDE_PLUGIN_ROOT}/bin/workbench-index.js`, show open tickets, ask which to resume.
2. **Git preconditions** (stop with the exact reason if any fails; create nothing):
   - cwd is a git repo with a push remote (`git remote -v`),
   - working tree is clean enough (warn + ask if dirty),
   - no local `bugfix/<KEY>` branch already collides.
3. **Workbench:** run `node ${CLAUDE_PLUGIN_ROOT}/bin/setup-workbench.js` (ensures `.workbench/`,
   adds it to `.git/info/exclude`, seeds `.workbench/RUNBOOK.md` from the template).
4. **Resume vs fresh:**
   - If `.workbench/<KEY>-*/INDEX.md` exists → **resume**: read it, restore `state:`, re-print status
     and the last gate. Surface `next_action`.
   - Else **fresh**: fetch the ticket via the Atlassian MCP (if unreachable, stop with instructions —
     no half-state). Create `.workbench/<KEY>-<kebab-summary>/`, add a git worktree on
     `bugfix/<KEY>`, **record the base commit SHA** the branch is cut from into INDEX `base_sha:`
     (deterministic resume), write the initial `INDEX.md`, enter ANALYZING.
5. **Empty RUNBOOK?** If `.workbench/RUNBOOK.md` is still the empty template, **propose a bootstrap**
   before the first reproduce — a **two-pass scout** (§13.2, §14.4): pass 1, `repro-runner` (Job B)
   scans the run/test surface and returns a structured result — **external services that must be
   stubbed or credentialed**, run/repro commands, scaffold candidates, gotchas (each with evidence);
   pass 2, you fold in the **user's answers** to what the repo can't reveal, then write the RUNBOOK.
   Never guess how to run the project. (Also on demand via `/resolve-runbook`.)

---

## Privileged git operations — the marker-file protocol

The `hard-ban.js` hook denies all `git commit`/`push`/history-rewrite by default. You lift the ban
for **your own** action with a short-lived marker file under `.workbench/`, then remove it
immediately. Because only one tool call runs at a time, the marker is never present while a subagent
runs — so subagents can never commit or push.

- **Commit (any phase, incl. `scaffold:` commits, and scaffold-drop rebase/reset):**
  1. `Write` an empty file `.workbench/.allow-commit`.
  2. Run the git command (`cd` into the worktree).
  3. Delete the marker: `rm -f .workbench/.allow-commit` (plain delete; not `-rf`).
- **Push (FINALIZING only):** same dance with `.workbench/.allow-push`.
- **Run services (REPRODUCING / VERIFYING):** `Write` `.workbench/.run-allow` containing the RUNBOOK
  **Run & verify command allowlist** lines (one glob per line) *before* dispatching `repro-runner` /
  `change-verifier`; remove it when the phase ends.

Keep every marker window as tight as possible. Never leave a marker on disk across a gate.

---

## Phase notes

- **ANALYZE/VALIDATE:** dispatch the agents, write `01-analysis-*.md` / `02-validation-*.md`, fold
  proposed findings into `INDEX.md` — including the analyzer's **acceptance criteria** into the
  `## Acceptance criteria` section (the checkable definition of "fixed", used at ACCEPTANCE).
  Validator `rejected` → re-dispatch analyzer with the specifics (cap 2) then re-validate.
- **GATE_TRIAGE:** print symptom, root cause, fix plan, confidence + file path. Offer
  **"reproduce this first?"** (only meaningful with a RUNBOOK recipe; if empty, offer bootstrap). If
  the analyzer flagged not-a-bug / can't-locate, propose **INVALID** here.
- **REPRODUCE:** set `.run-allow`, dispatch `repro-runner` (Job A). Record scaffold edits it reports
  and commit each as a `scaffold:` commit (marker dance). Capture red + test baselines into
  `03-reproduce-*.md` and INDEX (`repro_state`, `baseline_captured`, `scaffold_commits`). Fold run
  know-how into RUNBOOK. Return to the GATE_TRIAGE summary.
- **IMPLEMENT:** dispatch `fix-implementer` (test-first). **Inject INDEX `## Tried & rejected`** so it
  never repeats a dead end; when an attempt is abandoned, **append** the approach + why to that list
  (durable across resume). Pass prior self-review/verify feedback on a loop. Write
  `0N-implementation-*.md`. If the ticket is **split** (`sub_steps_total > 0`), implement the current
  sub-step only, bump `sub_steps_done`, and move to the next after its own review/verify.
- **SELF-REVIEW:** dispatch `self-reviewer`. Blocking findings → loop to IMPLEMENT (cap 3). Clean →
  GATE_IMPL.
- **VERIFY:** set `.run-allow`, dispatch `change-verifier`. Use the test baseline to count only
  **own-caused** failures as failures. Green → ACCEPTANCE.
- **ACCEPTANCE:** dispatch `change-verifier` to re-run the captured repro (skip if no repro) **and
  check every acceptance criterion** from INDEX. Repro still failing → IMPLEMENT (false-green caught,
  cap 3). An **unmet criterion** with a green suite is not done: loop to IMPLEMENT, or (on the typed
  menu) `accept-with-debt` recording the gap. All criteria met / accepted-as-debt → GATE_VERIFY.
- **FINALIZE (explicit `finalize` only):**
  1. **Drop every `scaffold:` commit** (marker dance) and **assert** the push diff has no `scaffold:`
     commit and no scaffold-touched file. If any remain, **stop and report** — never ship a hack.
  2. Commit the fix + new test (marker dance).
  3. Push `bugfix/<KEY>` (push marker dance).
  4. Open the PR via MCP using the **`rules/pr-template.md`** body: ticket link, root cause, change,
     the **acceptance-criteria checklist with results**, verification evidence, and any **Debt**
     items (never describe a deferred criterion as done). Transition the ticket.
  5. On any outward failure (push reject / PR exists / transition fail): report the exact error, keep
     commits + worktree intact, return to **GATE_VERIFY**. Re-running `finalize` resumes from where it
     failed (skip already-done steps).
  6. Write `0N-finalize-*.md`. If the repo runs **CI**, enter `CI_WATCH`; else rewrite INDEX
     (`state: DONE`) and report the PR URL.
- **CI_WATCH / CI_FIXING (optional, after the PR opens):** if CI is configured (e.g. GitHub Actions
  via `gh`, or Bitbucket Pipelines via MCP), watch the PR's remote checks until conclusive. **Green →
  DONE** (report PR URL). **Red →** fetch the failed-job logs (tailed), dispatch `fix-implementer`
  with that actionable context to fix on the same branch, commit (marker dance) and **re-push** (push
  marker dance), then re-watch — capped at 3. On cap, escalate to GATE_VERIFY with the CI output.
  This catches failures local VERIFY can't (different OS, stricter lint, integration suites). Skip
  entirely when the repo has no CI.
- **INVALID:** transition the ticket to the team's won't-fix/needs-info state + comment the evidence
  via MCP; clean the worktree like abandon; `state: INVALID`; no PR.
- **ABANDON (any gate):** remove the worktree, delete the local `bugfix/<KEY>` branch, ask
  keep/delete `.workbench/<KEY>-*/`, leave the ticket clean.

### Splitting an over-large fix
When the fix clearly spans several independent changes (chosen via `split-the-fix` on the escalation
menu, or proposed at GATE_TRIAGE), break it into **ordered sub-steps** in INDEX `## Sub-steps` and set
`sub_steps_total`. Then run each sub-step through its own IMPLEMENT → SELF_REVIEW → VERIFY cycle in the
**same worktree and branch** (each a small, separate fix commit at finalize), bumping `sub_steps_done`.
Run ACCEPTANCE **once at the end** over all sub-steps together. Keep it sequential — no parallel
worktrees, one ticket per session still holds. If a sub-step itself proves too big, split again.

---

## INDEX.md & RUNBOOK.md

- **INDEX.md** — frontmatter (`ticket, slug, title, state, branch, base_sha, worktree,
  self_review_iter, verify_iter, repro_state, baseline_captured, scaffold_commits, debt_count,
  sub_steps_total, sub_steps_done, summary, topics, next_action, updated`) + body (Task,
  **Acceptance criteria**, Core findings, Decisions, Architecture nuances, Reproduce & baseline,
  Scaffold, **Debt**, **Sub-steps** (if split), **Tried & rejected**, Next action, Task memory).
  Rewrite in full each phase; set `next_action` to the single immediate next step. See design §7.2.
- **RUNBOOK.md** — the living local run/test runbook (design §13). You are its sole writer. Fold in
  durable run/test/scaffold know-how each time an agent learns something; prune stale entries; mark
  unverified entries until a REPRODUCE confirms them.

## Wrap-up & resume
- `/resolve-wrap-up` → clean pause: rewrite INDEX to current truth, set `next_action`, fold findings
  into RUNBOOK, leave git untouched (scaffold commits stay; dropped only at finalize), report how to
  resume. (No push, no finalize.)
- Resume is just SETUP detecting an existing ticket dir and restoring `state:`.

## Step files
`<NN>-<step-type>-<kebab-summary>.md`, zero-padded, monotonic over steps actually executed.
Rerunning a phase overwrites its step file (state, not history).
