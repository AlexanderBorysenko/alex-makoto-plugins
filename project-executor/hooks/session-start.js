#!/usr/bin/env node

// SessionStart hook for project-executor.
// Surfaces execution-memory state at session start so the main thread can decide
// between /execute (with auto-init) vs raw Bash BEFORE the first tool call.
// Sister-plugin pattern: researcher/hooks/session-start.js.

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const dir = path.join(cwd, '.claude-memory', 'executions');

function statSafe(p) {
  try { return fs.statSync(p); } catch { return null; }
}

const rootStat = statSafe(dir);
let state, detail;

if (!rootStat) {
  state = 'missing';
  detail = 'no .claude-memory/executions/ — /exec-mem init creates it (idempotent, <1s)';
} else {
  const canonical = ['index.md', 'schema.md', 'env.md', 'runbook.md', 'data.md', 'browser.md', 'gotchas.md'];
  const missing = canonical.filter(f => !statSafe(path.join(dir, f)));
  if (missing.length === canonical.length) {
    state = 'empty';
    detail = 'dir exists but no canonical pages — /exec-mem init seeds them';
  } else if (missing.length > 0) {
    state = 'partial';
    detail = `missing pages: ${missing.join(', ')} — /exec-mem init is idempotent, safe to re-run`;
  } else {
    // Runbook staleness: any entry older than 14d?
    let runbook = '';
    try { runbook = fs.readFileSync(path.join(dir, 'runbook.md'), 'utf8'); } catch {}
    const stamps = [...runbook.matchAll(/^verified:\s*(\d{4}-\d{2}-\d{2})/gm)].map(m => m[1]);
    const oldest = stamps.sort()[0];
    const stale = oldest && (Date.now() - new Date(oldest).getTime()) > 14 * 86400000;
    state = stale ? 'stale' : 'ready';
    detail = stamps.length
      ? `${stamps.length} runbook entries, oldest verified ${oldest}${stale ? ' — stale (>14d), re-verify before relying' : ''}`
      : 'runbook empty';
  }
}

const out = [];
out.push('Project-executor plugin active.');
out.push(`Execution memory: ${state} — ${detail}.`);
if (state === 'missing' || state === 'empty') {
  out.push('Routing rule: when the user asks to run/start/test/reproduce anything locally, prefer /execute over raw Bash. /execute auto-runs /exec-mem init on first use — do NOT silently fall back to raw tools.');
} else {
  out.push('For "run the app", "run tests", "reproduce this bug", "check if X actually works locally" — use /execute (loads the wiki, produces evidence report). Do not hand-roll with raw Bash.');
}

process.stdout.write(out.join('\n') + '\n');
