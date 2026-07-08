/* Tests for hooks/hard-ban.js — run: node tests/hard-ban.test.js */
'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const hook = path.join(__dirname, '..', 'hooks', 'hard-ban.js');

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

// Run the hook with a payload; returns { decision, raw, status }.
function run(command, { cwd, tool = 'Bash' } = {}) {
  const payload = JSON.stringify({ tool_name: tool, tool_input: { command }, cwd: cwd || process.cwd() });
  const res = spawnSync(process.execPath, [hook], { input: payload, encoding: 'utf8', cwd: cwd || process.cwd() });
  let decision = 'allow';
  if (res.stdout && res.stdout.trim()) {
    try {
      decision = JSON.parse(res.stdout).hookSpecificOutput.permissionDecision;
    } catch {
      decision = 'parse-error';
    }
  }
  return { decision, raw: res.stdout, status: res.status };
}

function isAllow(r) { return r.decision === 'allow' && r.status === 0; }
function isDeny(r) { return r.decision === 'deny' && r.status === 0; }

// Fixture workbench with optional markers.
function mkWorkbench(markers = {}, runAllow = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tr-hardban-'));
  const wb = path.join(root, '.workbench');
  fs.mkdirSync(wb, { recursive: true });
  for (const m of Object.keys(markers)) if (markers[m]) fs.writeFileSync(path.join(wb, m), '');
  if (runAllow) fs.writeFileSync(path.join(wb, '.run-allow'), runAllow);
  return root; // cwd to pass to the hook
}

// ---- non-Bash + benign ----
check('non-Bash tool is allowed', () => assert(isAllow(run('whatever', { tool: 'Read' }))));
check('empty command allowed', () => assert(isAllow(run('   '))));
check('plain ls allowed', () => assert(isAllow(run('ls -la'))));
check('git status allowed', () => assert(isAllow(run('git status'))));
check('git diff allowed', () => assert(isAllow(run('git diff HEAD'))));

// ---- always-banned (no marker can rescue) ----
const allMarkers = mkWorkbench({ '.allow-commit': true, '.allow-push': true });
check('rm -rf denied even with all markers', () => assert(isDeny(run('rm -rf /tmp/x', { cwd: allMarkers }))));
check('rm -fr denied', () => assert(isDeny(run('rm -fr build', { cwd: allMarkers }))));
check('process kill denied', () => assert(isDeny(run('killall node', { cwd: allMarkers }))));
check('Remove-Item -Recurse -Force denied', () => assert(isDeny(run('Remove-Item -Recurse -Force .\\dist', { cwd: allMarkers }))));

// ---- git push ----
check('git push denied without marker', () => assert(isDeny(run('git push origin bugfix/X'))));
const pushOk = mkWorkbench({ '.allow-push': true });
check('git push allowed with .allow-push', () => assert(isAllow(run('git push origin bugfix/X', { cwd: pushOk }))));
check('git -C path push denied without marker', () => assert(isDeny(run('git -C repo push'))));

// ---- git commit / history ----
check('git commit denied without marker', () => assert(isDeny(run('git commit -m "fix"'))));
const commitOk = mkWorkbench({ '.allow-commit': true });
check('git commit allowed with .allow-commit', () => assert(isAllow(run('git commit -m "fix"', { cwd: commitOk }))));
check('git reset --hard denied without marker', () => assert(isDeny(run('git reset --hard HEAD~1'))));
check('git rebase denied without marker', () => assert(isDeny(run('git rebase -i HEAD~2'))));
check('--no-verify denied', () => assert(isDeny(run('git commit -m x --no-verify', { cwd: commitOk }) && run('git commit -m x --no-verify'))));
check('git clean denied without marker', () => assert(isDeny(run('git clean -fdx'))));
check('commit allowed but push still denied with only .allow-commit', () => {
  assert(isAllow(run('git commit -m x', { cwd: commitOk })));
  assert(isDeny(run('git push', { cwd: commitOk })));
});

// ---- chained commands ----
check('chained benign && git push denied', () => assert(isDeny(run('echo hi && git push origin x'))));

// ---- dev server / run-allow ----
check('spring-boot:run denied without run-allow', () => assert(isDeny(run('mvn spring-boot:run'))));
const runOk = mkWorkbench({}, 'mvn -q verify*\n*spring-boot:run*\ndocker compose up *\n');
check('spring-boot:run allowed when on run-allow', () => assert(isAllow(run('mvn spring-boot:run -pl app', { cwd: runOk }))));
check('npm start denied without run-allow', () => assert(isDeny(run('npm start'))));
check('docker compose up (foreground) denied without run-allow', () => assert(isDeny(run('docker compose up'))));
check('docker compose up -d allowed (detached, not a dev server)', () => assert(isAllow(run('docker compose up -d db'))));
check('mvn verify allowed (not a dev server)', () => assert(isAllow(run('mvn -q verify -pl export', { cwd: runOk }))));
check('vite build allowed (not dev server)', () => assert(isAllow(run('npx vite build'))));

if (failed) {
  console.error('FAILED');
  process.exit(1);
}
console.log('OK');
