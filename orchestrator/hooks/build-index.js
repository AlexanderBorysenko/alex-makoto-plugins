#!/usr/bin/env node
// SessionStart hook: emit a routing table of sibling plugins (generated)
// followed by hand-authored orchestration rules (index-rules.md).
//
// Plugin discovery handles both run contexts:
//   1. Dev / repo checkout: walk up from this plugin for .claude-plugin/marketplace.json,
//      then read each plugin's source dir relative to the marketplace root.
//   2. Installed cache (~/.claude/plugins/cache/<marketplace>/<plugin>/<hash>/):
//      scan sibling plugin dirs, picking the newest <hash> dir of each.
// If neither works, emit rules only — never fail the session.

const fs = require('fs');
const path = require('path');

const SELF = 'orchestrator';
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dirname, '..');

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function listCommands(pluginDir) {
  try {
    return fs
      .readdirSync(path.join(pluginDir, 'commands'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => '/' + f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}

// Strategy 1: repo checkout — marketplace.json somewhere above us.
function discoverFromMarketplace() {
  let dir = pluginRoot;
  for (let i = 0; i < 5; i++) {
    dir = path.dirname(dir);
    const mp = readJson(path.join(dir, '.claude-plugin', 'marketplace.json'));
    if (mp && Array.isArray(mp.plugins)) {
      return mp.plugins
        .map((p) => ({ dir: path.resolve(dir, p.source || ''), meta: p }))
        .filter((p) => fs.existsSync(p.dir));
    }
  }
  return null;
}

// Strategy 2: installed cache — siblings at ../../<plugin>/<hash>/.
function discoverFromCache() {
  const marketplaceDir = path.resolve(pluginRoot, '..', '..');
  let names;
  try {
    names = fs.readdirSync(marketplaceDir);
  } catch {
    return null;
  }
  const found = [];
  for (const name of names) {
    const pluginDir = path.join(marketplaceDir, name);
    let hashes;
    try {
      hashes = fs
        .readdirSync(pluginDir)
        .map((h) => path.join(pluginDir, h))
        .filter((h) => fs.existsSync(path.join(h, '.claude-plugin', 'plugin.json')));
    } catch {
      continue;
    }
    if (!hashes.length) continue;
    // newest hash dir wins
    hashes.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    const meta = readJson(path.join(hashes[0], '.claude-plugin', 'plugin.json'));
    if (meta) found.push({ dir: hashes[0], meta });
  }
  return found.length ? found : null;
}

function buildTable() {
  const plugins = discoverFromMarketplace() || discoverFromCache() || [];
  const rows = [];
  for (const { dir, meta } of plugins) {
    const full = readJson(path.join(dir, '.claude-plugin', 'plugin.json')) || meta;
    const name = full.name || meta.name;
    if (!name || name === SELF) continue;
    // Name + commands only — full descriptions already reach the model via each
    // skill's description; repeating them here spent startup budget twice (S6).
    const commands = listCommands(dir);
    rows.push(`- **${name}**${commands.length ? ` (${commands.join(', ')})` : ''}`);
  }
  return rows;
}

const parts = [];
parts.push('Plugin bundle active. Installed plugins:');
const rows = buildTable();
parts.push(rows.length ? rows.join('\n') : '(plugin table unavailable in this install layout)');

const rules = (() => {
  try {
    return fs.readFileSync(path.join(pluginRoot, 'index-rules.md'), 'utf8').trim();
  } catch {
    return '';
  }
})();
if (rules) parts.push(rules);

process.stdout.write(parts.join('\n\n') + '\n');
