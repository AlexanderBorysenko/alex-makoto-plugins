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
