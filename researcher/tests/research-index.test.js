const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const script = path.join(__dirname, '..', 'bin', 'research-index.js');

function sh(cmd, args, cwd) {
  return execFileSync(cmd, args, { encoding: 'utf8', cwd });
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-index-test-'));
  sh('git', ['init', '-q'], dir);
  sh('git', ['config', 'user.email', 'test@test'], dir);
  sh('git', ['config', 'user.name', 'test'], dir);
  return dir;
}

function writeFinding(dir, slug, fm) {
  const findingsDir = path.join(dir, '.claude-research', 'findings');
  fs.mkdirSync(findingsDir, { recursive: true });
  fs.writeFileSync(path.join(findingsDir, `${slug}.md`), fm);
}

// Case 1: fresh finding — evidence files untouched since recorded head → no STALE?
{
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'auth.js'), 'x');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c1'], dir);
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  writeFinding(
    dir,
    'auth-flow',
    `---\ntitle: Auth flow\ndate: 2026-07-12\nlevel: L2\nhead: ${head}\nfiles:\n  - auth.js\n---\n\nBody.\n`
  );
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('- [Auth flow](findings/auth-flow.md) — L2 — 2026-07-12'), `line: ${out}`);
  assert.ok(!out.includes('STALE?'), `unexpected stale: ${out}`);
}

// Case 2: evidence file changed after head → STALE? prefix
{
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'auth.js'), 'x');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c1'], dir);
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  writeFinding(
    dir,
    'auth-flow',
    `---\ntitle: Auth flow\ndate: 2026-07-12\nlevel: L2\nhead: ${head}\nfiles:\n  - auth.js\n---\n\nBody.\n`
  );
  fs.writeFileSync(path.join(dir, 'auth.js'), 'changed');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c2'], dir);
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('STALE? - [Auth flow](findings/auth-flow.md)'), `stale expected: ${out}`);
}

// Case 3: unrelated file changed → not stale
{
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'auth.js'), 'x');
  fs.writeFileSync(path.join(dir, 'other.js'), 'y');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c1'], dir);
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  writeFinding(
    dir,
    'auth-flow',
    `---\ntitle: Auth flow\ndate: 2026-07-12\nlevel: L2\nhead: ${head}\nfiles:\n  - auth.js\n---\n\nBody.\n`
  );
  fs.writeFileSync(path.join(dir, 'other.js'), 'changed');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c2'], dir);
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(!out.includes('STALE?'), `unexpected stale: ${out}`);
}

// Case 4: no findings dir → friendly empty message, exit 0
{
  const dir = makeRepo();
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('no findings'), `empty message: ${out}`);
}

// Case 5: non-git directory → lines print without staleness check, no crash
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'research-index-nogit-'));
  writeFinding(
    dir,
    'auth-flow',
    `---\ntitle: Auth flow\ndate: 2026-07-12\nlevel: L2\nhead: deadbeef\nfiles:\n  - auth.js\n---\n\nBody.\n`
  );
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('- [Auth flow](findings/auth-flow.md) — L2 — 2026-07-12'), `line: ${out}`);
  assert.ok(!out.includes('STALE?'), `stale without git: ${out}`);
}

// Case 6: CRLF finding — entire file uses \r\n line endings, valid frontmatter
{
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'auth.js'), 'x');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c1'], dir);
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  const crlf = `---\r\ntitle: Auth flow\r\ndate: 2026-07-12\r\nlevel: L2\r\nhead: ${head}\r\nfiles:\r\n  - auth.js\r\n---\r\n\r\nBody.\r\n`;
  writeFinding(dir, 'auth-flow', crlf);
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('- [Auth flow](findings/auth-flow.md) — L2 — 2026-07-12'), `line: ${out}`);
  assert.ok(!out.includes('unparsed frontmatter'), `unexpected unparsed: ${out}`);
}

// Case 7: backslash path in files: — matched against forward-slash git diff output → STALE?
{
  const dir = makeRepo();
  fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'sub', 'auth.js'), 'x');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c1'], dir);
  const head = sh('git', ['rev-parse', 'HEAD'], dir).trim();
  writeFinding(
    dir,
    'auth-flow',
    `---\ntitle: Auth flow\ndate: 2026-07-12\nlevel: L2\nhead: ${head}\nfiles:\n  - sub\\auth.js\n---\n\nBody.\n`
  );
  fs.writeFileSync(path.join(dir, 'sub', 'auth.js'), 'changed');
  sh('git', ['add', '.'], dir);
  sh('git', ['commit', '-qm', 'c2'], dir);
  const out = sh('node', [script, 'list', dir], dir);
  assert.ok(out.includes('STALE? - [Auth flow](findings/auth-flow.md)'), `stale expected: ${out}`);
}

console.log('research-index.test.js: all assertions passed');
