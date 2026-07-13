#!/usr/bin/env node
// Observer signal extractor: mines Claude Code session transcript JSONL and
// prints a compact markdown digest (errors/retries, permission denials, user
// corrections, plugin usage, stats). Raw transcript bodies never exceed the
// quote cap; total output is hard-capped so the digest stays context-cheap.
//
// Usage:
//   mine-transcript.js                    newest transcript of current project
//   mine-transcript.js --all              all of today's transcripts
//   mine-transcript.js --session <path>   explicit JSONL file(s)
//   mine-transcript.js --dir <path>       explicit project transcript dir

const fs = require('fs');
const path = require('path');
const os = require('os');

const QUOTE_CAP = 200;
const LINE_CAP = 120;
const SECTION_ITEM_CAP = 15;

function args(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
}

function projectDir() {
  const explicit = args('--dir');
  if (explicit) return explicit;
  const root = path.join(os.homedir(), '.claude', 'projects');
  const want = process.cwd().replace(/[:\\/.]/g, '-').toLowerCase();
  try {
    const hit = fs.readdirSync(root).find((d) => d.toLowerCase() === want);
    if (hit) return path.join(root, hit);
  } catch {}
  return null;
}

function pickFiles() {
  const explicit = args('--session');
  if (explicit) return [explicit];
  const dir = projectDir();
  if (!dir) return [];
  let files;
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(dir, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  } catch {
    return [];
  }
  if (!process.argv.includes('--all')) return files.slice(0, 1);
  const today = new Date().toDateString();
  return files.filter((f) => fs.statSync(f).mtimeMs && new Date(fs.statSync(f).mtimeMs).toDateString() === today);
}

function clip(s) {
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > QUOTE_CAP ? s.slice(0, QUOTE_CAP) + '…' : s;
}

// ---- parse ----------------------------------------------------------------

const CORRECTION_RE =
  /\b(no|not|wrong|stop|don'?t|do not|actually|instead|revert|undo|нет|не so|не так|стоп|неправильно|отмени|наоборот)\b/i;

function analyze(files) {
  const errors = []; // {tool, snippet, retried}
  const denials = [];
  const corrections = [];
  const skillUse = {}; // name -> count
  const slashUse = {}; // /cmd -> count
  const toolCount = {}; // name -> count
  const hookErrors = [];
  let userMsgs = 0,
    assistantMsgs = 0,
    lastErrorTool = null;

  for (const file of files) {
    let lines;
    try {
      lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
    } catch {
      continue;
    }
    for (const line of lines) {
      let e;
      try {
        e = JSON.parse(line);
      } catch {
        continue;
      }
      if (e.isSidechain) continue; // subagent traffic: audited via its own artifacts

      if (e.type === 'assistant' && e.message && Array.isArray(e.message.content)) {
        assistantMsgs++;
        for (const b of e.message.content) {
          if (b.type !== 'tool_use') continue;
          toolCount[b.name] = (toolCount[b.name] || 0) + 1;
          if (b.name === 'Skill' && b.input && b.input.skill) skillUse[b.input.skill] = (skillUse[b.input.skill] || 0) + 1;
          if (lastErrorTool && b.name === lastErrorTool) {
            const last = errors[errors.length - 1];
            if (last && last.tool === b.name) last.retried = true;
            lastErrorTool = null;
          }
        }
      } else if (e.type === 'user' && e.message) {
        const c = e.message.content;
        if (Array.isArray(c) && c.some((b) => b.type === 'tool_result')) {
          for (const b of c) {
            if (b.type !== 'tool_result') continue;
            const text = typeof b.content === 'string' ? b.content : JSON.stringify(b.content || '');
            const isErr = b.is_error || /^\s*<tool_use_error>/.test(text); // anchored: mid-text occurrences are quotes, not errors
            if (!isErr) continue;
            if (/permission|denied|doesn'?t want|not allowed|rejected/i.test(text)) denials.push(clip(text));
            else {
              errors.push({ tool: '(tool)', snippet: clip(text), retried: false });
              lastErrorTool = '(tool)';
            }
          }
        } else {
          // human-typed message
          const text = typeof c === 'string' ? c : (Array.isArray(c) ? c.filter((b) => b.type === 'text').map((b) => b.text).join(' ') : '');
          if (!text) continue;
          // slash commands may arrive inside harness-wrapped entries — count first
          const cmd = text.match(/<command-name>([^<]+)<\/command-name>/) || text.match(/^\s*(\/[\w:-]+)/);
          if (cmd) {
            slashUse[cmd[1]] = (slashUse[cmd[1]] || 0) + 1;
            continue;
          }
          // remaining harness-injected user-type entries are not human speech
          if (/^\s*<(local-command|ide_|system-reminder|task-notification)/.test(text)) continue;
          userMsgs++;
          if (text.length < 300 && CORRECTION_RE.test(text)) corrections.push(clip(text));
        }
      } else if (e.type === 'system' && e.hookErrors && e.hookErrors.length) {
        for (const h of e.hookErrors) hookErrors.push(clip(typeof h === 'string' ? h : JSON.stringify(h)));
      }
    }
  }
  return { errors, denials, corrections, skillUse, slashUse, toolCount, hookErrors, userMsgs, assistantMsgs };
}

// ---- render ---------------------------------------------------------------

const files = pickFiles();
if (!files.length) {
  console.log('No transcript files found (project dir not located and no --session given). Proceed artifacts-only.');
  process.exit(0);
}
const r = analyze(files);
const out = [];
const cap = (arr) => arr.slice(0, SECTION_ITEM_CAP).concat(arr.length > SECTION_ITEM_CAP ? [`… +${arr.length - SECTION_ITEM_CAP} more`] : []);

out.push(`# Transcript digest — ${files.map((f) => path.basename(f)).join(', ')}`);
out.push('');
out.push(`## Errors & retries (${r.errors.length})`);
for (const e of cap(r.errors)) out.push(typeof e === 'string' ? e : `- ${e.retried ? '[RETRIED] ' : ''}${e.snippet}`);
out.push('');
out.push(`## Permission denials (${r.denials.length})`);
for (const d of cap(r.denials)) out.push(`- ${d}`);
out.push('');
out.push(`## User corrections (heuristic, ${r.corrections.length})`);
for (const c of cap(r.corrections)) out.push(`- "${c}"`);
out.push('');
out.push('## Plugin usage');
const skills = Object.entries(r.skillUse).sort((a, b) => b[1] - a[1]);
const slashes = Object.entries(r.slashUse).sort((a, b) => b[1] - a[1]);
out.push(`- skills: ${skills.length ? skills.map(([k, v]) => `${k}×${v}`).join(', ') : '(none invoked)'}`);
out.push(`- commands: ${slashes.length ? slashes.map(([k, v]) => `${k}×${v}`).join(', ') : '(none)'}`);
if (r.hookErrors.length) {
  out.push('');
  out.push(`## Hook errors (${r.hookErrors.length})`);
  for (const h of cap(r.hookErrors)) out.push(`- ${h}`);
}
out.push('');
out.push('## Stats');
out.push(`- user messages: ${r.userMsgs}, assistant messages: ${r.assistantMsgs}`);
const topTools = Object.entries(r.toolCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
out.push(`- top tools: ${topTools.map(([k, v]) => `${k}×${v}`).join(', ') || '(none)'}`);

console.log(out.slice(0, LINE_CAP).join('\n'));
if (out.length > LINE_CAP) console.log(`… digest truncated at ${LINE_CAP} lines`);
