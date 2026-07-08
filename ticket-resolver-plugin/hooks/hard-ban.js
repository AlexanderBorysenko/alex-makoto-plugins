#!/usr/bin/env node
/*
 * ticket-resolver — PreToolUse hard-ban hook.
 *
 * Enforces the bans a per-agent tool allowlist can't express (design §8). Reads the PreToolUse
 * payload on stdin; for Bash commands it denies dangerous operations unless a scoped MARKER FILE
 * under the nearest `.workbench/` grants a narrow exception.
 *
 * Why marker files, not env vars: the orchestrator is a model, not a process — it cannot set env
 * vars that this hook subprocess would inherit. It CAN create/remove a marker file with a tool call
 * immediately around a privileged action. Because the model runs one tool call at a time, the
 * git markers are only present during the orchestrator's own commit/push, never while a subagent
 * runs — so subagents can never commit or push.
 *
 *   .workbench/.allow-commit   present -> permit git commit / reset --hard / rebase / checkout -- / clean / --no-verify
 *   .workbench/.allow-push     present -> permit git push
 *   .workbench/.run-allow      lines are glob patterns; a long-running/dev-server start is permitted
 *                              only if the command matches one (REPRODUCE / VERIFY phases)
 *
 * Decision protocol: deny -> emit a PreToolUse JSON decision and exit 0. Allow -> exit 0 silently.
 * Fail-open is avoided: if anything is uncertain for a banned pattern, deny.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------- stdin ----------

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'ticket-resolver hard-ban: ' + reason,
      },
    }) + '\n'
  );
  process.exit(0);
}

function allow() {
  process.exit(0);
}

// ---------- marker resolution ----------

function findWorkbench(startDir) {
  let dir = startDir;
  // Walk up until we find a directory that contains `.workbench`.
  for (let i = 0; i < 40 && dir; i++) {
    const candidate = path.join(dir, '.workbench');
    try {
      if (fs.statSync(candidate).isDirectory()) return candidate;
    } catch {
      /* not here */
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function markerPresent(workbench, name) {
  if (!workbench) return false;
  try {
    return fs.statSync(path.join(workbench, name)).isFile();
  } catch {
    return false;
  }
}

function runAllowPatterns(workbench) {
  if (!workbench) return [];
  let raw;
  try {
    raw = fs.readFileSync(path.join(workbench, '.run-allow'), 'utf8');
  } catch {
    return [];
  }
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(escaped);
}

function matchesAnyAllow(command, patterns) {
  return patterns.some((p) => {
    try {
      return globToRegExp(p).test(command);
    } catch {
      return command.includes(p);
    }
  });
}

// ---------- pattern groups ----------

// Never permitted, no marker can grant these.
const BANNED_ALWAYS = [
  { re: /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r|\brm\s+-r\s+-f|\brm\s+-f\s+-r/i, why: 'recursive force delete (rm -rf)' },
  { re: /\brmdir\s+\/s\b|\bdel\s+\/[a-z]*s/i, why: 'recursive delete (rmdir /s, del /s)' },
  { re: /\bRemove-Item\b.*-Recurse.*-Force|\bRemove-Item\b.*-Force.*-Recurse/i, why: 'recursive force delete (Remove-Item -Recurse -Force)' },
  { re: /\bkillall\b|\bkill\s+-9\b|\btaskkill\b|\bStop-Process\b|\bpkill\b/i, why: 'process kill' },
];

// git write ops — permitted only with .allow-commit (orchestrator window).
const GIT_COMMIT = [
  { re: /\bgit\s+(-c\s+\S+\s+|-C\s+\S+\s+)*commit\b/i, why: 'git commit' },
  { re: /\bgit\s+(-c\s+\S+\s+|-C\s+\S+\s+)*reset\b[^\n]*--hard/i, why: 'git reset --hard' },
  { re: /\bgit\s+(-c\s+\S+\s+|-C\s+\S+\s+)*rebase\b/i, why: 'git rebase' },
  { re: /\bgit\s+(-c\s+\S+\s+|-C\s+\S+\s+)*checkout\b\s+--(\s|$)/i, why: 'git checkout -- (discard)' },
  { re: /\bgit\s+(-c\s+\S+\s+|-C\s+\S+\s+)*clean\b/i, why: 'git clean' },
  { re: /--no-verify\b/i, why: '--no-verify (bypassing hooks)' },
];

// git push — permitted only with .allow-push (finalize window).
const GIT_PUSH = { re: /\bgit\s+(-c\s+\S+\s+|-C\s+\S+\s+)*push\b/i, why: 'git push' };

// Long-running / dev-server starts — permitted only if matched by .run-allow during repro/verify.
const DEV_SERVER = [
  { re: /\bspring-boot:run\b/i, why: 'spring-boot:run dev server' },
  { re: /\bnpm\s+(run\s+)?start\b/i, why: 'npm start dev server' },
  { re: /\byarn\s+(run\s+)?start\b|\bpnpm\s+(run\s+)?start\b/i, why: 'yarn/pnpm start dev server' },
  { re: /\bng\s+serve\b/i, why: 'ng serve dev server' },
  { re: /\bnodemon\b/i, why: 'nodemon watcher' },
  { re: /\bvite\b(?!\s+build)/i, why: 'vite dev server' },
  { re: /\bnext\s+dev\b/i, why: 'next dev server' },
  { re: /\bflask\s+run\b/i, why: 'flask dev server' },
  { re: /\brails\s+s(erver)?\b/i, why: 'rails server' },
  { re: /\bpython\s+-m\s+http\.server\b/i, why: 'python http.server' },
  // `docker compose up` WITHOUT -d / --detach is a foreground (blocking) start.
  { re: /\bdocker(-|\s+)compose\s+up\b(?![^\n]*(-d\b|--detach))/i, why: 'foreground docker compose up (use -d)' },
];

// ---------- main ----------

function main() {
  let payload = {};
  try {
    payload = JSON.parse(readStdin() || '{}');
  } catch {
    allow(); // unparseable -> let the harness handle it
  }

  const tool = payload.tool_name || payload.toolName;
  if (tool !== 'Bash') allow();

  const input = payload.tool_input || payload.toolInput || {};
  const command = String(input.command || '');
  if (!command.trim()) allow();

  const startDir = payload.cwd || input.cwd || process.cwd();
  const workbench = findWorkbench(startDir);

  // 1) Always-banned.
  for (const b of BANNED_ALWAYS) if (b.re.test(command)) deny(b.why + ' is never permitted');

  // 2) git push.
  if (GIT_PUSH.re.test(command)) {
    if (markerPresent(workbench, '.allow-push')) allow();
    deny('git push is reserved to the orchestrator finalize step (no .allow-push marker)');
  }

  // 3) git commit / history rewrite.
  for (const g of GIT_COMMIT) {
    if (g.re.test(command)) {
      if (markerPresent(workbench, '.allow-commit')) allow();
      deny(g.why + ' is orchestrator-only (no .allow-commit marker); subagents must not write git history');
    }
  }

  // 4) dev-server / long-running starts.
  for (const d of DEV_SERVER) {
    if (d.re.test(command)) {
      const patterns = runAllowPatterns(workbench);
      if (patterns.length && matchesAnyAllow(command, patterns)) allow();
      deny(d.why + ' not on the RUNBOOK run-allowlist for this phase (.run-allow)');
    }
  }

  allow();
}

main();
