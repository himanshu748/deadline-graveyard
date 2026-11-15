import { describe, expect, it } from 'vitest';
import {
  envFiles,
  gitignoreKiroLines,
  isGitCommit,
  isNpmBuild,
  isWatchedSource,
  parseEvent,
  savedFilePath,
  scanDiffForSecrets,
  shellCommandOf,
  splitShellCommands,
  stagesFiles,
  toRepoRelative,
  toolFailed,
} from '../../scripts/hooks/lib.mjs';

// Fake secrets are assembled at runtime so this file never contains a
// literal that the commit guard would flag.
const fake = {
  aws: 'AKIA' + 'ABCDEFGHIJKLMNOP',
  google: 'AIza' + 'Sy' + 'A'.repeat(33),
  groq: 'gsk' + '_' + 'a1B2c3D4e5F6g7H8i9J0k1L2',
  ctx7: 'ctx7sk' + '-' + '0123456789abcdef0123',
  github: 'ghp' + '_' + 'x'.repeat(36),
  pem: '-----BEGIN ' + 'RSA PRIVATE KEY-----',
};

describe('parseEvent', () => {
  it('parses a documented PreToolUse payload', () => {
    const e = parseEvent(
      '{"hook_event_name":"PreToolUse","cwd":"/repo","session_id":"s","tool_name":"execute_bash","tool_input":{"command":"git status"}}',
    );
    expect(e.hook_event_name).toBe('PreToolUse');
    expect(shellCommandOf(e)).toBe('git status');
  });

  it('returns {} for empty, invalid or non-object input', () => {
    expect(parseEvent('')).toEqual({});
    expect(parseEvent('not json')).toEqual({});
    expect(parseEvent('[1,2]')).toEqual({});
  });
});

describe('shellCommandOf', () => {
  it('falls back to the first string field when command is absent', () => {
    expect(shellCommandOf({ tool_input: { cmd: 'npm run build' } })).toBe('npm run build');
  });
  it('returns null without tool_input', () => {
    expect(shellCommandOf({})).toBeNull();
  });
});

describe('splitShellCommands', () => {
  it('splits on separators but not inside quotes', () => {
    expect(splitShellCommands('git add a && git commit -m "a && b; c" | cat')).toEqual([
      'git add a',
      'git commit -m "a && b; c"',
      'cat',
    ]);
  });
});

describe('isGitCommit', () => {
  it.each([
    'git commit -m "x"',
    'git add src/a.ts && git commit -m x',
    'cd repo; git commit',
    'git -C deadline-graveyard commit -m x',
    'GIT_AUTHOR_NAME=a git commit -m x',
    'git --no-pager commit --amend',
  ])('matches %s', (cmd) => {
    expect(isGitCommit(cmd)).toBe(true);
  });

  it.each([
    'git status',
    'git commit-tree abc',
    'echo "git commit"',
    'git log --grep commit',
    'npm test',
    '',
  ])('ignores %s', (cmd) => {
    expect(isGitCommit(cmd)).toBe(false);
  });
});

describe('stagesFiles', () => {
  it('detects git add and commit -a', () => {
    expect(stagesFiles('git add . && git commit -m x')).toBe(true);
    expect(stagesFiles('git commit -am x')).toBe(true);
    expect(stagesFiles('git commit --all -m x')).toBe(true);
  });
  it('is false for a plain commit or amend', () => {
    expect(stagesFiles('git commit -m x')).toBe(false);
    expect(stagesFiles('git commit --amend')).toBe(false);
  });
});

describe('isNpmBuild', () => {
  it('matches npm run build with or without other commands', () => {
    expect(isNpmBuild('npm run build')).toBe(true);
    expect(isNpmBuild('npm run typecheck && npm run build -- --mode x')).toBe(true);
  });
  it('ignores other scripts', () => {
    expect(isNpmBuild('npm run build:docs')).toBe(false);
    expect(isNpmBuild('npm test')).toBe(false);
    expect(isNpmBuild(null)).toBe(false);
  });
});

describe('gitignoreKiroLines', () => {
  it('flags any non-comment line mentioning kiro', () => {
    expect(gitignoreKiroLines('node_modules/\n.kiro/\n/.kiro/hooks\n# keep .kiro committed\n.KIRO')).toEqual([
      '.kiro/',
      '/.kiro/hooks',
      '.KIRO',
    ]);
  });
  it('passes the project .gitignore patterns', () => {
    expect(gitignoreKiroLines('node_modules/\ndist/\n.env*\nreports/raw/\n*.log\n')).toEqual([]);
  });
});

describe('scanDiffForSecrets', () => {
  const diff = (lines: string[]) =>
    ['diff --git a/src/x.ts b/src/x.ts', '--- a/src/x.ts', '+++ b/src/x.ts', '@@ -0,0 +10,9 @@', ...lines].join('\n');

  it('finds each supported secret kind on added lines with file and line', () => {
    const found = scanDiffForSecrets(
      diff([
        `+const a = '${fake.aws}';`,
        `+const g = '${fake.google}';`,
        `+const q = '${fake.groq}';`,
        `+const c = '${fake.ctx7}';`,
        `+const h = '${fake.github}';`,
        `+${fake.pem}`,
        `+aws_secret_access_key = ${'a'.repeat(40)}`,
      ]),
    );
    expect(found.map((f) => f.kind)).toEqual([
      'AWS access key id',
      'Google API key',
      'Groq API key',
      'Context7 API key',
      'GitHub token',
      'private key block',
      'AWS secret access key',
    ]);
    expect(found[0]).toEqual({ file: 'src/x.ts', line: 10, kind: 'AWS access key id' });
    expect(found[5]?.line).toBe(15);
  });

  it('ignores removed lines, context and look-alikes', () => {
    expect(
      scanDiffForSecrets(
        diff([`-const a = '${fake.aws}';`, '+// keys look like AIza... or gsk_...', '+const ok = "AKIA";']),
      ),
    ).toEqual([]);
  });
});

describe('envFiles', () => {
  it('flags real env files and allows templates', () => {
    expect(envFiles(['.env', 'api/.env.local', '.env.production', '.env.example', 'src/env.ts', 'docs/.envrc'])).toEqual([
      '.env',
      'api/.env.local',
      '.env.production',
    ]);
  });
});

describe('file hook helpers', () => {
  it('prefers the {{filePath}} argument and falls back to STDIN fields', () => {
    expect(savedFilePath(['src/a.ts'], {})).toBe('src/a.ts');
    expect(savedFilePath(['{{filePath}}'], { file_path: 'src/b.ts' })).toBe('src/b.ts');
    expect(savedFilePath([], { tool_input: { path: 'src/c.tsx' } })).toBe('src/c.tsx');
    expect(savedFilePath([], {})).toBeNull();
  });

  it('makes paths repo-relative and rejects outside paths', () => {
    expect(toRepoRelative('/r/proj/src/a.ts', '/r/proj')).toBe('src/a.ts');
    expect(toRepoRelative('./src/a.ts', '/r/proj')).toBe('src/a.ts');
    expect(toRepoRelative('/elsewhere/a.ts', '/r/proj')).toBeNull();
    expect(toRepoRelative('../a.ts', '/r/proj')).toBeNull();
  });

  it('watches only TypeScript sources under src/', () => {
    expect(isWatchedSource('src/domain/status.ts')).toBe(true);
    expect(isWatchedSource('src/ui/App.tsx')).toBe(true);
    expect(isWatchedSource('src/styles.css')).toBe(false);
    expect(isWatchedSource('tests/smoke.test.ts')).toBe(false);
    expect(isWatchedSource(null)).toBe(false);
  });
});

describe('toolFailed', () => {
  it('reads common exit status fields and treats unknown shapes as success', () => {
    expect(toolFailed({ tool_response: { exit_code: 1 } })).toBe(true);
    expect(toolFailed({ tool_response: { exitCode: 0 } })).toBe(false);
    expect(toolFailed({ tool_response: { success: false } })).toBe(true);
    expect(toolFailed({ tool_response: 'ok' })).toBe(false);
    expect(toolFailed({})).toBe(false);
  });
});
