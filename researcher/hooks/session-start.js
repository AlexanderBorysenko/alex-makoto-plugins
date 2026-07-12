#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const cwd = process.cwd();
const lines = [];
const missing = [];

const graphifyReady = fs.existsSync(path.join(cwd, 'graphify-out', 'graph.json'));
lines.push(`graphify: ${graphifyReady ? 'ready' : 'missing'}`);
if (!graphifyReady) missing.push('graphify index');

const serenaReady = fs.existsSync(path.join(cwd, '.serena', 'project.yml'));
lines.push(`serena: ${serenaReady ? 'ready' : 'missing'}`);
if (!serenaReady) missing.push('serena project');

const store = path.join(cwd, '.claude-research');
if (fs.existsSync(store)) {
  let count = 0;
  let project = '';
  const indexPath = path.join(store, 'INDEX.md');
  if (fs.existsSync(indexPath)) {
    count = fs
      .readFileSync(indexPath, 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('- ')).length;
  }
  const configPath = path.join(store, 'config.md');
  if (fs.existsSync(configPath)) {
    const m = fs.readFileSync(configPath, 'utf8').match(/^project:\s*(.+)$/m);
    if (m) project = m[1].trim();
  }
  lines.push(
    `research store: ready${project ? ` (${project})` : ''} — ${count} findings indexed`
  );
} else {
  lines.push('research store: missing');
  missing.push('research store');
}

let out = `Researcher plugin active.\n${lines.join('\n')}`;
if (missing.length) {
  out += `\nMissing: ${missing.join(', ')} — offer /research-setup once this session; do not nag again.`;
} else {
  out += `\nFor investigation/lookup questions invoke the researcher skill (/research): triage L1/L2/L3, route tools deterministically, ground every claim with evidence.`;
}
process.stdout.write(out + '\n');
