#!/usr/bin/env node
/**
 * mem-index — derive memory-system indexes from per-file YAML frontmatter.
 *
 * Usage:
 *   node mem-index.js <kind> [--json] [--base <path>]
 *   node mem-index.js all   [--json] [--base <path>]
 *
 * kind: tasks | arch | findings | all
 */

'use strict';

const fs = require('fs');
const path = require('path');

const KINDS = ['tasks', 'arch', 'findings', 'all'];
const VALID_STATUSES = ['open', 'done'];

// Legacy statuses normalize to the current two-state model. There is no longer a
// "current/active" task; anything unfinished is simply `open`.
const STATUS_ALIASES = { active: 'open', paused: 'open', open: 'open', done: 'done' };

function normalizeStatus(raw) {
  return STATUS_ALIASES[raw] || null;
}

// ---------- Arg parsing ----------

function parseArgs(argv) {
  const args = { kind: null, json: false, base: path.join('.', '.claude-memory') };
  const rest = argv.slice(2);
  if (rest.length === 0) return { error: 'missing subcommand' };
  args.kind = rest[0];
  for (let i = 1; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json') {
      args.json = true;
    } else if (a === '--base') {
      i++;
      if (i >= rest.length) return { error: '--base requires a value' };
      args.base = rest[i];
    } else {
      return { error: `unknown argument: ${a}` };
    }
  }
  if (!KINDS.includes(args.kind)) {
    return { error: `unknown subcommand: ${args.kind}` };
  }
  return args;
}

function usage() {
  return [
    'usage: mem-index <tasks|arch|findings|all> [--json] [--base <path>]',
  ].join('\n');
}

// ---------- Frontmatter parsing ----------

/**
 * Parses YAML frontmatter delimited by `---` lines at the start of the file.
 * Returns { frontmatter, body } on success, null if no frontmatter or malformed.
 *
 * Supported syntax (intentionally minimal):
 *   key: value
 *   key: [a, b, c]   (array of strings; bare or "quoted"/'quoted')
 *   key: []
 * Values are strings unless they parse as integers or arrays.
 */
function parseFrontmatter(raw, filePath, warn) {
  // Normalize newlines
  const text = raw.replace(/\r\n/g, '\n');
  // Must start with --- on the first line
  if (!text.startsWith('---\n') && text !== '---' && !text.startsWith('---\r')) {
    return null;
  }
  // Find the closing ---
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) {
    if (warn) warn(`warning: ${filePath} has malformed frontmatter (unclosed ---), skipping`);
    return { malformed: true };
  }
  const fmLines = lines.slice(1, endIdx);
  const body = lines.slice(endIdx + 1).join('\n');
  const fm = {};
  for (const line of fmLines) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      // unsupported (e.g. continuation line). Warn and skip the line.
      if (warn) warn(`warning: ${filePath} unsupported frontmatter line: ${line}`);
      continue;
    }
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    fm[key] = parseValue(value);
  }
  return { frontmatter: fm, body };
}

function parseValue(value) {
  if (value === '') return '';
  // Array: [a, b, c] or []
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((s) => unquote(s.trim()));
  }
  // Quoted scalar
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  // Integer?
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  return value;
}

function unquote(s) {
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  return s;
}

// ---------- Reading & validation ----------

function readKind(base, dir, requiredFields, extraValidate, warn) {
  const dirPath = path.join(base, dir);
  let files;
  try {
    files = fs.readdirSync(dirPath);
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return [];
    throw e;
  }
  const out = [];
  for (const name of files) {
    if (!name.endsWith('.md')) continue;
    const fullPath = path.join(dirPath, name);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (_) {
      continue;
    }
    if (!stat.isFile()) continue;
    let raw;
    try {
      raw = fs.readFileSync(fullPath, 'utf8');
    } catch (e) {
      warn(`warning: cannot read ${fullPath}: ${e.message}`);
      continue;
    }
    const parsed = parseFrontmatter(raw, path.join(dir, name), warn);
    if (parsed === null) {
      warn(`warning: ${path.join(dir, name)} has no frontmatter, skipping`);
      continue;
    }
    if (parsed.malformed) {
      // already warned
      continue;
    }
    const fm = parsed.frontmatter;
    // Derive slug from filename for tasks if missing
    if (dir === 'tasks' && !fm.slug) {
      fm.slug = name.replace(/\.md$/, '');
    }
    let missing = null;
    for (const field of requiredFields) {
      if (fm[field] === undefined || fm[field] === null || fm[field] === '') {
        missing = field;
        break;
      }
    }
    if (missing) {
      warn(
        `warning: ${path.join(dir, name)} missing required field ${missing}, skipping`
      );
      continue;
    }
    if (extraValidate) {
      const err = extraValidate(fm);
      if (err) {
        warn(`warning: ${path.join(dir, name)} ${err}, skipping`);
        continue;
      }
    }
    fm.__file = path.posix.join(dir, name).replace(/\\/g, '/');
    out.push(fm);
  }
  return out;
}

// ---------- Formatting ----------

function formatTasksMarkdown(entries) {
  if (entries.length === 0) {
    return '# Tasks\n\n_(no tasks)_\n';
  }
  const groups = { open: [], done: [] };
  for (const e of entries) groups[e.status].push(e);
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => {
      const ua = String(a.updated || '');
      const ub = String(b.updated || '');
      if (ua !== ub) return ua < ub ? 1 : -1; // desc
      return String(a.slug).localeCompare(String(b.slug));
    });
  }
  const parts = ['# Tasks\n'];
  const labels = { open: 'Open', done: 'Done' };
  for (const k of ['open', 'done']) {
    if (groups[k].length === 0) continue;
    parts.push(`\n## ${labels[k]}\n`);
    for (const t of groups[k]) {
      const summary = t.summary || '(no summary)';
      const topics = Array.isArray(t.topics) && t.topics.length > 0
        ? ` · topics: [${t.topics.join(', ')}]`
        : '';
      const updated = t.updated ? ` · updated ${t.updated}` : '';
      parts.push(
        `- **${t.title}** (\`${t.slug}\`) — ${summary}${updated}${topics} · [open](${t.__file})`
      );
    }
    parts.push('');
  }
  return parts.join('\n').replace(/\n+$/, '\n');
}

function formatArchMarkdown(entries) {
  if (entries.length === 0) {
    return '# Components\n\n_(none)_\n';
  }
  const sorted = entries.slice().sort((a, b) =>
    String(a.component).localeCompare(String(b.component))
  );
  const parts = ['# Components\n'];
  parts.push('| Component | Responsibility | File |');
  parts.push('|-----------|----------------|------|');
  for (const a of sorted) {
    parts.push(`| ${a.component} | ${a.responsibility} | [${a.__file}](${a.__file}) |`);
  }
  return parts.join('\n') + '\n';
}

function formatFindingsMarkdown(entries) {
  if (entries.length === 0) {
    return '# Findings\n\n_(none)_\n';
  }
  const sorted = entries.slice().sort((a, b) =>
    String(a.topic).localeCompare(String(b.topic))
  );
  const parts = ['# Findings\n'];
  for (const f of sorted) {
    parts.push(`- **${f.topic}** — ${f.summary} · [${f.__file}](${f.__file})`);
  }
  return parts.join('\n') + '\n';
}

// ---------- JSON shaping ----------

function tasksToJSON(entries) {
  const groups = { open: [], done: [] };
  for (const e of entries) groups[e.status].push(e);
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => {
      const ua = String(a.updated || '');
      const ub = String(b.updated || '');
      if (ua !== ub) return ua < ub ? 1 : -1;
      return String(a.slug).localeCompare(String(b.slug));
    });
    groups[k] = groups[k].map((t) => ({
      title: t.title,
      slug: t.slug,
      status: t.status,
      summary: t.summary || null,
      created: t.created || null,
      updated: t.updated || null,
      topics: Array.isArray(t.topics) ? t.topics : [],
      file: t.__file,
    }));
  }
  return groups;
}

function archToJSON(entries) {
  return entries
    .slice()
    .sort((a, b) => String(a.component).localeCompare(String(b.component)))
    .map((a) => ({
      component: a.component,
      responsibility: a.responsibility,
      file: a.__file,
    }));
}

function findingsToJSON(entries) {
  return entries
    .slice()
    .sort((a, b) => String(a.topic).localeCompare(String(b.topic)))
    .map((f) => ({
      topic: f.topic,
      summary: f.summary,
      updated: f.updated || null,
      file: f.__file,
    }));
}

// ---------- Loaders per kind ----------

function loadTasks(base, warn) {
  return readKind(
    base,
    'tasks',
    ['title', 'status', 'updated'],
    (fm) => {
      const normalized = normalizeStatus(fm.status);
      if (!normalized) {
        return `has invalid status '${fm.status}'`;
      }
      fm.status = normalized; // collapse legacy active/paused into open
      return null;
    },
    warn
  );
}

function loadArch(base, warn) {
  return readKind(base, 'arch', ['component', 'responsibility'], null, warn);
}

function loadFindings(base, warn) {
  return readKind(base, 'findings', ['topic', 'summary'], null, warn);
}

// ---------- Main ----------

function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.error) {
    process.stderr.write(`error: ${parsed.error}\n${usage()}\n`);
    process.exit(2);
  }
  const { kind, json, base } = parsed;
  const warn = (msg) => process.stderr.write(msg + '\n');

  if (kind === 'tasks') {
    const entries = loadTasks(base, warn);
    if (json) {
      process.stdout.write(JSON.stringify(tasksToJSON(entries), null, 2) + '\n');
    } else {
      process.stdout.write(formatTasksMarkdown(entries));
    }
    process.exit(0);
  }
  if (kind === 'arch') {
    const entries = loadArch(base, warn);
    if (json) {
      process.stdout.write(JSON.stringify(archToJSON(entries), null, 2) + '\n');
    } else {
      process.stdout.write(formatArchMarkdown(entries));
    }
    process.exit(0);
  }
  if (kind === 'findings') {
    const entries = loadFindings(base, warn);
    if (json) {
      process.stdout.write(JSON.stringify(findingsToJSON(entries), null, 2) + '\n');
    } else {
      process.stdout.write(formatFindingsMarkdown(entries));
    }
    process.exit(0);
  }
  if (kind === 'all') {
    const tasks = loadTasks(base, warn);
    const arch = loadArch(base, warn);
    const findings = loadFindings(base, warn);
    if (json) {
      process.stdout.write(
        JSON.stringify(
          {
            tasks: tasksToJSON(tasks),
            arch: archToJSON(arch),
            findings: findingsToJSON(findings),
          },
          null,
          2
        ) + '\n'
      );
    } else {
      const parts = [
        formatTasksMarkdown(tasks).replace(/\n+$/, ''),
        formatArchMarkdown(arch).replace(/\n+$/, ''),
        formatFindingsMarkdown(findings).replace(/\n+$/, ''),
      ];
      process.stdout.write(parts.join('\n\n') + '\n');
    }
    process.exit(0);
  }
  // Unreachable due to parseArgs validation, but stay safe.
  process.stderr.write(usage() + '\n');
  process.exit(2);
}

main();
