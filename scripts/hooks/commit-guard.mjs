#!/usr/bin/env node
// Kiro hook: .kiro/hooks/commit-guard.json (PreToolUse on the shell tool).
// Blocks an agent `git commit` unless the repo is safe to commit:
//   1. no .gitignore line mentions kiro (/.kiro must stay committed)
//   2. a LICENSE file exists
//   3. no real .env file is staged
//   4. no secret pattern in the staged diff (AWS, Google AIza, Groq gsk_,
//      Context7 ctx7sk-, GitHub tokens, private key blocks)
//   5. npm run typecheck, npm run lint and npm test pass
// Non-commit commands exit 0 immediately.
//
// Exit codes follow https://kiro.dev/docs/hooks/types.md (Pre Tool Use):
//   0 allow, 2 block and return STDERR to the agent.
//
// Standalone use:
//   echo '{"hook_event_name":"PreToolUse","tool_name":"execute_bash","tool_input":{"command":"git commit -m x"}}' \
//     | node scripts/hooks/commit-guard.mjs
//   Add --static-only to skip step 5 (used by tests; the hook never passes it).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  envFiles,
  gitignoreKiroLines,
  isGitCommit,
  parseEvent,
  scanDiffForSecrets,
  shellCommandOf,
  stagesFiles,
} from './lib.mjs';
import { readStdin, repoRoot, run, tail } from './io.mjs';

const BLOCK = 2;
const staticOnly = process.argv.includes('--static-only');
const event = parseEvent(await readStdin());
const command = shellCommandOf(event);

if (!isGitCommit(command)) process.exit(0);

const cwd = typeof event.cwd === 'string' ? event.cwd : process.cwd();
const root = repoRoot(cwd);
const alsoUnstaged = stagesFiles(command);
/** @type {string[]} */
const problems = [];

// 1. .gitignore must never mention kiro (root file plus any tracked .gitignore).
const ignoreFiles = new Set(['.gitignore']);
for (const f of run('git', ['ls-files', '--', '*.gitignore', '.gitignore'], root).stdout.split('\n')) {
  if (f.trim()) ignoreFiles.add(f.trim());
}
for (const f of ignoreFiles) {
  const full = path.join(root, f);
  if (!existsSync(full)) continue;
  for (const line of gitignoreKiroLines(readFileSync(full, 'utf8'))) {
    problems.push(`${f} contains "${line}". /.kiro must be committed; the Kiroween rules say ignoring it could disqualify the entry.`);
  }
}

// 2. LICENSE must exist.
if (!['LICENSE', 'LICENSE.md', 'LICENSE.txt'].some((f) => existsSync(path.join(root, f)))) {
  problems.push('LICENSE is missing at the repo root. The entry needs an OSI open-source license.');
}

// 3. and 4. Staged files and diff (plus unstaged changes when this command stages files too).
const names = run('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], root).stdout.split('\n');
let diff = run('git', ['diff', '--cached', '-U0', '--no-color', '--no-ext-diff'], root).stdout;
if (alsoUnstaged) {
  names.push(...run('git', ['diff', '--name-only', '--diff-filter=ACMR'], root).stdout.split('\n'));
  names.push(...run('git', ['ls-files', '--others', '--exclude-standard'], root).stdout.split('\n'));
  diff += `\n${run('git', ['diff', '-U0', '--no-color', '--no-ext-diff'], root).stdout}`;
}
for (const f of envFiles(names.filter(Boolean))) {
  problems.push(`${f} looks like a real .env file and would be committed. Keep secrets out of git.`);
}
for (const s of scanDiffForSecrets(diff)) {
  problems.push(`Possible ${s.kind} in ${s.file}:${s.line}. Remove it and rotate the key if it is real.`);
}

if (problems.length > 0) {
  process.stderr.write(`commit-guard blocked this commit:\n- ${problems.join('\n- ')}\n`);
  process.exit(BLOCK);
}

// 5. Typecheck, lint and tests.
if (!staticOnly) {
  for (const script of [['run', 'typecheck'], ['run', 'lint'], ['test']]) {
    const r = run('npm', script, root);
    if (r.code !== 0) {
      process.stderr.write(
        `commit-guard blocked this commit: npm ${script.join(' ')} failed (exit ${r.code}).\n${tail(`${r.stdout}\n${r.stderr}`, 40)}\n`,
      );
      process.exit(BLOCK);
    }
  }
}

process.stdout.write(`commit-guard: checks passed${staticOnly ? ' (static only)' : ''}\n`);
process.exit(0);
