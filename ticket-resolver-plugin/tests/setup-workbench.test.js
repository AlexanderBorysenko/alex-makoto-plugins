/* Tests for bin/setup-workbench.js — run: node tests/setup-workbench.test.js */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const script = path.join(__dirname, '..', 'bin', 'setup-workbench.js');

let failed = false;
function check(name, fn) {
  try {
    fn();
    console.log('  ok  - ' + name);
  } catch (e) {
    failed = true;
    console.error('  FAIL- ' + name + '\n        ' + e.message);
  }
}

function run(base, json = true) {
  const a = ['--base', base];
  if (json) a.push('--json');
  const res = spawnSync(process.execPath, [script].concat(a), { encoding: 'utf8' });
  let out = null;
  if (json && res.stdout.trim()) {
    try { out = JSON.parse(res.stdout); } catch { /* leave null */ }
  }
  return { res, out };
}

function mkRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-setup-'));
  fs.mkdirSync(path.join(root, '.git'), { recursive: true });
  return root;
}

// ---- happy path on a fresh repo ----
check('fresh repo: creates workbench, exclude, runbook', () => {
  const root = mkRepo();
  const { out, res } = run(root);
  assert.strictEqual(res.status, 0, 'exit 0');
  assert(out && out.ok, 'ok:true');
  assert(fs.existsSync(path.join(root, '.workbench')), '.workbench exists');
  assert(fs.existsSync(path.join(root, '.workbench', 'RUNBOOK.md')), 'RUNBOOK exists');
  const excl = fs.readFileSync(path.join(root, '.git', 'info', 'exclude'), 'utf8');
  assert(excl.split(/\r?\n/).includes('.workbench/'), 'exclude has .workbench/');
});

// ---- idempotent ----
check('second run is idempotent (no duplicate exclude line)', () => {
  const root = mkRepo();
  run(root);
  run(root);
  const excl = fs.readFileSync(path.join(root, '.git', 'info', 'exclude'), 'utf8');
  const count = excl.split(/\r?\n/).filter((l) => l.trim() === '.workbench/').length;
  assert.strictEqual(count, 1, 'exactly one .workbench/ line, got ' + count);
});

// ---- preserves an existing exclude + does not clobber an existing runbook ----
check('preserves existing exclude content and existing RUNBOOK', () => {
  const root = mkRepo();
  fs.mkdirSync(path.join(root, '.git', 'info'), { recursive: true });
  fs.writeFileSync(path.join(root, '.git', 'info', 'exclude'), '# pre-existing\n*.log\n');
  fs.mkdirSync(path.join(root, '.workbench'), { recursive: true });
  fs.writeFileSync(path.join(root, '.workbench', 'RUNBOOK.md'), 'CUSTOM RUNBOOK');
  run(root);
  const excl = fs.readFileSync(path.join(root, '.git', 'info', 'exclude'), 'utf8');
  assert(excl.includes('*.log'), 'kept prior exclude');
  assert(excl.split(/\r?\n/).includes('.workbench/'), 'added .workbench/');
  assert.strictEqual(fs.readFileSync(path.join(root, '.workbench', 'RUNBOOK.md'), 'utf8'), 'CUSTOM RUNBOOK', 'runbook untouched');
});

// ---- not a git repo ----
check('non-git dir fails with non-zero exit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-nogit-'));
  const { out, res } = run(root);
  assert.notStrictEqual(res.status, 0, 'non-zero exit');
  assert(out && out.ok === false, 'ok:false');
});

if (failed) {
  console.error('FAILED');
  process.exit(1);
}
console.log('OK');
