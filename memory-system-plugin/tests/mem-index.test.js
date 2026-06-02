const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const script = path.join(__dirname, '..', 'bin', 'mem-index.js');

// ---- Set up fixture ----
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-index-test-'));
const tasksDir = path.join(fixture, 'tasks');
const archDir = path.join(fixture, 'arch');
const findingsDir = path.join(fixture, 'findings');
fs.mkdirSync(tasksDir, { recursive: true });
fs.mkdirSync(archDir, { recursive: true });
fs.mkdirSync(findingsDir, { recursive: true });

// foo: legacy `active` status — must normalize to Open.
fs.writeFileSync(
  path.join(tasksDir, 'foo.md'),
  `---
title: Foo Task
slug: foo
status: active
updated: 2026-05-10
summary: Working on foo
topics: [auth, refactor]
---

Body of foo.
`
);

// bar: native `open` status.
fs.writeFileSync(
  path.join(tasksDir, 'bar.md'),
  `---
title: Bar Task
slug: bar
status: open
updated: 2026-05-09
summary: Bar work in progress
topics: []
---

Body of bar.
`
);

// qux: legacy `paused` status — must normalize to Open.
fs.writeFileSync(
  path.join(tasksDir, 'qux.md'),
  `---
title: Qux Task
slug: qux
status: paused
updated: 2026-05-08
summary: Qux shelved earlier
topics: []
---

Body of qux.
`
);

fs.writeFileSync(
  path.join(tasksDir, 'baz.md'),
  `---
title: Baz Task
slug: baz
status: done
updated: 2026-05-01
summary: Baz complete
---

Body of baz.
`
);

// invalid status — must be skipped with a warning.
fs.writeFileSync(
  path.join(tasksDir, 'wat.md'),
  `---
title: Wat Task
slug: wat
status: bogus
updated: 2026-05-02
summary: Invalid status
---

Body of wat.
`
);

fs.writeFileSync(
  path.join(tasksDir, 'bad.md'),
  `Just plain text. No frontmatter at all.
Should be skipped with a warning.
`
);

fs.writeFileSync(
  path.join(archDir, 'api.md'),
  `---
component: api
responsibility: HTTP request handling
---

API body.
`
);

fs.writeFileSync(
  path.join(archDir, 'db.md'),
  `---
component: db
responsibility: Database access layer
---

DB body.
`
);

fs.writeFileSync(
  path.join(findingsDir, 'timezone-bug.md'),
  `---
topic: timezone-bug
summary: All scrapers must explicitly set TZ
updated: 2026-04-15
---

Long writeup of the bug.
`
);

// ---- Helper ----
function run(args, opts = {}) {
  const res = spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    ...opts,
  });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

let failed = false;
try {
  // ---- Test: tasks markdown ----
  {
    const r = run(['tasks', '--base', fixture]);
    assert.strictEqual(r.status, 0, `tasks exit 0, got ${r.status}; stderr: ${r.stderr}`);
    assert.ok(r.stdout.includes('## Open'), `expected ## Open section: ${r.stdout}`);
    assert.ok(r.stdout.includes('## Done'), `expected ## Done section: ${r.stdout}`);
    assert.ok(!r.stdout.includes('## Active'), `no ## Active section expected: ${r.stdout}`);
    assert.ok(!r.stdout.includes('## Paused'), `no ## Paused section expected: ${r.stdout}`);
    assert.ok(r.stdout.includes('Foo Task'), `expected Foo Task: ${r.stdout}`);
    assert.ok(r.stdout.includes('Bar Task'), `expected Bar Task: ${r.stdout}`);
    assert.ok(r.stdout.includes('Qux Task'), `expected Qux Task: ${r.stdout}`);
    assert.ok(r.stdout.includes('Baz Task'), `expected Baz Task: ${r.stdout}`);

    // Section placement: legacy active (foo), native open (bar), legacy paused (qux)
    // all under Open; done (baz) under Done.
    const openIdx = r.stdout.indexOf('## Open');
    const doneIdx = r.stdout.indexOf('## Done');
    const fooIdx = r.stdout.indexOf('Foo Task');
    const barIdx = r.stdout.indexOf('Bar Task');
    const quxIdx = r.stdout.indexOf('Qux Task');
    const bazIdx = r.stdout.indexOf('Baz Task');
    assert.ok(openIdx < fooIdx && fooIdx < doneIdx, 'Foo (legacy active) must be under Open');
    assert.ok(openIdx < barIdx && barIdx < doneIdx, 'Bar (native open) must be under Open');
    assert.ok(openIdx < quxIdx && quxIdx < doneIdx, 'Qux (legacy paused) must be under Open');
    assert.ok(doneIdx < bazIdx, 'Baz must be under Done');

    // Open sorted by updated desc: foo (05-10) before bar (05-09) before qux (05-08).
    assert.ok(fooIdx < barIdx && barIdx < quxIdx, 'Open sorted most-recently-updated first');

    // Invalid status skipped with a warning; bad (no frontmatter) too.
    assert.ok(!r.stdout.includes('Wat Task'), `wat (invalid status) must be skipped: ${r.stdout}`);
    assert.ok(
      r.stderr.includes('wat.md') && /invalid status/i.test(r.stderr),
      `expected warning about wat.md invalid status, got stderr: ${r.stderr}`
    );
    assert.ok(
      r.stderr.includes('bad.md') && /no frontmatter/i.test(r.stderr),
      `expected warning about bad.md, got stderr: ${r.stderr}`
    );
  }

  // ---- Test: tasks JSON ----
  {
    const r = run(['tasks', '--json', '--base', fixture]);
    assert.strictEqual(r.status, 0, `tasks --json exit 0, got ${r.status}`);
    const obj = JSON.parse(r.stdout);
    assert.ok(Array.isArray(obj.open), 'open array');
    assert.ok(Array.isArray(obj.done), 'done array');
    assert.strictEqual(obj.active, undefined, 'no active key');
    assert.strictEqual(obj.paused, undefined, 'no paused key');
    assert.strictEqual(obj.open.length, 3, `open length 3, got ${obj.open.length}`);
    assert.strictEqual(obj.done.length, 1, `done length 1, got ${obj.done.length}`);
    // Sorted most-recently-updated first.
    assert.strictEqual(obj.open[0].slug, 'foo');
    assert.strictEqual(obj.open[0].status, 'open', 'legacy active normalized to open in JSON');
    assert.deepStrictEqual(obj.open[0].topics, ['auth', 'refactor']);
    assert.strictEqual(obj.open[0].file, 'tasks/foo.md');
    // Legacy paused also normalized.
    const qux = obj.open.find((t) => t.slug === 'qux');
    assert.ok(qux && qux.status === 'open', 'legacy paused normalized to open in JSON');
  }

  // ---- Test: arch markdown ----
  {
    const r = run(['arch', '--base', fixture]);
    assert.strictEqual(r.status, 0, `arch exit 0, got ${r.status}`);
    assert.ok(r.stdout.includes('# Components'), `expected # Components: ${r.stdout}`);
    assert.ok(r.stdout.includes('| api |'), `expected api row: ${r.stdout}`);
    assert.ok(r.stdout.includes('| db |'), `expected db row: ${r.stdout}`);
    assert.ok(r.stdout.includes('HTTP request handling'), `expected api resp: ${r.stdout}`);
    assert.ok(r.stdout.includes('Database access layer'), `expected db resp: ${r.stdout}`);
    // Sorted by component ascending: api before db
    assert.ok(r.stdout.indexOf('| api |') < r.stdout.indexOf('| db |'), 'api before db');
  }

  // ---- Test: arch JSON ----
  {
    const r = run(['arch', '--json', '--base', fixture]);
    assert.strictEqual(r.status, 0);
    const arr = JSON.parse(r.stdout);
    assert.ok(Array.isArray(arr));
    assert.strictEqual(arr.length, 2);
    assert.strictEqual(arr[0].component, 'api');
    assert.strictEqual(arr[0].file, 'arch/api.md');
  }

  // ---- Test: findings markdown ----
  {
    const r = run(['findings', '--base', fixture]);
    assert.strictEqual(r.status, 0, `findings exit 0, got ${r.status}`);
    assert.ok(r.stdout.includes('# Findings'), `expected # Findings`);
    assert.ok(r.stdout.includes('timezone-bug'), `expected timezone-bug: ${r.stdout}`);
    assert.ok(
      r.stdout.includes('All scrapers must explicitly set TZ'),
      `expected summary: ${r.stdout}`
    );
    assert.ok(
      r.stdout.includes('findings/timezone-bug.md'),
      `expected link: ${r.stdout}`
    );
  }

  // ---- Test: all markdown ----
  {
    const r = run(['all', '--base', fixture]);
    assert.strictEqual(r.status, 0, `all exit 0, got ${r.status}`);
    assert.ok(r.stdout.includes('# Tasks'), `expected # Tasks`);
    assert.ok(r.stdout.includes('# Components'), `expected # Components`);
    assert.ok(r.stdout.includes('# Findings'), `expected # Findings`);
    // Order
    assert.ok(
      r.stdout.indexOf('# Tasks') <
        r.stdout.indexOf('# Components') &&
        r.stdout.indexOf('# Components') < r.stdout.indexOf('# Findings'),
      'all sections in order tasks, arch, findings'
    );
  }

  // ---- Test: all JSON ----
  {
    const r = run(['all', '--json', '--base', fixture]);
    assert.strictEqual(r.status, 0);
    const obj = JSON.parse(r.stdout);
    assert.ok(obj.tasks && obj.arch && obj.findings, 'all keys present');
    assert.strictEqual(obj.tasks.open.length, 3);
    assert.strictEqual(obj.tasks.done.length, 1);
    assert.strictEqual(obj.arch.length, 2);
    assert.strictEqual(obj.findings.length, 1);
  }

  // ---- Test: missing dir => (none) and exit 0 ----
  {
    // Remove findings dir
    fs.rmSync(findingsDir, { recursive: true, force: true });
    const r = run(['findings', '--base', fixture]);
    assert.strictEqual(r.status, 0, `findings on missing dir exit 0, got ${r.status}`);
    assert.ok(/\(none\)/.test(r.stdout), `expected (none) placeholder: ${r.stdout}`);
  }

  // ---- Test: invalid subcommand exits 2 ----
  {
    const r = run(['bogus', '--base', fixture]);
    assert.strictEqual(r.status, 2, `bogus exit 2, got ${r.status}`);
  }

  // ---- Test: completely missing base => still ok ----
  {
    const ghost = path.join(os.tmpdir(), 'mem-index-ghost-' + Date.now());
    const r = run(['all', '--base', ghost]);
    assert.strictEqual(r.status, 0, `missing base exit 0, got ${r.status}`);
    assert.ok(/\(no tasks\)|\(none\)/.test(r.stdout), `expected placeholders: ${r.stdout}`);
  }
} catch (err) {
  failed = true;
  console.error(err.stack || err.message);
} finally {
  // ---- Cleanup ----
  try {
    fs.rmSync(fixture, { recursive: true, force: true });
  } catch (_) {}
}

if (failed) {
  process.exit(1);
}
console.log('OK');
