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
