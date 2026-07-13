#!/usr/bin/env node
// UserPromptSubmit hook: one compact tool-parity line injected EVERY turn.
//
// Why: SessionStart routing rules decay over long sessions (compaction,
// attention distance) and the agent drifts back to native grep/Read even
// when graphify/serena/researcher are available. Native tools live in the
// tool schema permanently; plugin tools exist only as prose in context —
// this pulse keeps them at equal salience each turn, deterministically.
//
// Must stay cheap: a few fs.existsSync calls, ~50 tokens of output.

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const has = (...p) => fs.existsSync(path.join(cwd, ...p));

const graphify = has('graphify-out', 'graph.json');
const serena = has('.serena', 'project.yml');
const research = has('.claude-memory', 'research');
const execMem = has('.claude-memory', 'executions');

const parity = [
  `graphify ${graphify ? '✓' : '✗'}`,
  `serena ${serena ? '✓' : '✗'}`,
  'grep=non-code/fresh-files only',
].join(' | ');

const routes = [];
if (graphify) routes.push('codebase Q → graphify query/explain/path');
if (serena) routes.push('symbols/refs → serena');
routes.push(`investigate → /research${research ? '' : ' (store missing)'}`);
routes.push(`run/test → /execute${execMem ? '' : ' (mem missing)'}`);

process.stdout.write(
  `[routing pulse] ${parity}. ${routes.join('; ')}. Pick best tool, not most habitual.\n`
);
