// Side-effecting helpers for the hook scripts: STDIN, child processes, repo root.
import { spawnSync } from 'node:child_process';

/**
 * Read all of STDIN. Resolves to '' when STDIN is a TTY (script run by hand).
 * @returns {Promise<string>}
 */
export async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Run a command without a shell and capture its output.
 * @param {string} cmd
 * @param {string[]} args
 * @param {string} cwd
 * @returns {{ code: number, stdout: string, stderr: string }}
 */
export function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: (result.stderr ?? '') + (result.error ? String(result.error) : ''),
  };
}

/**
 * The git top-level directory for cwd, or cwd itself outside a repo.
 * @param {string} cwd
 */
export function repoRoot(cwd) {
  const r = run('git', ['rev-parse', '--show-toplevel'], cwd);
  return r.code === 0 ? r.stdout.trim() : cwd;
}

/**
 * Last n lines of a text block, for short hook messages.
 * @param {string} text
 * @param {number} n
 */
export function tail(text, n) {
  const lines = text.trimEnd().split('\n');
  return lines.slice(-n).join('\n');
}
