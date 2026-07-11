# Memory Contract

All execution memory lives in the TARGET PROJECT at `.claude-memory/executions/`.

## Layout

    .claude-memory/executions/
    ├── env.md          # services, ports, prereqs, OS quirks, required env vars
    ├── runbook.md      # verified commands (start/stop/build/test/seed)
    ├── data.md         # seeds, mock data patterns, test users + LOCAL-ONLY credentials
    ├── browser.md      # base URLs, auth flow, stable selectors, saved playwright routines
    ├── gotchas.md      # failure → resolution pairs; proven instrumentation points
    ├── journal/        # raw dated observations (append-only), one file per day: YYYY-MM-DD.md
    └── reports/<YYYY-MM-DD-slug>/   # see report-contract.md

## Init (idempotent — run whenever a schema file is missing)

1. Create missing directories/files from the templates below.
2. Gitignore guard: ensure the target repo ignores the memory dir. If `.gitignore`
   does not exist, CREATE it containing `.claude-memory/`. If it exists and lacks
   the line, append it. If the repo would still commit `data.md` (check
   `git check-ignore .claude-memory/executions/data.md`), WARN the user before
   writing any credentials.

## Schema file templates

Every schema file starts with an HTML comment stating its purpose, then entries.

`runbook.md` entries (one `##` per action):

    ## start:api
    verified: 2026-07-11
    command: `npm run dev` (cwd: apps/api)
    readiness: GET http://localhost:3000/health → 200 within 30s
    stop: Ctrl+C / kill by port 3000
    notes: needs `DATABASE_URL` from env.md

`env.md`: one `##` per service/prereq with ports, versions, env vars.
`data.md`: one `##` per dataset/user. Credentials marked `local-only: true`.
`browser.md`: `## routine:<name>` blocks — goal, start URL, auth steps, selectors, expected outcome.
`gotchas.md`: `## <symptom>` blocks — symptom, cause, resolution, `verified:` date.
  Instrumentation points: `## trace-point:<topic>` — file:line, what to log, why useful.

## Journal

During any run, append discoveries immediately to `journal/YYYY-MM-DD.md`:

    ### HH:MM <flow> <runid>
    <observation — freeform, raw allowed>

## Read discipline

- Cold start: read schema files ONLY (never the journal, never old reports).
- Journal is write-hot / read-cold: it is only read during distillation.

## Staleness

`verified:` older than 14 days ⇒ entry is STALE. Before relying on a stale entry,
re-verify it cheaply (run it, check readiness). Success ⇒ update the stamp.
Failure ⇒ fix the entry via discovery, or move the broken form to `gotchas.md`.

## Distillation (report phase, main model only)

1. Read today's (and any unprocessed) journal files.
2. Fold durable facts into the schema files; delete contradicted entries; re-stamp
   `verified:` on anything re-confirmed this run.
3. Mark the journal file processed by appending `<!-- distilled: <runid> -->`.
4. Schema files must stay SHORT — prune aggressively; history lives in reports.

## Credentials policy

`data.md` may hold local test credentials. Interactive: ask before saving a new
credential. Agentic: NEVER auto-save new credentials — flag them in the report.
