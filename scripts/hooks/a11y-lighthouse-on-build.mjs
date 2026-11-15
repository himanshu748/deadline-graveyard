#!/usr/bin/env node
// Kiro hook: .kiro/hooks/a11y-lighthouse-on-build.json (PostToolUse on the shell tool).
// After the agent runs `npm run build`, runs scripts/audit.mjs (axe + Lighthouse
// against dist/, writes reports/). Other commands exit 0 immediately.
//
// scripts/audit.mjs is added in the polish phase. Until it exists this hook
// prints a notice and reports no scores; it never invents numbers.
//
// Standalone use:
//   echo '{"tool_name":"execute_bash","tool_input":{"command":"npm run build"}}' \
//     | node scripts/hooks/a11y-lighthouse-on-build.mjs
import { existsSync } from 'node:fs';
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
  process.stdout.write(
    'a11y-lighthouse-on-build: scripts/audit.mjs does not exist yet (planned for the polish phase). ' +
      'No axe or Lighthouse scores were produced.\n',
  );
  process.exit(0);
}

const r = run(process.execPath, [audit], root);
const output = `${r.stdout}\n${r.stderr}`;
if (r.code === 0) {
  process.stdout.write(`a11y-lighthouse-on-build: audit finished. See reports/summary.md.\n${tail(output, 20)}\n`);
  process.exit(0);
}
process.stderr.write(`a11y-lighthouse-on-build: audit failed (exit ${r.code}).\n${tail(output, 40)}\n`);
process.exit(1);
