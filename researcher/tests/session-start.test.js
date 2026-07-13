const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const script = path.join(__dirname, '..', 'hooks', 'session-start.js');

function run(cwd) {
  return execFileSync('node', [script], { encoding: 'utf8', cwd });
}

function sh(cmd, args, cwd) {
  return execFileSync(cmd, args, { encoding: 'utf8', cwd });
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'researcher-test-'));
}

function makeRepo() {
  const dir = tmpDir();
  sh('git', ['init', '-q'], dir);
  sh('git', ['config', 'user.email', 'test@test'], dir);
  sh('git', ['config', 'user.name', 'test'], dir);
  fs.writeFileSync(path.join(dir, 'a.js'), 'x');
  sh('git', ['add', 'a.js'], dir);
  sh('git', ['commit', '-qm', 'c1'], dir);
  return dir;
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
  assert.ok(!out.includes('Auto-fix'), `nothing auto-fixable in empty dir: ${out}`);
  const lineCount = out.trim().split('\n').length;
  assert.ok(lineCount <= 10, `output ${lineCount} lines, budget 10:\n${out}`);
}

// Case 2: fully set up + fresh — ready statuses, findings count, project name, no offers
{
  const dir = makeRepo();
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  fs.mkdirSync(path.join(dir, 'graphify-out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'graphify-out', 'graph.json'), '{}');
  fs.writeFileSync(path.join(dir, 'graphify-out', '.researcher-head'), head + '\n');
  fs.mkdirSync(path.join(dir, '.serena', 'memories'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.serena', 'project.yml'), 'name: demo\n');
  fs.writeFileSync(path.join(dir, '.serena', 'memories', 'overview.md'), 'x');
  fs.mkdirSync(path.join(dir, '.claude-memory/research', 'findings'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.claude-memory/research', 'INDEX.md'),
    '# Research index\n\n- [Auth flow](findings/auth-flow.md) — L2 — 2026-07-12\n- [DB triggers](findings/db-triggers.md) — L2 — 2026-07-12\n'
  );
  fs.writeFileSync(
    path.join(dir, '.claude-memory/research', 'config.md'),
    '---\nproject: Karpaty Wiki LLM\n---\n'
  );
  const out = run(dir);
  assert.ok(out.includes('graphify: ready'), `graphify status: ${out}`);
  assert.ok(out.includes('serena: ready'), `serena status: ${out}`);
  assert.ok(out.includes('research store: ready (Karpaty Wiki LLM) — 2 findings indexed'), `store line: ${out}`);
  assert.ok(!out.includes('/research-setup'), `setup offered when nothing missing: ${out}`);
  assert.ok(!out.includes('Auto-fix'), `auto-fix offered when fresh: ${out}`);
  assert.ok(out.includes('/research'), `skill pointer missing: ${out}`);
  const lineCount = out.trim().split('\n').length;
  assert.ok(lineCount <= 10, `output ${lineCount} lines, budget 10:\n${out}`);
}

// Case 3: partial — store exists but graphify missing → setup offer names missing piece only
{
  const dir = tmpDir();
  fs.mkdirSync(path.join(dir, '.claude-memory/research', 'findings'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude-memory/research', 'INDEX.md'), '# Research index\n');
  const out = run(dir);
  assert.ok(out.includes('graphify: missing'), `graphify status: ${out}`);
  assert.ok(out.includes('research store: ready'), `store status: ${out}`);
  assert.ok(out.includes('/research-setup'), `setup offer missing: ${out}`);
}

// Case 4: stale graphify + serena not onboarded → auto-fix line, free-op wording
{
  const dir = makeRepo();
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  fs.mkdirSync(path.join(dir, 'graphify-out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'graphify-out', 'graph.json'), '{}');
  fs.writeFileSync(path.join(dir, 'graphify-out', '.researcher-head'), head + '\n');
  fs.writeFileSync(path.join(dir, 'b.js'), 'y');
  sh('git', ['add', 'b.js'], dir);
  sh('git', ['commit', '-qm', 'c2'], dir);
  fs.mkdirSync(path.join(dir, '.serena'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.serena', 'project.yml'), 'name: demo\n');
  const out = run(dir);
  assert.ok(out.includes('graphify: stale (1 files changed)'), `stale status: ${out}`);
  assert.ok(out.includes('serena: not onboarded'), `serena status: ${out}`);
  assert.ok(out.includes('Auto-fix'), `auto-fix line missing: ${out}`);
  assert.ok(out.includes('graphify update'), `graphify update mention: ${out}`);
  assert.ok(out.includes('serena onboarding'), `serena onboarding mention: ${out}`);
  const lineCount = out.trim().split('\n').length;
  assert.ok(lineCount <= 10, `output ${lineCount} lines, budget 10:\n${out}`);
}

console.log('session-start.test.js: all assertions passed');
