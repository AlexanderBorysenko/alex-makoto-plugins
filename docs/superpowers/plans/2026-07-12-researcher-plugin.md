# Researcher Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `researcher` Claude Code plugin: deterministic research triage (L1/L2/L3), tool routing over Graphify/Serena/context-mode/web, anti-hallucination grounding rules, and a citable `.claude-research/` findings store.

**Architecture:** Skills + hooks package mirroring `memory-system-plugin`: a node SessionStart hook does deterministic detection (graphify-out, .serena, .claude-research) and injects a ≤10-line status block; one `researcher` skill holds triage/routing/grounding workflow; two thin slash commands (`/research`, `/research-setup`) delegate to it; a node `bin/research-index.js` lists findings with git-HEAD staleness marking.

**Tech Stack:** Node.js (no dependencies, `require` style like memory-system-plugin), plain-assert tests run with `node tests/<file>.test.js`, Claude Code plugin manifest format.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-researcher-plugin-design.md` — plan implements it fully, with one approved deviation: node hook script instead of ps1/sh pair (repo convention).
- SessionStart hook output ≤ 10 lines.
- No silent expensive operations: setup skill must state graphify indexing token cost and get approval before running it.
- Node scripts: zero npm dependencies, CommonJS (`require`), shebang `#!/usr/bin/env node`.
- Per-project store path: `.claude-research/` with `config.md`, `INDEX.md`, `findings/`.
- Memory boundary: never write into `.claude-memory/` from this plugin.
- All new files live under `researcher/` at repo root (dir already exists with an empty `intro.md` — delete it in Task 1).
- Commit after every task, message prefix `researcher:`.

---

### Task 1: Plugin scaffold + SessionStart detection hook

**Files:**
- Create: `researcher/.claude-plugin/plugin.json`
- Create: `researcher/hooks/hooks.json`
- Create: `researcher/hooks/session-start.js`
- Test: `researcher/tests/session-start.test.js`
- Delete: `researcher/intro.md`

**Interfaces:**
- Produces: `session-start.js` — run with `cwd` = project root, prints status block to stdout. Lines: `graphify: ready|missing`, `serena: ready|missing`, `research store: ready (<project>) — N findings indexed` or `research store: missing`, plus either a `/research-setup` offer line or a use-researcher-skill line.
- Detection paths (relative to cwd): `graphify-out/graph.json`, `.serena/project.yml`, `.claude-research/` (+ `INDEX.md`, `config.md` inside).

- [ ] **Step 1: Write the failing test**

Create `researcher/tests/session-start.test.js`:

```js
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const script = path.join(__dirname, '..', 'hooks', 'session-start.js');

function run(cwd) {
  return execFileSync('node', [script], { encoding: 'utf8', cwd });
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'researcher-test-'));
}

// Case 1: empty project — everything missing, setup offered once
{
  const dir = tmpDir();
  const out = run(dir);
  assert.ok(out.includes('Researcher plugin active'), `banner missing: ${out}`);
  assert.ok(out.includes('graphify: missing'), `graphify status: ${out}`);
  assert.ok(out.includes('serena: missing'), `serena status: ${out}`);
  assert.ok(out.includes('research store: missing'), `store status: ${out}`);
  assert.ok(out.includes('/research-setup'), `setup offer missing: ${out}`);
  assert.ok(out.includes('do not nag'), `offer-once wording missing: ${out}`);
  const lineCount = out.trim().split('\n').length;
  assert.ok(lineCount <= 10, `output ${lineCount} lines, budget 10:\n${out}`);
}

// Case 2: fully set up project — ready statuses, findings count, project name
{
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, 'graphify-out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'graphify-out', 'graph.json'), '{}');
  fs.mkdirSync(path.join(dir, '.serena'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.serena', 'project.yml'), 'name: demo\n');
  fs.mkdirSync(path.join(dir, '.claude-research', 'findings'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.claude-research', 'INDEX.md'),
    '# Research index\n\n- [Auth flow](findings/auth-flow.md) — token refresh — 2026-07-12\n- [DB triggers](findings/db-triggers.md) — audit log — 2026-07-12\n'
  );
  fs.writeFileSync(
    path.join(dir, '.claude-research', 'config.md'),
    '---\nproject: Karpaty Wiki LLM\n---\n'
  );
  const out = run(dir);
  assert.ok(out.includes('graphify: ready'), `graphify status: ${out}`);
  assert.ok(out.includes('serena: ready'), `serena status: ${out}`);
  assert.ok(out.includes('research store: ready (Karpaty Wiki LLM) — 2 findings indexed'), `store line: ${out}`);
  assert.ok(!out.includes('/research-setup'), `setup offered when nothing missing: ${out}`);
  assert.ok(out.includes('/research'), `skill pointer missing: ${out}`);
  const lineCount = out.trim().split('\n').length;
  assert.ok(lineCount <= 10, `output ${lineCount} lines, budget 10:\n${out}`);
}

// Case 3: partial — store exists but graphify missing → setup offer names missing piece only
{
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, '.claude-research', 'findings'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude-research', 'INDEX.md'), '# Research index\n');
  const out = run(dir);
  assert.ok(out.includes('graphify: missing'), `graphify status: ${out}`);
  assert.ok(out.includes('research store: ready'), `store status: ${out}`);
  assert.ok(out.includes('/research-setup'), `setup offer missing: ${out}`);
}

console.log('session-start.test.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node researcher/tests/session-start.test.js`
Expected: FAIL — `Error: Cannot find module ... hooks/session-start.js` (or ENOENT from execFileSync).

- [ ] **Step 3: Write the hook script + manifests**

Create `researcher/hooks/session-start.js`:

```js
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const lines = [];
const missing = [];

const graphifyReady = fs.existsSync(path.join(cwd, 'graphify-out', 'graph.json'));
lines.push(`graphify: ${graphifyReady ? 'ready' : 'missing'}`);
if (!graphifyReady) missing.push('graphify index');

const serenaReady = fs.existsSync(path.join(cwd, '.serena', 'project.yml'));
lines.push(`serena: ${serenaReady ? 'ready' : 'missing'}`);
if (!serenaReady) missing.push('serena project');

const store = path.join(cwd, '.claude-research');
if (fs.existsSync(store)) {
  let count = 0;
  let project = '';
  const indexPath = path.join(store, 'INDEX.md');
  if (fs.existsSync(indexPath)) {
    count = fs
      .readFileSync(indexPath, 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('- ')).length;
  }
  const configPath = path.join(store, 'config.md');
  if (fs.existsSync(configPath)) {
    const m = fs.readFileSync(configPath, 'utf8').match(/^project:\s*(.+)$/m);
    if (m) project = m[1].trim();
  }
  lines.push(
    `research store: ready${project ? ` (${project})` : ''} — ${count} findings indexed`
  );
} else {
  lines.push('research store: missing');
  missing.push('research store');
}

let out = `Researcher plugin active.\n${lines.join('\n')}`;
if (missing.length) {
  out += `\nMissing: ${missing.join(', ')} — offer /research-setup once this session; do not nag again.`;
} else {
  out += `\nFor investigation/lookup questions invoke the researcher skill (/research): triage L1/L2/L3, route tools deterministically, ground every claim with evidence.`;
}
process.stdout.write(out + '\n');
```

Create `researcher/.claude-plugin/plugin.json`:

```json
{
  "name": "researcher",
  "version": "0.1.0",
  "description": "Deterministic research orchestration: complexity triage (L1/L2/L3), tool routing over Graphify/Serena/context-mode/web, anti-hallucination grounding, citable research memory.",
  "author": {
    "name": "alex.borysenko"
  }
}
```

Create `researcher/hooks/hooks.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|resume|clear|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node ${CLAUDE_PLUGIN_ROOT}/hooks/session-start.js"
          }
        ]
      }
    ]
  }
}
```

Delete the placeholder: `git rm researcher/intro.md` (file is empty; created as scratch note before design).

- [ ] **Step 4: Run test to verify it passes**

Run: `node researcher/tests/session-start.test.js`
Expected: `session-start.test.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add researcher/.claude-plugin/plugin.json researcher/hooks/hooks.json researcher/hooks/session-start.js researcher/tests/session-start.test.js
git rm --quiet researcher/intro.md
git commit -m "researcher: plugin scaffold + SessionStart detection hook"
```

---

### Task 2: Findings index CLI with staleness marking

**Files:**
- Create: `researcher/bin/research-index.js`
- Test: `researcher/tests/research-index.test.js`

**Interfaces:**
- Consumes: `.claude-research/findings/*.md` files with YAML-ish frontmatter written by the skill (Task 4). Frontmatter fields used here: `title:` (string), `date:` (YYYY-MM-DD), `level:` (L1|L2|L3), `head:` (git SHA at write time), `files:` (indented `- path` list).
- Produces: CLI `node research-index.js list [projectRoot]` — prints one line per finding: `- [<title>](findings/<file>) — <level> — <date>` prefixed with `STALE? ` when any listed file changed between `head` and current `HEAD`. Non-git dir or unknown SHA → no staleness check, plain lines. The `researcher` skill (Task 4) calls this exact command on load.

- [ ] **Step 1: Write the failing test**

Create `researcher/tests/research-index.test.js`:

```js
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const script = path.join(__dirname, '..', 'bin', 'research-index.js');

function sh(cmd, args, cwd) {
  return execFileSync(cmd, args, { encoding: 'utf8', cwd });
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-index-test-'));
  sh('git', ['init', '-q'], dir);
  sh('git', ['config', 'user.email', 'test@test'], dir);
  sh('git', ['config', 'user.name', 'test'], dir);
  return dir;
}

function writeFinding(dir, slug, fm) {
  const findingsDir = path.join(dir, '.claude-research', 'findings');
  fs.mkdirSync(findingsDir, { recursive: true });
  fs.writeFileSync(path.join(findingsDir, `${slug}.md`), fm);
}

// Case 1: fresh finding — evidence files untouched since recorded head → no STALE?
{
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'auth.js'), 'x');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c1'], dir);
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  writeFinding(
    dir,
    'auth-flow',
    `---\ntitle: Auth flow\ndate: 2026-07-12\nlevel: L2\nhead: ${head}\nfiles:\n  - auth.js\n---\n\nBody.\n`
  );
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('- [Auth flow](findings/auth-flow.md) — L2 — 2026-07-12'), `line: ${out}`);
  assert.ok(!out.includes('STALE?'), `unexpected stale: ${out}`);
}

// Case 2: evidence file changed after head → STALE? prefix
{
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'auth.js'), 'x');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c1'], dir);
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  writeFinding(
    dir,
    'auth-flow',
    `---\ntitle: Auth flow\ndate: 2026-07-12\nlevel: L2\nhead: ${head}\nfiles:\n  - auth.js\n---\n\nBody.\n`
  );
  fs.writeFileSync(path.join(dir, 'auth.js'), 'changed');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c2'], dir);
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('STALE? - [Auth flow](findings/auth-flow.md)'), `stale expected: ${out}`);
}

// Case 3: unrelated file changed → not stale
{
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'auth.js'), 'x');
  fs.writeFileSync(path.join(dir, 'other.js'), 'y');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c1'], dir);
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  writeFinding(
    dir,
    'auth-flow',
    `---\ntitle: Auth flow\ndate: 2026-07-12\nlevel: L2\nhead: ${head}\nfiles:\n  - auth.js\n---\n\nBody.\n`
  );
  fs.writeFileSync(path.join(dir, 'other.js'), 'changed');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c2'], dir);
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(!out.includes('STALE?'), `unexpected stale: ${out}`);
}

// Case 4: no findings dir → friendly empty message, exit 0
{
  const dir = makeRepo();
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('no findings'), `empty message: ${out}`);
}

// Case 5: non-git directory → lines print without staleness check, no crash
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-index-nogit-'));
  writeFinding(
    dir,
    'auth-flow',
    `---\ntitle: Auth flow\ndate: 2026-07-12\nlevel: L2\nhead: deadbeef\nfiles:\n  - auth.js\n---\n\nBody.\n`
  );
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('- [Auth flow](findings/auth-flow.md) — L2 — 2026-07-12'), `line: ${out}`);
  assert.ok(!out.includes('STALE?'), `stale without git: ${out}`);
}

console.log('research-index.test.js: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node researcher/tests/research-index.test.js`
Expected: FAIL — cannot find `bin/research-index.js`.

- [ ] **Step 3: Write the CLI**

Create `researcher/bin/research-index.js`:

```js
#!/usr/bin/env node

// Usage: node research-index.js list [projectRoot]
// Prints one INDEX-style line per findings/*.md, prefixed with "STALE? "
// when any evidence file changed between the finding's recorded head and HEAD.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const get = (key) => {
    const mm = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return mm ? mm[1].trim() : '';
  };
  const files = [];
  const filesBlock = fm.match(/^files:\n((?:\s+-\s+.+\n?)+)/m);
  if (filesBlock) {
    for (const line of filesBlock[1].split('\n')) {
      const fm2 = line.match(/^\s+-\s+(.+)$/);
      if (fm2) files.push(fm2[1].trim());
    }
  }
  return {
    title: get('title'),
    date: get('date'),
    level: get('level'),
    head: get('head'),
    files,
  };
}

function changedFilesSince(head, cwd) {
  try {
    const out = execFileSync('git', ['diff', '--name-only', `${head}..HEAD`], {
      encoding: 'utf8',
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return new Set(out.split('\n').filter(Boolean));
  } catch {
    return null; // not a git repo, unknown SHA, etc. — skip staleness
  }
}

function list(root) {
  const findingsDir = path.join(root, '.claude-research', 'findings');
  if (!fs.existsSync(findingsDir)) {
    console.log('research store: no findings yet.');
    return;
  }
  const entries = fs
    .readdirSync(findingsDir)
    .filter((f) => f.endsWith('.md'))
    .sort();
  if (entries.length === 0) {
    console.log('research store: no findings yet.');
    return;
  }
  for (const file of entries) {
    const text = fs.readFileSync(path.join(findingsDir, file), 'utf8');
    const meta = parseFrontmatter(text);
    if (!meta || !meta.title) {
      console.log(`- [${file}](findings/${file}) — unparsed frontmatter`);
      continue;
    }
    let stale = false;
    if (meta.head && meta.files.length > 0) {
      const changed = changedFilesSince(meta.head, root);
      if (changed) stale = meta.files.some((f) => changed.has(f));
    }
    const prefix = stale ? 'STALE? ' : '';
    console.log(`${prefix}- [${meta.title}](findings/${file}) — ${meta.level} — ${meta.date}`);
  }
}

const [, , cmd, rootArg] = process.argv;
const root = path.resolve(rootArg || process.cwd());
if (cmd === 'list') {
  list(root);
} else {
  console.error('Usage: research-index.js list [projectRoot]');
  process.exit(1);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node researcher/tests/research-index.test.js`
Expected: `research-index.test.js: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add researcher/bin/research-index.js researcher/tests/research-index.test.js
git commit -m "researcher: findings index CLI with git-HEAD staleness marking"
```

---

### Task 3: Store templates

**Files:**
- Create: `researcher/templates/config.md`
- Create: `researcher/templates/research-index.md`
- Create: `researcher/templates/finding.md`

**Interfaces:**
- Produces: templates copied verbatim by `/research-setup` (Task 4) into `.claude-research/`. `finding.md` frontmatter fields MUST match what `research-index.js` parses: `title`, `date`, `level`, `head`, `files` (indented dash list).

- [ ] **Step 1: Write the templates**

Create `researcher/templates/config.md`:

```markdown
---
project: <project name>
---

# Researcher config — <project name>

## Available tools

Mark each `yes` / `no`. Routing skips tools marked `no`.

- graphify: yes
- serena: yes
- context-mode: yes
- web (context7 / firecrawl / WebSearch): yes

## Domain notes

<Short, stable facts about the domain the router should know. Not findings —
those go in findings/. Examples: "wiki content is Ukrainian-language",
"embeddings pipeline lives in a separate repo".>

## Store policy

- committed: <yes|no — whether .claude-research/ is committed to git>
```

Create `researcher/templates/research-index.md`:

```markdown
# Research index

One line per finding: `- [Title](findings/slug.md) — hook — YYYY-MM-DD`.
Regenerate staleness view with: `node ${CLAUDE_PLUGIN_ROOT}/bin/research-index.js list`
```

Create `researcher/templates/finding.md`:

```markdown
---
title: <short title>
date: <YYYY-MM-DD>
level: <L1|L2|L3>
head: <git rev-parse HEAD at write time>
files:
  - <evidence file path 1>
  - <evidence file path 2>
---

# <short title>

**Question:** <the research question as asked>

**Answer:** <2-6 sentence summary. Claims without evidence pointers below must
be prefixed "unverified:".>

## Evidence

- `<file>:<line>` — <what this shows>
- <tool> `<query>` → <what it returned, one line>

## For goggles

<PCE vocabulary so architect/product-designer goggles can consume this
as pre-verified evidence. Empty sections allowed.>

- Nodes: <name — file — kind (service|module|job|store|...)>
- Edges: <from → to — kind (calls|reads|writes|publishes|...)>
- Black-box suspects: <hidden influences worth a perimeter-scan: triggers, cron, broker behavior>
```

- [ ] **Step 2: Verify frontmatter compatibility with the index CLI**

Run:

```bash
mkdir -p /tmp/researcher-tpl-check/.claude-research/findings
sed -e 's/<short title>/Template check/' -e 's/<YYYY-MM-DD>/2026-07-12/' -e 's/<L1|L2|L3>/L1/' -e 's/<git rev-parse HEAD at write time>/deadbeef/' -e 's/<evidence file path 1>/a.js/' -e 's/<evidence file path 2>/b.js/' researcher/templates/finding.md > /tmp/researcher-tpl-check/.claude-research/findings/template-check.md
node researcher/bin/research-index.js list /tmp/researcher-tpl-check
```

Expected output: `- [Template check](findings/template-check.md) — L1 — 2026-07-12` (no `STALE?`, no `unparsed frontmatter`).

- [ ] **Step 3: Commit**

```bash
git add researcher/templates/config.md researcher/templates/research-index.md researcher/templates/finding.md
git commit -m "researcher: store templates (config, index, finding)"
```

---

### Task 4: Researcher skill + slash commands

**Files:**
- Create: `researcher/skills/researcher/SKILL.md`
- Create: `researcher/commands/research.md`
- Create: `researcher/commands/research-setup.md`

**Interfaces:**
- Consumes: `node ${CLAUDE_PLUGIN_ROOT}/bin/research-index.js list` (Task 2), templates in `${CLAUDE_PLUGIN_ROOT}/templates/` (Task 3), status block from SessionStart hook (Task 1).
- Produces: the `/research` and `/research-setup` slash commands; findings docs conforming to `templates/finding.md`.

- [ ] **Step 1: Write SKILL.md**

Create `researcher/skills/researcher/SKILL.md`:

````markdown
---
name: researcher
description: Deterministic research workflow for codebase/domain questions. Use whenever the user asks to investigate, look up, trace, or understand code or data — or types /research or /research-setup. Triage L1/L2/L3, route to Graphify/Serena/context-mode/web by table, ground every claim with evidence pointers, persist reusable findings to .claude-research/.
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
6. If memory/graph contradicts current code, current code wins; mark the memory/finding stale.

## Step 0 — load state

- If `.claude-research/` exists: read `.claude-research/config.md` (tool availability + domain notes), then run
  `node ${CLAUDE_PLUGIN_ROOT}/bin/research-index.js list` and scan for findings relevant to the question.
  A relevant non-STALE finding may be cited as evidence; a `STALE?` finding must be re-verified before citing.
- If `.claude-research/` does not exist: proceed without memory; offer `/research-setup` once at the end of the answer.

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
| **L3** | `graphify explain` + `graphify-out/wiki/`; web research (context7 for libraries, firecrawl/WebSearch otherwise); parallel Explore subagents for wide sweeps | context-mode for processing; `.claude-memory/architecture_cache.md` as read-only context | Findings doc in `.claude-research/findings/` + INDEX.md line. |

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
   `head:` = current `git rev-parse HEAD`; `files:` = the evidence files cited.
2. Save as `.claude-research/findings/<kebab-slug>.md`.
3. Append to `.claude-research/INDEX.md`: `- [Title](findings/<slug>.md) — <hook> — <date>`.
4. Fill the **For goggles** section (nodes/edges/black-box suspects) whenever the finding touched structure — architect-goggles and product-designer-goggles consume it as pre-verified evidence. This link is one-way: never read goggles maps as research evidence.

Boundary: never write into `.claude-memory/` — that store belongs to the memory-system plugin.

## Setup workflow (/research-setup)

1. If `.claude-research/` missing: create `config.md` from `${CLAUDE_PLUGIN_ROOT}/templates/config.md`
   (ask for project name + domain notes; for tool availability, prefill from the SessionStart status block),
   `INDEX.md` from `templates/research-index.md`, and an empty `findings/` dir.
2. Ask whether `.claude-research/` should be committed or gitignored; record the choice in config.md
   and add a `.gitignore` entry if gitignored.
3. `graphify-out/graph.json` missing and graphify wanted: state that `graphify index .` costs API tokens
   and can take a while; run it ONLY after explicit approval.
4. Serena not activated and wanted: offer `mcp__plugin_serena_serena__activate_project` / onboarding.
5. Finish with the same status block format the SessionStart hook prints.
````

- [ ] **Step 2: Write the slash commands**

Create `researcher/commands/research.md`:

```markdown
---
description: Research a question with deterministic triage (L1/L2/L3), tool routing, and evidence-grounded answers.
---

Invoke the `researcher` skill and run its full flow (**triage → route → execute → ground → persist**) on this question:

$ARGUMENTS

State the triage level first. Follow the grounding rules for every claim. If the question is ambiguous at triage, ask one clarifying question instead of guessing.
```

Create `researcher/commands/research-setup.md`:

```markdown
---
description: Bootstrap research tooling — .claude-research/ store, graphify index (with approval), Serena activation.
---

Invoke the `researcher` skill and run its **Setup workflow** section:

1. Create `.claude-research/` (config.md, INDEX.md, findings/) from the plugin templates if missing; ask for project name and domain notes.
2. Ask commit-vs-gitignore for the store and record it.
3. Offer graphify indexing (state token cost, require explicit approval) and Serena activation for whichever the SessionStart status block reported missing.
4. Finish by printing the status block.
```

- [ ] **Step 3: Verify skill/command wiring**

Run:

```bash
grep -c "STALE?" researcher/skills/researcher/SKILL.md
grep -c "unverified:" researcher/skills/researcher/SKILL.md
grep -n "research-index.js list" researcher/skills/researcher/SKILL.md
grep -n "researcher" researcher/commands/research.md researcher/commands/research-setup.md
```

Expected: first two greps ≥ 1; third shows the Step 0 call; fourth shows both commands referencing the `researcher` skill. Then confirm frontmatter parses: `head -5 researcher/skills/researcher/SKILL.md` shows `name: researcher` and a `description:` line.

- [ ] **Step 4: Commit**

```bash
git add researcher/skills/researcher/SKILL.md researcher/commands/research.md researcher/commands/research-setup.md
git commit -m "researcher: skill (triage/routing/grounding/persist) + slash commands"
```

---

### Task 5: README, full test run, acceptance

**Files:**
- Create: `researcher/README.md`

**Interfaces:**
- Consumes: everything above. No new interfaces.

- [ ] **Step 1: Write README**

Create `researcher/README.md`:

```markdown
# researcher

Claude Code plugin: deterministic research orchestration. v0.1.0.

**Problem:** ad-hoc investigation — wrong tool per question, context sprawl, and the classic LLM failure of imagining logic that does not exist.

**Solution:** triage → route → execute → ground → persist.

- **Triage** every research question into L1 (lookup) / L2 (investigation) / L3 (deep research); level stated before executing.
- **Route** by table: Serena for symbols, graphify for structure, context-mode for big outputs, context7/firecrawl/WebSearch for external — respecting per-project availability in `.claude-research/config.md`.
- **Ground**: every claim cites `file:line` / tool output / finding; "not found" is a valid answer; READ vs ASSUMED separated; verify-gate checklist before answering.
- **Persist**: findings docs in `.claude-research/findings/` with git-HEAD staleness marking (`bin/research-index.js list`), consumable by architect/product-designer goggles via the "For goggles" section.

## Layout

- `hooks/session-start.js` — deterministic detection (graphify-out, .serena, .claude-research), ≤10-line status block, one-time /research-setup offer.
- `skills/researcher/SKILL.md` — the workflow.
- `commands/research.md`, `commands/research-setup.md` — slash commands.
- `bin/research-index.js` — findings index + staleness CLI.
- `templates/` — config.md, research-index.md, finding.md.

## Boundaries

- Orchestrates graphify/Serena/context-mode — does not wrap or replace them.
- `.claude-memory/` (memory-system plugin) = what we're doing; `.claude-research/` = what we verified true. No cross-writes.
- No silent expensive ops: graphify indexing always needs explicit approval.

## Tests

```
node researcher/tests/session-start.test.js
node researcher/tests/research-index.test.js
```

## Acceptance checklist (manual, per spec)

- [ ] /research on L1 question → triage line, Serena/graphify used, inline answer with pointer, nothing persisted.
- [ ] /research on L2 question → graphify query/path + Serena, evidence pointers on every claim.
- [ ] /research on L3 question → findings doc + INDEX line, "For goggles" section filled.
- [ ] Question about non-existent function → answer is "not found", not invented behavior.
- [ ] Session start in empty project → ≤10 lines, single /research-setup offer.
- [ ] Evidence file changed after finding written → `research-index.js list` shows `STALE?`.
```

- [ ] **Step 2: Run full test suite**

Run:

```bash
node researcher/tests/session-start.test.js && node researcher/tests/research-index.test.js
```

Expected: both print `... all assertions passed`.

- [ ] **Step 3: Commit**

```bash
git add researcher/README.md
git commit -m "researcher: README + acceptance checklist (v0.1.0)"
```
