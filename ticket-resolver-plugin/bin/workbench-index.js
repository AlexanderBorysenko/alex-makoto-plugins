#!/usr/bin/env node
/**
 * workbench-index — derive the ticket-resolver ticket list from
 * .workbench/<TICKET>/INDEX.md YAML frontmatter.
 *
 * Mirrors memory-system's mem-index: the index is DERIVED on demand from
 * per-ticket frontmatter; there is no on-disk master index to maintain or stale.
 *
 * Usage:
 *   node workbench-index.js [--base <path>] [--json]
 *   (default --base .workbench)
 *
 * Buckets, from frontmatter `state`:
 *   DONE      -> done
 *   ABANDONED -> abandoned
 *   anything else (SETUP, ANALYZING, IMPLEMENTING, GATE_*, VERIFYING, ...) -> open
 * Open tickets sort most-recently-updated first.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------- Arg parsing ----------

function parseArgs(argv) {
  const args = { json: false, base: path.join('.', '.workbench') };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--json') {
      args.json = true;
    } else if (a === '--base') {
      i++;
      if (i >= rest.length) return { error: '--base requires a value' };
      args.base = rest[i];
    } else {
      return { error: `unknown argument: ${a}` };
    }
  }
  return args;
}

function usage() {
  return 'usage: workbench-index [--base <path>] [--json]';
}

// ---------- Frontmatter parsing (minimal, same dialect as mem-index) ----------

function parseFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { endIdx = i; break; }
  }
  if (endIdx === -1) return null;
  const fm = {};
  for (const line of lines.slice(1, endIdx)) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    fm[line.slice(0, colon).trim()] = parseValue(line.slice(colon + 1).trim());
  }
  return fm;
}

function parseValue(value) {
  if (value === '') return '';
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    return inner === '' ? [] : inner.split(',').map((s) => unquote(s.trim()));
  }
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  return value;
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// ---------- Bucketing ----------

function bucketOf(state) {
  const s = String(state || '').toUpperCase();
  if (s === 'DONE') return 'done';
  if (s === 'ABANDONED') return 'abandoned';
  return 'open';
}

// ---------- Reading ----------

function readTickets(base, warn) {
  let entries;
  try {
    entries = fs.readdirSync(base, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return [];
    throw e;
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const indexPath = path.join(base, ent.name, 'INDEX.md');
    let raw;
    try {
      raw = fs.readFileSync(indexPath, 'utf8');
    } catch {
      continue; // dir without an INDEX.md is not a ticket
    }
    const fm = parseFrontmatter(raw);
    if (!fm) {
      warn(`warning: ${path.join(ent.name, 'INDEX.md')} has no frontmatter, skipping`);
      continue;
    }
    if (!fm.ticket) fm.ticket = ent.name.split('-')[0];
    if (!fm.slug) fm.slug = ent.name;
    if (!fm.state) {
      warn(`warning: ${path.join(ent.name, 'INDEX.md')} missing state, skipping`);
      continue;
    }
    fm.__file = path.posix.join(ent.name, 'INDEX.md').replace(/\\/g, '/');
    out.push(fm);
  }
  return out;
}

// ---------- Grouping ----------

function group(entries) {
  const groups = { open: [], done: [], abandoned: [] };
  for (const e of entries) groups[bucketOf(e.state)].push(e);
  for (const k of Object.keys(groups)) {
    groups[k].sort((a, b) => {
      const ua = String(a.updated || ''), ub = String(b.updated || '');
      if (ua !== ub) return ua < ub ? 1 : -1; // updated desc
      return String(a.ticket).localeCompare(String(b.ticket));
    });
  }
  return groups;
}

// ---------- Formatting ----------

function formatMarkdown(groups) {
  const total = groups.open.length + groups.done.length + groups.abandoned.length;
  if (total === 0) return '# Tickets\n\n_(no tickets in workbench)_\n';
  const labels = { open: 'Open', done: 'Done', abandoned: 'Abandoned' };
  const parts = ['# Tickets\n'];
  for (const k of ['open', 'done', 'abandoned']) {
    if (groups[k].length === 0) continue;
    parts.push(`\n## ${labels[k]}\n`);
    for (const t of groups[k]) {
      const title = t.title ? ` — ${t.title}` : '';
      const updated = t.updated ? ` · updated ${t.updated}` : '';
      const next = t.next_action ? ` · next: ${t.next_action}` : '';
      parts.push(
        `- **${t.ticket}**${title} · state ${t.state}${updated}${next} · [open](${t.__file})`
      );
    }
    parts.push('');
  }
  return parts.join('\n').replace(/\n+$/, '\n');
}

function toJSON(groups) {
  const shape = (t) => ({
    ticket: t.ticket,
    slug: t.slug,
    title: t.title || null,
    state: t.state,
    branch: t.branch || null,
    summary: t.summary || null,
    next_action: t.next_action || null,
    topics: Array.isArray(t.topics) ? t.topics : [],
    updated: t.updated || null,
    file: t.__file,
  });
  return {
    open: groups.open.map(shape),
    done: groups.done.map(shape),
    abandoned: groups.abandoned.map(shape),
  };
}

// ---------- Main ----------

function main() {
  const parsed = parseArgs(process.argv);
  if (parsed.error) {
    process.stderr.write(`error: ${parsed.error}\n${usage()}\n`);
    process.exit(2);
  }
  const warn = (m) => process.stderr.write(m + '\n');
  const groups = group(readTickets(parsed.base, warn));
  if (parsed.json) {
    process.stdout.write(JSON.stringify(toJSON(groups), null, 2) + '\n');
  } else {
    process.stdout.write(formatMarkdown(groups));
  }
  process.exit(0);
}

main();
