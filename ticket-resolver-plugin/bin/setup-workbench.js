#!/usr/bin/env node
/*
 * setup-workbench — idempotent filesystem setup for ticket-resolver in a target repo (design §9).
 *
 * Ensures, without mutating git history or contacting any remote:
 *   1. the cwd (or --base) is inside a git repo;
 *   2. `.workbench/` exists at the repo root;
 *   3. `.workbench/` is listed in `.git/info/exclude` (per-clone, uncommitted ignore — appended once);
 *   4. `.workbench/RUNBOOK.md` exists, seeded from the plugin's templates/runbook.md.
 *
 * Git PRECONDITIONS that need git itself (remote present, clean tree, no branch collision) are the
 * orchestrator's job — this script only does the deterministic filesystem mechanics.
 *
 * Usage: node setup-workbench.js [--base <path>] [--json]
 */

'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { base: process.cwd(), json: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--base') {
      i++;
      if (i >= rest.length) return { error: '--base requires a value' };
      args.base = rest[i];
    } else if (rest[i] === '--json') {
      args.json = true;
    } else {
      return { error: 'unknown argument: ' + rest[i] };
    }
  }
  return args;
}

// Walk up from start to find the repo root (a dir containing `.git`).
function findRepoRoot(start) {
  let dir = path.resolve(start);
  for (let i = 0; i < 60; i++) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// Resolve the git common dir, handling `.git` being a file (worktree/submodule pointer).
function gitCommonDir(root) {
  const dotgit = path.join(root, '.git');
  const stat = fs.statSync(dotgit);
  if (stat.isDirectory()) return dotgit;
  // `.git` is a file: `gitdir: <path>`
  const content = fs.readFileSync(dotgit, 'utf8').trim();
  const m = content.match(/^gitdir:\s*(.+)$/m);
  if (!m) return dotgit;
  const gitdir = path.isAbsolute(m[1]) ? m[1] : path.resolve(root, m[1]);
  // For a linked worktree, info/exclude lives in the common dir; try commondir file.
  const commondirFile = path.join(gitdir, 'commondir');
  if (fs.existsSync(commondirFile)) {
    const cd = fs.readFileSync(commondirFile, 'utf8').trim();
    return path.isAbsolute(cd) ? cd : path.resolve(gitdir, cd);
  }
  return gitdir;
}

function ensureExclude(commonDir, entry) {
  const infoDir = path.join(commonDir, 'info');
  const excludeFile = path.join(infoDir, 'exclude');
  fs.mkdirSync(infoDir, { recursive: true });
  let body = '';
  try {
    body = fs.readFileSync(excludeFile, 'utf8');
  } catch {
    /* none yet */
  }
  const lines = body.split(/\r?\n/).map((l) => l.trim());
  if (lines.includes(entry)) return false; // already present
  const needsNL = body.length > 0 && !body.endsWith('\n');
  fs.appendFileSync(excludeFile, (needsNL ? '\n' : '') + entry + '\n');
  return true;
}

function ensureRunbook(workbench) {
  const dest = path.join(workbench, 'RUNBOOK.md');
  if (fs.existsSync(dest)) return false;
  const template = path.join(__dirname, '..', 'templates', 'runbook.md');
  let content;
  try {
    content = fs.readFileSync(template, 'utf8');
  } catch {
    content = '# Local run & test runbook\n\n_(template missing; fill in manually)_\n';
  }
  fs.writeFileSync(dest, content);
  return true;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.error) {
    process.stderr.write('error: ' + args.error + '\n');
    process.exit(2);
  }

  const root = findRepoRoot(args.base);
  if (!root) {
    const msg = 'not a git repository (no .git found from ' + path.resolve(args.base) + ')';
    if (args.json) process.stdout.write(JSON.stringify({ ok: false, error: msg }) + '\n');
    else process.stderr.write('error: ' + msg + '\n');
    process.exit(1);
  }

  const actions = [];
  const workbench = path.join(root, '.workbench');
  if (!fs.existsSync(workbench)) {
    fs.mkdirSync(workbench, { recursive: true });
    actions.push('created .workbench/');
  }

  const commonDir = gitCommonDir(root);
  if (ensureExclude(commonDir, '.workbench/')) actions.push('added .workbench/ to .git/info/exclude');

  if (ensureRunbook(workbench)) actions.push('seeded .workbench/RUNBOOK.md from template');

  const result = { ok: true, root, workbench, actions };
  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(
      'ticket-resolver workbench ready at ' + workbench + '\n' +
        (actions.length ? actions.map((a) => '  • ' + a).join('\n') + '\n' : '  • already set up\n')
    );
  }
  process.exit(0);
}

main();
