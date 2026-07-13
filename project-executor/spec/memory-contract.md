# Memory Contract

All execution memory lives in the TARGET PROJECT at `.claude-memory/executions/`.

The memory is an **LLM Wiki** (Karpathy pattern): a small wiki of markdown pages
that the executor maintains, compiled incrementally from raw run evidence. Three
layers:

- **Raw sources** — `journal/` and `reports/`. Immutable, append-only. Never edited
  after the fact; they are the ground truth the wiki is derived from.
- **Wiki** — `index.md` + canonical pages + optional concept pages. The executor
  writes and maintains this layer entirely; humans read it (and may correct it via
  /exec-mem `edit`). Knowledge is compiled once at distillation and kept current,
  not re-derived from raw sources on every run.
- **Schema** — `schema.md`, the bookkeeping program: page conventions, when to
  create/merge/supersede, project-specific rules. Seeded from this contract;
  co-evolves with the project (see Schema evolution).

## Layout

    .claude-memory/executions/
    ├── index.md        # wiki entry point: one line per page — name, purpose, freshness
    ├── schema.md       # bookkeeping rules for THIS project (seeded from this contract)
    ├── env.md          # services, ports, prereqs, OS quirks, required env vars
    ├── runbook.md      # verified commands (start/stop/build/test/seed)
    ├── data.md         # seeds, mock data patterns, test users + LOCAL-ONLY credentials
    ├── browser.md      # base URLs, auth flow, stable selectors, saved playwright routines
    ├── gotchas.md      # failure → resolution pairs; proven instrumentation points
    ├── wiki/           # optional concept pages the executor creates as needed
    ├── journal/        # raw dated observations (append-only), one file per day: YYYY-MM-DD.md
    └── reports/<YYYY-MM-DD-slug>/   # see report-contract.md

The five canonical pages (env, runbook, data, browser, gotchas) always exist and
never move — flows and subagents reference them by fixed path.

## Wiki conventions

- Cross-reference pages with wikilinks: `[[runbook]]`, `[[env]]`,
  `[[wiki/auth-flow]]`. A link to a page that does not exist yet is allowed — it
  marks knowledge worth compiling, not an error.
- **Concept pages** (`wiki/<kebab-slug>.md`): create one only when knowledge is
  cross-cutting and does not fit a canonical page (e.g. an auth flow spanning env
  + browser + gotchas, a multi-service startup ordering). One concept per page,
  linked from the canonical pages that touch it and listed in `index.md`. Prefer
  updating an existing page over creating a new one — no duplicates, no clutter.
- **index.md** is the cold-start entry point. One line per page:
  `- [[runbook]] — verified commands (7 entries, oldest verified 2026-07-01)`.
  Regenerated at every distillation; must never go stale relative to the pages.

## Init (idempotent — run whenever a canonical file is missing)

1. Create missing directories/files from the templates below (including `index.md`
   and `schema.md`; `wiki/` is created lazily on first concept page).
2. Gitignore guard: ensure the target repo ignores the memory dir. If `.gitignore`
   does not exist, CREATE it containing `.claude-memory/`. If it exists and lacks
   the line, append it. If the repo would still commit `data.md` (check
   `git check-ignore .claude-memory/executions/data.md`), WARN the user before
   writing any credentials.

## Page templates

Every page starts with an HTML comment stating its purpose, then entries.

`runbook.md` entries (one `##` per action):

    ## start:api
    verified: 2026-07-11
    command: `npm run dev` (cwd: apps/api)
    readiness: GET http://localhost:3000/health → 200 within 30s
    stop: Ctrl+C / kill by port 3000
    notes: needs `DATABASE_URL` from [[env]]

`env.md`: one `##` per service/prereq with ports, versions, env vars.
`data.md`: one `##` per dataset/user. Credentials marked `local-only: true`.
`browser.md`: `## routine:<name>` blocks — goal, start URL, auth steps, selectors, expected outcome.
`gotchas.md`: `## <symptom>` blocks — symptom, cause, resolution, `verified:` date.
  Instrumentation points: `## trace-point:<topic>` — file:line, what to log, why useful.
`wiki/<slug>.md`: freeform, but starts with one-sentence purpose and ends with a
  `links:` line of related `[[pages]]`.

## Init seed templates

`index.md` (regenerated at every distillation — never hand-edited):

    <!-- Wiki entry point. Regenerated at distillation; do not edit by hand. -->
    - [[runbook]] — verified commands (0 entries)
    - [[env]] — services, ports, prereqs (0 entries)
    - [[data]] — datasets, test users (0 entries)
    - [[browser]] — routines, selectors (0 entries)
    - [[gotchas]] — failure → resolution pairs (0 entries)

Entry-line shape once pages fill: `- [[runbook]] — verified commands (7 entries, oldest verified 2026-07-01)`.
Concept pages append below the canonical five as `- [[wiki/<slug>]] — <one-line purpose>`.

`schema.md`:

    <!-- Bookkeeping rules for this project's execution wiki. Seeded from
         project-executor spec/memory-contract.md. Refine at distillation with a
         journaled rationale. Layout + the five canonical pages never change. -->

    ## Conventions (contract defaults)
    - Update existing entries before creating anything new; no duplicates.
    - Concept pages only for cross-cutting knowledge: wiki/<kebab-slug>.md,
      linked from the pages that touch it, listed in index.md.
    - Supersede, never silently delete: replace in place, journal the
      supersession, add a gotcha if the old form is a trap.
    - verified: older than 14 days = stale; re-verify before relying on it.
    - Pages stay short; one-off observations stay in the journal.
    - Regenerate index.md at every distillation.

    ## Project-specific rules
    (none yet)

## Journal

During any run, append discoveries immediately to `journal/YYYY-MM-DD.md`:

    ### HH:MM <flow> <runid>
    <observation — freeform, raw allowed>

## Read discipline

- Cold start: read `index.md` first, then only the pages the flow needs (never the
  journal, never old reports).
- Journal is write-hot / read-cold: it is only read during distillation.

## Staleness

`verified:` older than 14 days ⇒ entry is STALE. Before relying on a stale entry,
re-verify it cheaply (run it, check readiness). Success ⇒ update the stamp.
Failure ⇒ supersede the entry via discovery (see Supersession).

## Supersession

When new evidence contradicts a wiki entry, the old claim must not silently
coexist with or silently vanish under the new one:

1. Replace the entry in place with the corrected form and a fresh `verified:` stamp.
2. Record the supersession in today's journal: `superseded: <page>#<entry> — <old form> → <new form> (<runid>)`.
3. If the old form is a trap others could fall into (a command that used to work,
   a port that moved), add or update a `gotchas.md` block for it.

History lives in the journal and reports; the wiki always shows only the current
best claim.

## Distillation (report phase, main model only)

Distillation is the wiki-maintenance pass — the executor acts as bookkeeper per
`schema.md`:

1. Read today's (and any unprocessed) journal files.
2. Fold durable facts into the wiki: update existing entries first (supersede where
   contradicted); create a concept page only per the Wiki conventions above;
   re-stamp `verified:` on anything re-confirmed this run. Fix wikilinks touched
   by the changes.
3. Regenerate `index.md` from the current pages.
4. Mark the journal file processed by appending `<!-- distilled: <runid> -->`.
5. Wiki pages must stay SHORT — prune aggressively; one-off observations that
   earned no reuse stay in the journal; history lives in reports.

## Schema evolution

`schema.md` may be refined during distillation when a convention demonstrably
fails for this project (e.g. a monorepo needs per-app runbook sections). Rules:
the layout above and the five canonical pages are the floor and never change;
every schema change is journaled with a one-line rationale; /exec-mem `show`
surfaces schema drift from the contract defaults.

## Credentials policy

`data.md` may hold local test credentials. Interactive: ask before saving a new
credential. Agentic: NEVER auto-save new credentials — flag them in the report.
