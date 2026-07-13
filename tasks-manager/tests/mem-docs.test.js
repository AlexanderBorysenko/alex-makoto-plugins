const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const script = path.join(__dirname, '..', 'bin', 'mem-index.js');

function run(args, cwd) {
  return execFileSync('node', [script, ...args], { encoding: 'utf8', cwd });
}

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-docs-test-'));
  fs.mkdirSync(path.join(root, '.claude-memory'), { recursive: true });
  return root;
}

function writeRegistry(root, sources) {
  fs.writeFileSync(
    path.join(root, '.claude-memory', 'sources.json'),
    JSON.stringify({ sources }, null, 2)
  );
}

const REGISTRY = [
  { name: 'research-findings', root: '.claude-memory/research/findings', match: '\\.md$' },
  { name: 'execution-reports', root: '.claude-memory/executions/reports', match: 'report\\.md$' },
  { name: 'superpowers-specs', root: 'docs/superpowers/specs', match: '\\.md$' },
];

// Case 1: no registry — friendly message, exit 0
{
  const root = makeProject();
  const out = run(['docs', '--base', path.join(root, '.claude-memory')], root);
  assert.ok(out.includes('no sources.json'), `missing registry message: ${out}`);
}

// Case 2: registry with docs across sources — grouped output, frontmatter title/date, fallbacks
{
  const root = makeProject();
  writeRegistry(root, REGISTRY);

  const fDir = path.join(root, '.claude-memory/research', 'findings');
  fs.mkdirSync(fDir, { recursive: true });
  fs.writeFileSync(
    path.join(fDir, 'auth-flow.md'),
    '---\ntitle: Auth flow\ndate: 2026-07-10\nlevel: L2\ntask-slug: fix-login\n---\n\nBody.\n'
  );

  const rDir = path.join(root, '.claude-memory', 'executions', 'reports', '2026-07-11-login-repro');
  fs.mkdirSync(rDir, { recursive: true });
  fs.writeFileSync(
    path.join(rDir, 'report.md'),
    '---\nverdict: reproduced\ntask: Login repro\nfinished: 2026-07-11T10:00:00Z\ntask-slug: fix-login\n---\n\n# Login repro\n'
  );
  // extra artifact file in report dir must NOT match (match is report\.md$)
  fs.writeFileSync(path.join(rDir, 'notes.md'), 'scratch');

  const sDir = path.join(root, 'docs', 'superpowers', 'specs');
  fs.mkdirSync(sDir, { recursive: true });
  // no frontmatter — title falls back to first heading, date to mtime
  fs.writeFileSync(path.join(sDir, '2026-07-12-widget-design.md'), '# Widget design\n\nText.\n');

  const out = run(['docs', '--base', path.join(root, '.claude-memory')], root);
  assert.ok(out.includes('## research-findings'), `group header: ${out}`);
  assert.ok(out.includes('[Auth flow](.claude-memory/research/findings/auth-flow.md)'), `finding line: ${out}`);
  assert.ok(out.includes('2026-07-10'), `finding date: ${out}`);
  assert.ok(out.includes('task:fix-login'), `task tag: ${out}`);
  assert.ok(out.includes('## execution-reports'), `reports group: ${out}`);
  assert.ok(out.includes('[Login repro]'), `report title from task field: ${out}`);
  assert.ok(out.includes('2026-07-11'), `report date from finished: ${out}`);
  assert.ok(!out.includes('notes.md'), `non-matching file leaked: ${out}`);
  assert.ok(out.includes('## superpowers-specs'), `specs group: ${out}`);
  assert.ok(out.includes('[Widget design]'), `heading-fallback title: ${out}`);
}

// Case 3: --task filter — only entries stamped with that slug
{
  const root = makeProject();
  writeRegistry(root, REGISTRY);
  const fDir = path.join(root, '.claude-memory/research', 'findings');
  fs.mkdirSync(fDir, { recursive: true });
  fs.writeFileSync(
    path.join(fDir, 'tagged.md'),
    '---\ntitle: Tagged\ndate: 2026-07-10\ntask-slug: fix-login\n---\n'
  );
  fs.writeFileSync(
    path.join(fDir, 'other.md'),
    '---\ntitle: Other\ndate: 2026-07-10\ntask-slug: another-task\n---\n'
  );
  fs.writeFileSync(path.join(fDir, 'untagged.md'), '---\ntitle: Untagged\ndate: 2026-07-10\n---\n');
  const out = run(['docs', '--task', 'fix-login', '--base', path.join(root, '.claude-memory')], root);
  assert.ok(out.includes('[Tagged]'), `tagged included: ${out}`);
  assert.ok(!out.includes('[Other]'), `other slug excluded: ${out}`);
  assert.ok(!out.includes('[Untagged]'), `untagged excluded under --task: ${out}`);
}

// Case 4: registered root missing on disk — skipped silently, others still listed
{
  const root = makeProject();
  writeRegistry(root, REGISTRY);
  const sDir = path.join(root, 'docs', 'superpowers', 'specs');
  fs.mkdirSync(sDir, { recursive: true });
  fs.writeFileSync(path.join(sDir, 'a-design.md'), '# A design\n');
  const out = run(['docs', '--base', path.join(root, '.claude-memory')], root);
  assert.ok(out.includes('[A design]'), `existing source listed: ${out}`);
  assert.ok(!out.includes('research-findings'), `empty/missing sources omitted: ${out}`);
}

// Case 5: --json shape
{
  const root = makeProject();
  writeRegistry(root, [REGISTRY[0]]);
  const fDir = path.join(root, '.claude-memory/research', 'findings');
  fs.mkdirSync(fDir, { recursive: true });
  fs.writeFileSync(
    path.join(fDir, 'x.md'),
    '---\ntitle: X\ndate: 2026-07-01\ntask-slug: t1\n---\n'
  );
  const out = run(['docs', '--json', '--base', path.join(root, '.claude-memory')], root);
  const j = JSON.parse(out);
  assert.ok(Array.isArray(j['research-findings']), `json group array: ${out}`);
  assert.strictEqual(j['research-findings'][0].title, 'X');
  assert.strictEqual(j['research-findings'][0].task, 't1');
  assert.strictEqual(j['research-findings'][0].file, '.claude-memory/research/findings/x.md');
}

console.log('mem-docs.test.js: all assertions passed');
