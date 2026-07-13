#!/usr/bin/env node

// Freshness assessment for researcher-managed tooling.
// Module: assess(root) -> { graphify, serena, store }
// CLI:    node freshness.js [projectRoot]  -> prints one status line per tool.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function git(args, cwd) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function mainRootIfWorktree(root) {
  const gitDir = git(['rev-parse', '--git-dir'], root);
  const commonDir = git(['rev-parse', '--git-common-dir'], root);
  if (!gitDir || !commonDir) return null;
  const abs = (p) => path.resolve(root, p);
  if (abs(gitDir) === abs(commonDir)) return null;
  return path.dirname(abs(commonDir));
}

function assessGraphify(root) {
  const graphJson = path.join(root, 'graphify-out', 'graph.json');
  if (!fs.existsSync(graphJson)) {
    const mainRoot = mainRootIfWorktree(root);
    if (mainRoot && fs.existsSync(path.join(mainRoot, 'graphify-out', 'graph.json'))) {
      return { status: 'missing-copyable', mainRoot };
    }
    return { status: 'missing' };
  }
  const markerPath = path.join(root, 'graphify-out', '.researcher-head');
  if (!fs.existsSync(markerPath)) return { status: 'unbaselined' };
  const marker = fs.readFileSync(markerPath, 'utf8').trim();
  const diff = git(['diff', '--name-only', `${marker}..HEAD`], root);
  if (diff === null) return { status: 'unbaselined' };
  const changed = diff === '' ? 0 : diff.split('\n').length;
  return changed === 0 ? { status: 'ready' } : { status: 'stale', changed };
}

function assessSerena(root) {
  if (!fs.existsSync(path.join(root, '.serena', 'project.yml'))) {
    const mainRoot = mainRootIfWorktree(root);
    if (mainRoot && fs.existsSync(path.join(mainRoot, '.serena', 'project.yml'))) {
      return { status: 'main-root', mainRoot };
    }
    return { status: 'missing' };
  }
  const memories = path.join(root, '.serena', 'memories');
  const onboarded =
    fs.existsSync(memories) && fs.readdirSync(memories).some((f) => !f.startsWith('.'));
  return { status: onboarded ? 'ready' : 'not-onboarded' };
}

// Canonical store: .claude-memory/research (shared plugin hub, one gitignore).
// Legacy fallback: .claude-research (pre-0.4 layout) — read if it exists and the
// canonical path does not.
function storeRoot(root) {
  const canonical = path.join(root, '.claude-memory', 'research');
  if (fs.existsSync(canonical)) return canonical;
  const legacy = path.join(root, '.claude-research');
  if (fs.existsSync(legacy)) return legacy;
  return canonical;
}

function assessStore(root) {
  const store = storeRoot(root);
  if (!fs.existsSync(store)) return { status: 'missing', findings: 0, project: '' };
  let findings = 0;
  let project = '';
  const indexPath = path.join(store, 'INDEX.md');
  if (fs.existsSync(indexPath)) {
    findings = fs
      .readFileSync(indexPath, 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('- ')).length;
  }
  const configPath = path.join(store, 'config.md');
  if (fs.existsSync(configPath)) {
    const m = fs.readFileSync(configPath, 'utf8').match(/^project:\s*(.+)$/m);
    if (m) project = m[1].trim();
  }
  return { status: 'ready', findings, project };
}

function assess(root) {
  return {
    graphify: assessGraphify(root),
    serena: assessSerena(root),
    store: assessStore(root),
  };
}

function formatLines({ graphify, serena, store }) {
  const lines = [];
  switch (graphify.status) {
    case 'ready':
      lines.push('graphify: ready');
      break;
    case 'stale':
      lines.push(`graphify: stale (${graphify.changed} files changed)`);
      break;
    case 'unbaselined':
      lines.push('graphify: unbaselined (graph exists, no freshness marker)');
      break;
    case 'missing-copyable':
      lines.push(`graphify: missing — copyable from ${graphify.mainRoot}`);
      break;
    default:
      lines.push('graphify: missing');
  }
  lines.push(
    serena.status === 'ready'
      ? 'serena: ready'
      : serena.status === 'not-onboarded'
        ? 'serena: not onboarded'
        : serena.status === 'main-root'
          ? `serena: index at main repo ${serena.mainRoot} — activate_project there; NEVER onboard from scratch inside a worktree`
          : 'serena: missing'
  );
  lines.push(
    store.status === 'ready'
      ? `research store: ready${store.project ? ` (${store.project})` : ''} — ${store.findings} findings indexed`
      : 'research store: missing'
  );
  return lines;
}

module.exports = { assess, formatLines };

if (require.main === module) {
  const root = path.resolve(process.argv[2] || process.cwd());
  process.stdout.write(formatLines(assess(root)).join('\n') + '\n');
}
