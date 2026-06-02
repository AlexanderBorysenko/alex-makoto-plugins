const { execFileSync } = require('child_process');
const path = require('path');
const assert = require('assert');

const script = path.join(__dirname, '..', 'hooks', 'session-start-reminder.js');

const out = execFileSync('node', [script], { encoding: 'utf8' });

assert.ok(
  out.includes('Memory system plugin active'),
  `expected reminder banner, got: ${out}`
);
assert.ok(
  out.includes('.claude-memory/'),
  `expected reference to .claude-memory/, got: ${out}`
);
assert.ok(
  out.includes('architecture_cache.md'),
  `expected reference to architecture_cache.md, got: ${out}`
);
assert.ok(
  out.includes('mem-index.js tasks'),
  `expected reference to mem-index.js tasks, got: ${out}`
);
assert.ok(
  out.includes('tasks/<slug>.md'),
  `expected reference to per-task journal path, got: ${out}`
);
assert.ok(
  out.includes('current state only'),
  `expected "current state only" framing, got: ${out}`
);
assert.ok(
  out.includes('offer once to initialize'),
  `expected init-offer language, got: ${out}`
);
// Index-first, lazy-match: must instruct NOT to auto-load a task journal.
assert.ok(
  /do not read any task journal yet/i.test(out),
  `expected lazy-load instruction (no eager journal read), got: ${out}`
);
assert.ok(
  out.includes('index of open tasks'),
  `expected "index of open tasks" framing, got: ${out}`
);
// Must NOT carry the old eager "identify the active task and read its journal" framing.
assert.ok(
  !/identify the active task/i.test(out),
  `reminder must not instruct identifying an active task to load, got: ${out}`
);

console.log('OK');
