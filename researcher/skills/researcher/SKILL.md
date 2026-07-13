---
name: researcher
description: Deterministic research workflow for codebase/domain questions. Use whenever the user asks to investigate, look up, trace, or understand code or data — or types /research or /research-setup. Triage L1/L2/L3, route to Graphify/Serena/context-mode/web by table, ground every claim with evidence pointers, persist reusable findings to .claude-memory/research/.
---

# Researcher

You are running a disciplined research workflow. The goal is the widest complete
answer using the right tooling in the fastest way — and never inventing logic
that does not exist. Flow: **triage → route → execute → ground → (persist)**.

## Grounding rules (active for the whole research task)

1. Every factual claim about code cites `file:line`, a tool output, or a findings doc.
2. No evidence for a claim → prefix it with **"unverified:"**.
3. **"Not found" is a valid, complete answer.** Never fill gaps with plausible-sounding logic.
4. Never infer behavior from names alone. A function called `validateUser` is not proof it validates anything.
5. Separate READ (I saw this code) from ASSUMED (I expect this based on pattern) — explicitly.
6. If memory/graph contradicts current code, current code wins; mark the finding STALE?.

## Step 0 — load state + freshness auto-fix

**Freshness + dependency gate (BLOCKING). Free ops run automatically, no
approval; paid ops always ask. Missing dependencies are HARD BLOCKERS — do
NOT continue triage until each dependency below is in a usable state or the
user explicitly waives it in the same message.**

Run `node ${CLAUDE_PLUGIN_ROOT}/bin/freshness.js` (or reuse the SessionStart status block if this session already printed one) and act on each status:

- `graphify: stale` or `graphify: unbaselined` → run `graphify update .` (AST-only, no LLM, free), then baseline: `git rev-parse HEAD > graphify-out/.researcher-head`.
- `graphify: missing — copyable from <main root>` (git worktree) → copy the `graphify-out/` directory from the main repo root into this worktree, run `graphify update .`, write the baseline marker. Never point queries at the main root's graph directly — it reflects another branch.
- `serena: not onboarded` → activate the project (`mcp__plugin_serena_serena__activate_project`) and run onboarding (free).
- `graphify: missing` (no copy source) → STOP. State: "graphify graph missing; /research needs it. Options: (1) run `graphify index .` — paid, ask cost; (2) waive for this question and I proceed on serena+web only." Do NOT continue Step 1 until the user picks.
- `serena: missing` (MCP server not installed) → STOP. State: "serena MCP unavailable; /research needs it for L2/L3. Ask user to enable serena MCP OR waive and I proceed on graphify+web only."

**Memory:**

- If `.claude-memory/research/` exists: read `.claude-memory/research/config.md` (tool availability + domain notes), then run
  `node ${CLAUDE_PLUGIN_ROOT}/bin/research-index.js list` and scan for findings and wiki topic pages relevant to the question.
  Enter through the wiki page when one covers the topic (compiled current truth), then follow its links down to findings.
  **Wiki pages are navigation, not evidence** — cite the underlying finding, never the page.
  A relevant non-STALE finding may be cited as evidence; a `STALE?` finding or wiki page must be re-verified before use.
- If `.claude-memory/research/` does not exist: auto-run `/research-setup` (idempotent init: creates `.claude-memory/research/` scaffold — no API cost, <1s). Do NOT proceed without memory unless the user explicitly waives in the same message ("skip memory setup for this question"). Silent memory-less runs lose durable knowledge and cause the user to re-explain the same context every session.

## Step 1 — triage

Classify the question. State the chosen level in one line before executing
(e.g. `Triage: L2 — behavior spans auth + session modules.`).
If the question spans levels, pick the highest triggered. If genuinely ambiguous,
ask ONE clarifying question instead of guessing.

| Level | Signal | Examples |
|-------|--------|----------|
| **L1 lookup** | Single fact, one symbol/file/value | "where is X defined", "what's the default timeout" |
| **L2 investigation** | Behavior across files, one subsystem | "how does auth flow work", "what calls Y and why" |
| **L3 deep research** | Architecture-wide, external knowledge, or ambiguous scope | "how should we integrate Z", "why is the pipeline slow", library/docs questions |

## Step 2 — route

Use the primary tool first; fall to secondary only when the primary returns
empty or is marked `no` in config.md. Never silently substitute guesswork for
an unavailable tool — say which tool was unavailable.

| Level | Primary | Secondary | Output |
|-------|---------|-----------|--------|
| **L1** | Serena `find_symbol` / `find_referencing_symbols`; `graphify query` for structure questions | Grep | Inline answer + evidence pointer. Nothing persisted. |
| **L2** | `graphify query` + `graphify path`; Serena references/implementations for the code level | context-mode `ctx_batch_execute` when outputs are large | Inline answer; persist a finding if reusable across sessions. |
| **L3** | `graphify explain` + `graphify-out/wiki/`; web research (context7 for libraries, firecrawl/WebSearch otherwise); parallel Explore subagents for wide sweeps | context-mode for processing; `.claude-memory/architecture_cache.md` as read-only context | Findings doc in `.claude-memory/research/findings/` + INDEX.md line. |

**Dynamic confirmation (independent module, routed-to not owned):** to confirm a runtime /
async / broker / trigger-side-effect hypothesis that static reading cannot settle, route to the
**project-executor** plugin — run the app and observe. It is a shared module (other agents call it
for testing/developing too); researcher is one caller. Record the run as evidence with an honest
`verified_by`. A confirmed run is enough to promote an architect-goggles black box (agent-contract §2).

**Boundary broad-scan is researcher's job.** For any architecture/mapping/L2–L3 question, include a
cheap grep-grade perimeter scan — migrations/triggers, cron/schedulers, broker bindings, framework
listeners/AOP, shared tables touched by out-of-scope code — and record coverage honestly. The
architecture consumer (architect-goggles) does NOT scan; it formalizes the hints researcher emits.

Empty result handling: `graphify query` empty → say so, fall to Serena/grep.
Serena empty → grep. Grep empty → the answer is "not found". Do not invent structure.

## Step 3 — execute

Run the routed tools. Batch independent lookups. For L3, prefer fan-out
(multiple Explore subagents, each with a narrow question) over one broad sweep.

## Step 4 — verify gate (before answering)

Walk the draft answer claim by claim:

- [ ] Each claim has a pointer (`file:line` / tool output / finding)? Unverified ones prefixed "unverified:"?
- [ ] Any "not found" stated plainly rather than papered over?
- [ ] READ vs ASSUMED separation explicit where assumptions exist?
- [ ] Closing line states triage level + tools consulted, e.g. `— L2 via graphify query, serena references.`

## Step 5 — persist (L2 optional, L3 required)

1. Copy `${CLAUDE_PLUGIN_ROOT}/templates/finding.md` structure; fill every frontmatter field:
   `head:` = current `git rev-parse HEAD`; `files:` = the evidence files cited;
   `task-slug:` = the tasks-manager task journal slug when a task is in focus (drop the line otherwise) —
   the tasks-manager hub links findings to task journals through it.
2. Save as `.claude-memory/research/findings/<kebab-slug>.md`.
3. Append to `.claude-memory/research/INDEX.md`: `- [Title](findings/slug.md) — <level> — <YYYY-MM-DD>`.
4. Fill the **For goggles** section whenever the finding touched structure — as FLAT facts only:
   structural facts (with `source_ref`) + raw boundary-hints (touchpoint + `file:line` + relevance).
   NO PCE shapes — no display_ids, resolution states, or suspected_influence edges; goggles does that
   interpretation at its perimeter gate. architect-goggles and product-designer-goggles consume this
   as pre-verified evidence. This link is one-way: never read goggles maps as research evidence.
5. **Distill (Karpathy LLM-wiki layer):** findings are the immutable raw layer; `wiki/<topic>.md` is the compiled
   current truth on top. After saving a finding, check whether **3+ findings now share its topic** or a wiki page
   for the topic already exists. If so, create/update `wiki/<kebab-topic>.md` from
   `${CLAUDE_PLUGIN_ROOT}/templates/wiki-topic.md`:
   - fold the new claim into **Current claims** (replace superseded claims in place — never keep contradicting
     claims side by side; log the change in **Superseded**);
   - list every supporting finding in the `findings:` frontmatter (the index CLI propagates staleness from them);
   - bump `updated:`.
   Never edit a finding retroactively — supersede via a new finding, then update the wiki page.

Boundary: never write into `.claude-memory/` — that store belongs to the tasks-manager plugin (formerly memory-system).

## Setup workflow (/research-setup)

1. If `.claude-memory/research/` missing: create `config.md` from `${CLAUDE_PLUGIN_ROOT}/templates/config.md`
   (ask for project name + domain notes; for tool availability, prefill from the SessionStart status block),
   `INDEX.md` from `templates/research-index.md`, and an empty `findings/` dir.
2. Ask whether `.claude-memory/research/` should be committed or gitignored; record the choice in config.md
   and add a `.gitignore` entry if gitignored.
3. `graphify-out/graph.json` missing and graphify wanted: state that `graphify index .` costs API tokens
   and can take a while; run it ONLY after explicit approval. **Model pinning for indexing:** dispatch any
   indexing/extraction subagents on **haiku** by default (sonnet only if the user explicitly asks for higher
   extraction quality). Never run indexing on the session model. After indexing completes, baseline:
   `git rev-parse HEAD > graphify-out/.researcher-head`.
4. Serena not activated and wanted: offer `mcp__plugin_serena_serena__activate_project` / onboarding.
5. Finish with the same status block format the SessionStart hook prints.
