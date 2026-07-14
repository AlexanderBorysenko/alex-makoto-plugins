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

// Worktree detection without spawning git: in a linked worktree, .git is a
// FILE containing "gitdir: <main>/.git/worktrees/<name>".
function mainRootIfWorktree() {
  try {
    const dotGit = path.join(cwd, '.git');
    if (!fs.statSync(dotGit).isFile()) return null;
    const m = fs.readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m);
    if (!m) return null;
    const gitDir = path.resolve(cwd, m[1].trim()); // <main>/.git/worktrees/<name>
    return path.dirname(path.dirname(path.dirname(gitDir)));
  } catch {
    return null;
  }
}

const mainRoot = mainRootIfWorktree();
const atMain = (...p) => mainRoot && fs.existsSync(path.join(mainRoot, ...p));

const graphify = has('graphify-out', 'graph.json');
const serena = has('.serena', 'project.yml');
const serenaAtRoot = !serena && atMain('.serena', 'project.yml');
const research = has('.claude-memory', 'research');
const execMem = has('.claude-memory', 'executions');

const parity = [
  `graphify ${graphify ? '✓' : atMain('graphify-out', 'graph.json') ? 'copy from main root' : '✗'}`,
  `serena ${serena ? '✓' : serenaAtRoot ? '✓ at main root (activate_project there, never onboard here)' : '✗'}`,
  'grep=non-code/fresh-files only',
].join(' | ');

const routes = [];
routes.push('explain/why/how → build a goggles map (arch-map/flow-trace or product-map/journey-trace), give ?path= link — never prose-only');
if (graphify) routes.push('codebase Q → graphify query/explain/path');
if (serena || serenaAtRoot) routes.push('symbols/refs → serena');
routes.push(`find/investigate → /research${research ? '' : ' (store missing)'} first, before raw grep/web`);
routes.push(`run/test → /execute${execMem ? '' : ' (mem missing)'}`);

process.stdout.write(
  `[routing pulse] ${parity}. ${routes.join('; ')}. Pick best tool, not most habitual.\n`
);
