#!/usr/bin/env node
/*
 * ticket-resolver — recommended-plugin soft-check (SessionStart).
 *
 * Claude Code has no native plugin-dependency mechanism, so this hook reads the
 * editable list at ../recommended-plugins.json and warns when a recommended
 * plugin/tool is NOT detected. It is advisory only: it NEVER blocks /resolve and
 * exits 0 in all cases. Prints nothing when everything is present (no nag).
 *
 * Detection surfaces (current Claude Code, all best-effort — a miss only warns):
 *   - type "plugin": key `<name>@<marketplace>` set true in ~/.claude/settings.json -> enabledPlugins
 *   - type "tool"  : a skill dir ~/.claude/skills/<skill>/SKILL.md, OR `<command>` on PATH
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const HOME = os.homedir();

function loadEnabledPlugins() {
  // Merge user + (optional) project settings; later wins. enabledPlugins maps
  // "name@marketplace" -> boolean.
  const candidates = [
    path.join(HOME, '.claude', 'settings.json'),
    path.join(process.cwd(), '.claude', 'settings.json'),
    path.join(process.cwd(), '.claude', 'settings.local.json'),
  ];
  const merged = {};
  for (const file of candidates) {
    const cfg = readJson(file);
    if (cfg && cfg.enabledPlugins && typeof cfg.enabledPlugins === 'object') {
      Object.assign(merged, cfg.enabledPlugins);
    }
  }
  return merged;
}

function pluginEnabled(enabled, name) {
  // Match any "name@<marketplace>" that is truthy.
  for (const [key, val] of Object.entries(enabled)) {
    if (val && (key === name || key.startsWith(name + '@'))) return true;
  }
  return false;
}

function skillPresent(skill) {
  if (!skill) return false;
  return fs.existsSync(path.join(HOME, '.claude', 'skills', skill, 'SKILL.md'));
}

function commandOnPath(command) {
  if (!command) return false;
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const exts = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
    : [''];
  for (const dir of dirs) {
    for (const ext of exts) {
      try {
        if (fs.existsSync(path.join(dir, command + ext))) return true;
      } catch {
        /* ignore unreadable PATH entry */
      }
    }
  }
  return false;
}

function isPresent(dep, enabled) {
  const d = dep.detect || {};
  if (d.type === 'plugin') return pluginEnabled(enabled, d.name || dep.id);
  if (d.type === 'tool') return skillPresent(d.skill) || commandOnPath(d.command);
  return true; // unknown detect type -> assume present, don't false-warn
}

function main() {
  const listFile = path.join(__dirname, '..', 'recommended-plugins.json');
  const list = readJson(listFile);
  if (!list || !Array.isArray(list.recommended)) return; // nothing to check

  const enabled = loadEnabledPlugins();
  const missing = list.recommended.filter((dep) => !isPresent(dep, enabled));
  if (missing.length === 0) return; // all good — stay silent

  const lines = [
    'ticket-resolver: recommended companion plugins not detected. /resolve still works, but these sharpen it:',
    '',
  ];
  for (const dep of missing) {
    const tag = dep.required ? 'REQUIRED' : 'recommended';
    lines.push(`- ${dep.label} (${tag}) — ${dep.why}`);
    if (dep.install) lines.push(`    install: ${dep.install}`);
  }
  lines.push('');
  lines.push('Tell the user, once, that these are highly recommended; do not nag again this session. Edit recommended-plugins.json to change this list.');

  process.stdout.write(lines.join('\n') + '\n');
}

main();
