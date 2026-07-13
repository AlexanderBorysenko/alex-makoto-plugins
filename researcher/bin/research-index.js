#!/usr/bin/env node

// Usage: node research-index.js list [projectRoot]
// Prints one INDEX-style line per findings/*.md, prefixed with "STALE? "
// when any evidence file changed between the finding's recorded head and HEAD.
// Then lists compiled wiki topic pages (wiki/*.md); a page is STALE? when any
// supporting finding is stale or missing — findings are the raw evidence
// layer, wiki pages are compiled navigation on top (Karpathy LLM-wiki pattern).

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseFrontmatter(text) {
  text = text.replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const get = (key) => {
    const mm = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return mm ? mm[1].trim() : '';
  };
  const listOf = (key) => {
    const items = [];
    const block = fm.match(new RegExp(`^${key}:\\n((?:\\s+-\\s+.+\\n?)+)`, 'm'));
    if (block) {
      for (const line of block[1].split('\n')) {
        const mm = line.match(/^\s+-\s+(.+)$/);
        if (mm) items.push(mm[1].trim());
      }
    }
    return items;
  };
  return {
    title: get('title'),
    date: get('date'),
    level: get('level'),
    head: get('head'),
    topic: get('topic'),
    updated: get('updated'),
    files: listOf('files'),
    findings: listOf('findings'),
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

function mdFiles(dir) {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort();
  } catch {
    return [];
  }
}

// Canonical store: .claude-memory/research; legacy fallback: .claude-research.
function storeRoot(root) {
  const canonical = path.join(root, '.claude-memory', 'research');
  if (fs.existsSync(canonical)) return canonical;
  const legacy = path.join(root, '.claude-research');
  if (fs.existsSync(legacy)) return legacy;
  return canonical;
}

function list(root) {
  const store = storeRoot(root);
  const findingFiles = mdFiles(path.join(store, 'findings'));
  const wikiFiles = mdFiles(path.join(store, 'wiki'));
  if (findingFiles.length === 0 && wikiFiles.length === 0) {
    console.log('research store: no findings yet.');
    return;
  }

  // stale state per finding, keyed by store-relative path ("findings/<file>")
  const staleByPath = new Map();
  for (const file of findingFiles) {
    const text = fs.readFileSync(path.join(store, 'findings', file), 'utf8');
    const meta = parseFrontmatter(text);
    if (!meta || !meta.title) {
      console.log(`- [${file}](findings/${file}) — unparsed frontmatter`);
      continue;
    }
    let stale = false;
    if (meta.head && meta.files.length > 0) {
      const changed = changedFilesSince(meta.head, root);
      if (changed) stale = meta.files.some((f) => changed.has(f.replace(/\\/g, '/')));
    }
    staleByPath.set(`findings/${file}`, stale);
    const prefix = stale ? 'STALE? ' : '';
    console.log(`${prefix}- [${meta.title}](findings/${file}) — ${meta.level} — ${meta.date}`);
  }

  // compiled wiki pages: stale when any supporting finding is stale or missing
  for (const file of wikiFiles) {
    const text = fs.readFileSync(path.join(store, 'wiki', file), 'utf8');
    const meta = parseFrontmatter(text);
    if (!meta || !meta.topic) {
      console.log(`- [${file}](wiki/${file}) — unparsed frontmatter`);
      continue;
    }
    const stale = meta.findings.some((f) => {
      const key = f.replace(/\\/g, '/');
      return !staleByPath.has(key) || staleByPath.get(key) === true;
    });
    const prefix = stale ? 'STALE? ' : '';
    console.log(
      `${prefix}- [${meta.topic}](wiki/${file}) — updated ${meta.updated} — ${meta.findings.length} findings`
    );
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
