import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// Runs the real commit-guard script against throwaway git repos.
// --static-only skips the npm typecheck/lint/test step, which needs this
// project's node_modules and is covered by running the hook here for real.
const script = path.resolve(import.meta.dirname, '../../scripts/hooks/commit-guard.mjs');
const repos: string[] = [];

function makeRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'dg-guard-'));
  repos.push(dir);
  const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(dir, name), content);
  git('add', '.');
  return dir;
}

function guard(cwd: string, command: string) {
  const payload = JSON.stringify({
    hook_event_name: 'PreToolUse',
    cwd,
    session_id: 'test',
    tool_name: 'execute_bash',
    tool_input: { command },
  });
  return spawnSync(process.execPath, [script, '--static-only'], { input: payload, encoding: 'utf8' });
}

afterEach(() => {
  for (const dir of repos.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('commit-guard script', () => {
  it('allows non-commit commands without checking anything', () => {
    const dir = makeRepo({ '.gitignore': '.kiro/\n' });
    expect(guard(dir, 'git status').status).toBe(0);
  });

  it('allows a commit in a clean repo', () => {
    const dir = makeRepo({ LICENSE: 'MIT License', '.gitignore': 'node_modules/\n', 'a.ts': 'export const a = 1;\n' });
    const r = guard(dir, 'git commit -m "feat: a"');
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('blocks with exit 2 when .gitignore mentions .kiro', () => {
    const dir = makeRepo({ LICENSE: 'MIT License', '.gitignore': 'node_modules/\n.kiro/\n' });
    const r = guard(dir, 'git commit -m x');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('.gitignore contains ".kiro/"');
  });

  it('blocks when LICENSE is missing', () => {
    const dir = makeRepo({ 'a.ts': 'export const a = 1;\n' });
    const r = guard(dir, 'git commit -m x');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('LICENSE is missing');
  });

  it('blocks a staged .env file and a staged secret', () => {
    const key = 'AIza' + 'Sy' + 'B'.repeat(33);
    const dir = makeRepo({ LICENSE: 'MIT License', '.env': 'X=1\n', 'config.ts': `export const k = '${key}';\n` });
    const r = guard(dir, 'git commit -m x');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('.env looks like a real .env file');
    expect(r.stderr).toContain('Possible Google API key in config.ts:1');
  });
});
