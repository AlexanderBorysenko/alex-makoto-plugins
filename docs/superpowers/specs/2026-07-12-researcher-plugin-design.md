# Researcher Plugin — Design

Date: 2026-07-12
Status: approved approach — B (skills + hooks package)

## Purpose

Claude Code plugin that makes research/investigation sessions deterministic and grounded:

1. **Complexity triage** — classify every research question into L1/L2/L3 before touching tools.
2. **Tool routing** — deterministic mapping from triage level + question type to the right tool (Graphify, Serena MCP, context-mode, web research) instead of ad-hoc grep/read sprawl.
3. **Anti-hallucination grounding** — every factual claim carries an evidence pointer; "not found" and "unverified" are first-class answers; no logic inferred from names alone.
4. **Research memory** — persistent, citable findings store separate from memory-system-plugin's task journals.
5. **Goggles collaboration** — findings formatted so architect-goggles / product-designer-goggles can consume them as evidence for PCE maps.

Generic core + per-project config. First configured project: **Karpaty Wiki LLM**.

## Non-goals

- Not a replacement for memory-system-plugin (task journals, architecture narrative stay there).
- Not a wrapper that re-implements Graphify/Serena/context-mode — orchestrates them.
- No hard hook enforcement that parses/blocks answers (brittle). Verify gate is a checklist, not a censor.
- No silent expensive operations (graphify indexing costs API tokens — always ask first).

## Plugin layout

```
researcher/
  .claude-plugin/plugin.json
  skills/
    research/SKILL.md          # /research <question> — triage → route → grounded answer
    research-setup/SKILL.md    # /research-setup — bootstrap tooling + research store
  hooks/
    hooks.json                 # SessionStart registration
    session-start.ps1          # detection script (Windows primary)
    session-start.sh           # POSIX twin
  templates/
    research-index.md          # INDEX.md template
    finding.md                 # findings doc template (goggles-consumable format)
    config.md                  # per-project config template
  README.md
```

Per-project state (created by /research-setup, gitignored or committed per user choice):

```
.claude-research/
  config.md                    # tool availability, domain notes, project name
  INDEX.md                     # one line per finding: - [title](findings/slug.md) — hook — date
  findings/<slug>.md           # findings docs with evidence pointers
```

## Components

### 1. SessionStart hook (deterministic script, no model logic)

Checks, in order, and emits ONE compact context block:

- `graphify-out/graph.json` exists? → "graphify: ready" / "graphify: missing"
- Serena project config (`.serena/project.yml`) exists? → ready/missing
- `.claude-research/` exists? → load INDEX.md line count + config project name
- Missing pieces → single line: "researcher: X missing — run /research-setup to enable". Offered once; no nagging, no auto-setup.

Output budget: ≤ 10 lines injected. Router rules are NOT injected here (context tax) — they live in the skill.

### 2. /research skill

Flow: **triage → route → execute → ground → (persist)**

**Triage table (deterministic):**

| Level | Signal | Examples |
|-------|--------|----------|
| L1 lookup | Single fact, one symbol/file/value | "where is X defined", "what's the default timeout" |
| L2 investigation | Behavior across files, one subsystem | "how does auth flow work", "what calls Y and why" |
| L3 deep research | Architecture-wide, external knowledge, or ambiguous scope | "how should we integrate Z", "why is the pipeline slow", library/docs questions |

If question spans levels → pick the highest one triggered. State chosen level in one line before executing.

**Routing table:**

| Level | Primary | Secondary | Output |
|-------|---------|-----------|--------|
| L1 | Serena `find_symbol`/`find_referencing_symbols`; `graphify query` for structure | Grep fallback | Inline answer + evidence pointer. No file persisted. |
| L2 | `graphify query` + `graphify path`; Serena references/implementations | context-mode `ctx_batch_execute` for large outputs | Inline answer; short finding persisted if reusable. |
| L3 | `graphify explain` + wiki; web research (context7 for libraries, firecrawl/WebSearch for the rest); subagent fan-out (Explore/general-purpose) for parallel sweeps | context-mode for processing; memory-system architecture cache as context | Findings doc in `.claude-research/findings/` + INDEX.md line. |

Routing respects `.claude-research/config.md` — if a tool is marked unavailable for the project, skip to next.

**Grounding rules (verbatim in skill body, active only during /research):**

1. Every factual claim about code cites `file:line`, a tool output, or a findings doc.
2. No evidence → prefix claim with "unverified:".
3. "Not found" is a valid, complete answer. Never fill gaps with plausible-sounding logic.
4. Never infer behavior from names alone (function called `validateUser` ≠ proof it validates).
5. Explicitly separate READ (I saw this code) from ASSUMED (I expect this based on pattern).
6. Contradiction between memory/graph and current code → current code wins; mark memory stale.

**Verify gate (end of skill, checklist not parser):**

Before final answer: walk each claim — has pointer? mark unverified ones; state triage level used and tools consulted in one closing line.

### 3. /research-setup skill

1. Read/create `.claude-research/config.md` (project name, available tools, domain notes).
2. graphify-out missing → offer `graphify index .` (state token cost, get approval).
3. Serena not activated → offer activation/onboarding.
4. Create `INDEX.md` + `findings/` from templates.
5. For Karpaty Wiki LLM: seed config with domain notes user provides.

### 4. Research memory

- **Findings doc format** (template): title, date, triage level, question, answer summary, **Evidence** section (list of `file:line` / tool-output citations), **For goggles** section (candidate nodes, edges, black-box suspects), staleness marker (git HEAD at write time).
- **Staleness**: on load, script compares finding's recorded HEAD vs current; files-touched overlap → prepend "STALE?" to the INDEX line. Cheap heuristic, no parsing.
- **Boundary vs memory-system**: `.claude-memory/` = what we're doing (tasks, narrative); `.claude-research/` = what we verified true (facts + citations). No writes across the boundary.

### 5. Goggles integration (one-way)

- Findings' "For goggles" section uses PCE vocabulary: nodes (name, file, kind), edges (from→to, kind), suspected black boxes.
- arch-map / perimeter-scan / product-impact can cite findings docs as pre-verified evidence instead of re-reading source.
- No reverse dependency: researcher never reads goggles maps (v0.1; revisit later).

## Error handling

- Tool unavailable mid-research (MCP down) → note it, fall to next route, never silently substitute guesswork.
- graphify query returns empty → say so; fall to Serena/grep; do not invent structure.
- Ambiguous question at triage → ask one clarifying question rather than guessing level.

## Testing / acceptance

- Fixture project (can reuse an existing plugin dir): run /research at each level, verify: triage stated, correct primary tool used, every claim has pointer, L3 produces findings doc + INDEX line.
- SessionStart script: run with/without graphify-out, .serena, .claude-research — assert ≤10-line output and correct missing-piece offer.
- Negative test: question about non-existent function → answer must be "not found", not invented behavior.

## v0.1 scope cut (YAGNI)

- No custom subagent types; use built-in Explore/general-purpose.
- No auto-indexing, no cron, no workflows.
- Staleness = git-HEAD heuristic only.
- Goggles link = document format only, no code coupling.
