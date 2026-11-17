#!/usr/bin/env node
// Kiro hook: .kiro/hooks/a11y-lighthouse-on-build.json (PostToolUse on the shell tool).
// After the agent runs `npm run build`, runs scripts/audit.mjs (axe + Lighthouse against dist/,
// writes reports/raw/*.json and reports/summary.md) and prints reports/summary.md to STDOUT so the
// agent reads the measured scores. Other commands exit 0 immediately. It never invents numbers:
// if the audit fails, the agent gets the failure output and whatever summary the audit wrote.
//
// Standalone use:
//   echo '{"tool_name":"execute_bash","tool_input":{"command":"npm run build"}}' \
//     | node scripts/hooks/a11y-lighthouse-on-build.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { isNpmBuild, parseEvent, shellCommandOf, toolFailed } from './lib.mjs';
import { readStdin, repoRoot, run, tail } from './io.mjs';

const event = parseEvent(await readStdin());
const command = shellCommandOf(event);
if (!isNpmBuild(command)) process.exit(0);

const cwd = typeof event.cwd === 'string' ? event.cwd : process.cwd();
const root = repoRoot(cwd);

if (toolFailed(event)) {
  process.stdout.write('a11y-lighthouse-on-build: build failed, audit skipped. No scores produced.\n');
  process.exit(0);
}

const audit = path.join(root, 'scripts', 'audit.mjs');
if (!existsSync(audit)) {
  process.stdout.write('a11y-lighthouse-on-build: scripts/audit.mjs is missing. No axe or Lighthouse scores were produced.\n');
  process.exit(0);
}

const summaryPath = path.join(root, 'reports', 'summary.md');
const startedAt = Date.now();
const r = run(process.execPath, [audit], root);
// Only a summary written by this run counts; an older file would show stale numbers.
const fresh = existsSync(summaryPath) && statSync(summaryPath).mtimeMs >= startedAt;
const summary = fresh ? readFileSync(summaryPath, 'utf8') : '';

if (r.code === 0) {
  process.stdout.write(`a11y-lighthouse-on-build: audit finished (reports/summary.md):\n\n${summary}\n`);
  process.exit(0);
}
process.stderr.write(
  `a11y-lighthouse-on-build: audit failed (exit ${r.code}).\n${tail(r.stderr, 40)}\n` +
    (summary ? `\nreports/summary.md from this run:\n\n${summary}\n` : 'No summary was written by this run.\n'),
);
process.exit(1);
