#!/usr/bin/env node
// Kiro hook: .kiro/hooks/tests-on-save.json (PostFileSave on src/**/*.ts(x)).
// Runs the Vitest tests related to the saved file and reports failures.
//
// Standalone use:
//   node scripts/hooks/tests-on-save.mjs src/ui/App.tsx
//   echo '{"file_path":"src/ui/App.tsx"}' | node scripts/hooks/tests-on-save.mjs
//
// Exit 0: tests passed (or the file is not a watched source); summary on STDOUT.
// Exit 1: related tests failed; the failure output goes to STDERR, which Kiro
// sends to the agent for non-zero exits.
import path from 'node:path';
import { isWatchedSource, parseEvent, savedFilePath, toRepoRelative } from './lib.mjs';
import { readStdin, repoRoot, run, tail } from './io.mjs';

const event = parseEvent(await readStdin());
const cwd = typeof event.cwd === 'string' ? event.cwd : process.cwd();
const root = repoRoot(cwd);
const file = savedFilePath(process.argv.slice(2), event);
const rel = file ? toRepoRelative(path.resolve(cwd, file), root) : null;

if (!isWatchedSource(rel)) {
  process.stdout.write(`tests-on-save: skipped (${file ?? 'no file path'} is not under src/ as .ts or .tsx)\n`);
  process.exit(0);
}

const result = run('npx', ['vitest', 'related', '--run', '--passWithNoTests', /** @type {string} */ (rel)], root);
const output = `${result.stdout}\n${result.stderr}`;

if (result.code === 0) {
  process.stdout.write(`tests-on-save: related tests for ${rel} passed\n${tail(output, 6)}\n`);
  process.exit(0);
}

process.stderr.write(`tests-on-save: related tests for ${rel} FAILED (exit ${result.code})\n${tail(output, 60)}\n`);
process.exit(1);
