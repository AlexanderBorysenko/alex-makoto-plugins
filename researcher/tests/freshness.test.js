const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const script = path.join(__dirname, '..', 'bin', 'freshness.js');

function sh(cmd, args, cwd) {
  return execFileSync(cmd, args, { encoding: 'utf8', cwd });
}

function run(root) {
  return sh('node', [script, root], root);
}

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeRepo() {
  const dir = tmpDir('freshness-test-');
  sh('git', ['init', '-q'], dir);
  sh('git', ['config', 'user.email', 'test@test'], dir);
  sh('git', ['config', 'user.name', 'test'], dir);
  return dir;
}

function commitFile(dir, name, content, msg) {
  fs.writeFileSync(path.join(dir, name), content);
  sh('git', ['add', name], dir);
  sh('git', ['commit', '-qm', msg], dir);
  return sh('git', ['rev-parse', 'HEAD'], dir).trim();
}

function makeGraph(dir) {
  fs.mkdirSync(path.join(dir, 'graphify-out'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'graphify-out', 'graph.json'), '{}');
}

function makeSerena(dir, onboarded) {
  fs.mkdirSync(path.join(dir, '.serena'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.serena', 'project.yml'), 'name: demo\n');
  if (onboarded) {
    fs.mkdirSync(path.join(dir, '.serena', 'memories'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.serena', 'memories', 'overview.md'), 'x');
  }
}

// Case 1: empty non-git dir — everything missing
{
  const dir = tmpDir('freshness-empty-');
  const out = run(dir);
  assert.ok(out.includes('graphify: missing'), `graphify: ${out}`);
  assert.ok(!out.includes('copyable'), `no copyable in plain dir: ${out}`);
  assert.ok(out.includes('serena: missing'), `serena: ${out}`);
}

// Case 2: ready — graph + marker at HEAD, serena onboarded
{
  const dir = makeRepo();
  const head = commitFile(dir, 'a.js', 'x', 'c1');
  makeGraph(dir);
  fs.writeFileSync(path.join(dir, 'graphify-out', '.researcher-head'), head + '\n');
  makeSerena(dir, true);
  const out = run(dir);
  assert.ok(out.includes('graphify: ready'), `graphify: ${out}`);
  assert.ok(out.includes('serena: ready'), `serena: ${out}`);
}

// Case 3: stale — commits after marker
{
  const dir = makeRepo();
  const head = commitFile(dir, 'a.js', 'x', 'c1');
  makeGraph(dir);
  fs.writeFileSync(path.join(dir, 'graphify-out', '.researcher-head'), head + '\n');
  commitFile(dir, 'b.js', 'y', 'c2');
  commitFile(dir, 'c.js', 'z', 'c3');
  const out = run(dir);
  assert.ok(out.includes('graphify: stale (2 files changed)'), `stale: ${out}`);
}

// Case 4: unbaselined — graph exists, no marker
{
  const dir = makeRepo();
  commitFile(dir, 'a.js', 'x', 'c1');
  makeGraph(dir);
  const out = run(dir);
  assert.ok(out.includes('graphify: unbaselined'), `unbaselined: ${out}`);
}

// Case 5: unbaselined — marker points at unknown sha (e.g. history rewritten)
{
  const dir = makeRepo();
  commitFile(dir, 'a.js', 'x', 'c1');
  makeGraph(dir);
  fs.writeFileSync(path.join(dir, 'graphify-out', '.researcher-head'), 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef\n');
  const out = run(dir);
  assert.ok(out.includes('graphify: unbaselined'), `bad sha -> unbaselined: ${out}`);
}

// Case 6: worktree with missing graph but main root has one — copyable
{
  const main = makeRepo();
  commitFile(main, 'a.js', 'x', 'c1');
  makeGraph(main);
  const wt = path.join(tmpDir('freshness-wt-'), 'wt');
  sh('git', ['worktree', 'add', '-q', wt, '-b', 'wt-branch'], main);
  const out = run(wt);
  assert.ok(/graphify: missing — copyable from .+/.test(out), `copyable: ${out}`);
}

// Case 7: serena present but not onboarded (no memories)
{
  const dir = tmpDir('freshness-serena-');
  makeSerena(dir, false);
  const out = run(dir);
  assert.ok(out.includes('serena: not onboarded'), `serena: ${out}`);
}

console.log('freshness.test.js: all assertions passed');
