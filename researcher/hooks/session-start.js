#!/usr/bin/env node

const { assess, formatLines } = require('../bin/freshness.js');

const cwd = process.cwd();
const result = assess(cwd);
const lines = formatLines(result);

const autofix = [];
if (result.graphify.status === 'stale' || result.graphify.status === 'unbaselined') {
  autofix.push('graphify update (AST-only, free)');
}
if (result.graphify.status === 'missing-copyable') {
  autofix.push('copy graphify-out from main repo root + graphify update');
}
if (result.serena.status === 'not-onboarded') {
  autofix.push('serena onboarding');
}

const missing = [];
if (result.graphify.status === 'missing') missing.push('graphify index');
if (result.serena.status === 'missing') missing.push('serena project');
if (result.store.status === 'missing') missing.push('research store');

let out = `Researcher plugin active.\n${lines.join('\n')}`;
if (autofix.length) {
  out += `\nAuto-fix at next /research step 0 (free ops, no approval needed): ${autofix.join('; ')}.`;
}
if (missing.length) {
  out += `\nMissing: ${missing.join(', ')} — offer /research-setup once this session; do not nag again.`;
}
if (!autofix.length && !missing.length) {
  out += `\nFor investigation/lookup questions invoke the researcher skill (/research): triage L1/L2/L3, route tools deterministically, ground every claim with evidence.`;
}
process.stdout.write(out + '\n');
