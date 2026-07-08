# ticket-resolver

A Claude Code plugin that turns one session into a human-gated bug-fix pipeline for a JIRA ticket.
Run `/resolve <TICKET-KEY>` inside the repo you want to fix; an orchestrator drives the ticket
through **analyze → (reproduce) → implement → self-review → verify → acceptance → finalize**, pausing
at a human gate between phases and only ever pushing code or opening a PR on an explicit `finalize`.

No server, no database, no UI — plain Markdown skills/agents plus a few small Node scripts, editable
by hand.

## Install

From the `alex-makoto-plugins` marketplace:

```
/plugin marketplace add alex-borysenko/alex-makoto-plugins
/plugin install ticket-resolver@alex-makoto-plugins
```

Needs the **Atlassian Remote MCP** (Jira + Bitbucket) connected for fetching tickets and opening PRs.

## Usage

| Command | What it does |
|---------|--------------|
| `/resolve <KEY>` | Run a ticket end-to-end, or **resume** it if it already exists in `.workbench/`. |
| `/resolve` | List open tickets in `.workbench/` and pick one to resume. |
| `/resolve-wrap-up` | Clean pause + handoff of the active ticket so a later session resumes it. |
| `/resolve-runbook` | Investigate how to run/test this repo + interview you → draft/refresh the RUNBOOK. |

At each gate you can type `continue`, `rerun ...`, `discuss ...`, `finalize`, or `abandon`. The
orchestrator may also **propose** reproducing the bug first.

## How it works

- **Durable state** lives in a git-ignored `.workbench/` tree in the target repo. Each ticket gets a
  dir with an `INDEX.md` (the living state) and a dedicated git worktree on `bugfix/<KEY>`. Close the
  laptop, come back tomorrow, `/resolve <KEY>` resumes from where it stopped.
- **`.workbench/RUNBOOK.md`** is a living, agent-maintained runbook of how to run and test this repo
  locally (and which temporary scaffolds are allowed). It accretes across tickets so the agent stops
  re-experimenting. If it's empty, the orchestrator offers to investigate + interview you first.
- **Six subagents** do bounded work — analyze, validate, reproduce, implement (test-first), review,
  verify. Only the orchestrator commits, pushes, opens PRs, or transitions Jira.
- **Acceptance criteria** are extracted from the ticket and checked at the end (not just "tests
  pass"). An over-large fix can be **split** into ordered sub-steps; a consciously deferred gap is
  recorded as **typed debt** in the PR body; dead-end attempts are remembered so loops don't repeat
  them. Per-role models are configurable in `models.json`.

## Safety model

- **Per-agent tool allowlists** keep each subagent in its lane.
- **`hard-ban.js` PreToolUse hook** denies `git push`/`commit`/history rewrites, runaway dev servers,
  and destructive deletes. The orchestrator lifts a ban for its own action with a short-lived marker
  file under `.workbench/` (`.allow-commit`, `.allow-push`, `.run-allow`) and removes it immediately —
  so subagents can never commit, push, or start un-allowlisted services.
- **Temporary test scaffolds** (stub a service, disable a heavy module) go in separate `scaffold:`
  commits and are **dropped before finalize**; finalize asserts none reach the PR.

## Recommended companion plugins

Soft-recommended (a SessionStart check warns if missing; edit `recommended-plugins.json` to change
the list): **caveman** (output compression), **graphify** (repo knowledge graph for grounded
analysis), **superpowers** (TDD / debugging / verification skills).

## Layout

```
commands/        resolve.md, resolve-wrap-up.md, resolve-runbook.md
skills/          resolve-ticket/SKILL.md   (orchestrator)
agents/          ticket-analyzer, analysis-validator, repro-runner,
                 fix-implementer, self-reviewer, change-verifier
hooks/           hooks.json, hard-ban.js, check-recommended-plugins.js
bin/             setup-workbench.js, workbench-index.js
templates/       runbook.md
rules/           agent-rules.md, pr-template.md
models.json      role → model override map (retune cost/quality, no code change)
docs/            design.md   (full spec)
tests/           hard-ban.test.js, setup-workbench.test.js
```

See [docs/design.md](docs/design.md) for the full design spec.

## Tests

```
node tests/hard-ban.test.js
node tests/setup-workbench.test.js
```
