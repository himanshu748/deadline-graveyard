// Pure helpers shared by the Kiro hook scripts in scripts/hooks/.
// Everything here is side-effect free so it can be unit-tested in
// tests/hooks/. The scripts do the I/O (STDIN, git, npm) themselves.
//
// Hook event shape (Kiro docs, https://kiro.dev/docs/hooks/types.md):
//   { "hook_event_name": "PreToolUse", "cwd": "...", "session_id": "...",
//     "tool_name": "execute_bash", "tool_input": { ... } }
// The docs show tool_input for an MCP tool but not for execute_bash, so
// shellCommandOf() reads tool_input.command first and falls back to any
// string value in tool_input.

/**
 * @typedef {{ [key: string]: unknown }} HookEvent
 * @typedef {{ file: string, line: number, kind: string }} SecretFinding
 */

/**
 * Parse the JSON hook event from STDIN text. Invalid or empty input gives {}.
 * @param {string} text
 * @returns {HookEvent}
 */
export function parseEvent(text) {
  if (!text || !text.trim()) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/**
 * Extract the shell command from a PreToolUse or PostToolUse event.
 * @param {HookEvent} event
 * @returns {string | null}
 */
export function shellCommandOf(event) {
  const input = event.tool_input;
  if (typeof input === 'string') return input;
  if (!input || typeof input !== 'object') return null;
  const record = /** @type {Record<string, unknown>} */ (input);
  if (typeof record.command === 'string') return record.command;
  for (const value of Object.values(record)) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

/**
 * Split a shell command line into simple commands on ;, &&, ||, | and newlines.
 * Quotes are respected well enough for commit messages; this is a filter for
 * deciding whether to run checks, not a full shell parser.
 * @param {string} command
 * @returns {string[]}
 */
export function splitShellCommands(command) {
  /** @type {string[]} */
  const parts = [];
  let current = '';
  /** @type {string | null} */
  let quote = null;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command.charAt(i);
    const next = command.charAt(i + 1);
    if (quote) {
      current += ch;
      if (ch === '\\' && quote === '"' && i + 1 < command.length) {
        current += next;
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === ';' || ch === '\n' || ch === '|' || (ch === '&' && next === '&')) {
      parts.push(current);
      current = '';
      if ((ch === '&' && next === '&') || (ch === '|' && next === '|')) i += 1;
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const GIT_PREFIX = String.raw`^(?:\S+=\S*\s+)*(?:command\s+)?git(?:\s+(?:-C|-c)\s+\S+|\s+--\S+)*\s+`;
const GIT_COMMIT_RE = new RegExp(`${GIT_PREFIX}commit(?=\\s|$)`);
const GIT_ADD_RE = new RegExp(`${GIT_PREFIX}add(?=\\s|$)`);

/**
 * True when any simple command in the line is `git commit` (not commit-tree).
 * @param {string | null | undefined} command
 */
export function isGitCommit(command) {
  if (!command) return false;
  return splitShellCommands(command).some((part) => GIT_COMMIT_RE.test(part));
}

/**
 * True when the command line stages files itself (git add, or commit -a / --all),
 * so the guard must also look at unstaged changes.
 * @param {string | null | undefined} command
 */
export function stagesFiles(command) {
  if (!command) return false;
  return splitShellCommands(command).some(
    (part) =>
      GIT_ADD_RE.test(part) ||
      (GIT_COMMIT_RE.test(part) && /\s(?:-[a-zA-Z]*a[a-zA-Z]*|--all)(?=\s|$)/.test(part)),
  );
}

/**
 * True when any simple command is exactly `npm run build` (with optional args),
 * not `npm run build:something`.
 * @param {string | null | undefined} command
 */
export function isNpmBuild(command) {
  if (!command) return false;
  return splitShellCommands(command).some((part) =>
    /^(?:\S+=\S*\s+)*npm\s+run\s+build(?=\s|$)/.test(part),
  );
}

/**
 * Return the non-comment lines of a .gitignore that mention kiro in any form.
 * The Kiroween rules say ignoring /.kiro could disqualify the entry, so any
 * such line blocks the commit.
 * @param {string} text
 * @returns {string[]}
 */
export function gitignoreKiroLines(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && /kiro/i.test(line));
}

/** @type {Array<{ kind: string, re: RegExp }>} */
export const SECRET_PATTERNS = [
  { kind: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  {
    kind: 'AWS secret access key',
    re: /aws_?secret_?access_?key\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}\b/i,
  },
  { kind: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { kind: 'Groq API key', re: /\bgsk_[A-Za-z0-9]{20,}\b/ },
  { kind: 'Context7 API key', re: /\bctx7sk-[A-Za-z0-9-]{16,}/ },
  { kind: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b/ },
  { kind: 'private key block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/ },
];

/**
 * Scan the added lines of a unified diff (`git diff --cached -U0`) for secrets.
 * @param {string} diff
 * @returns {SecretFinding[]}
 */
export function scanDiffForSecrets(diff) {
  /** @type {SecretFinding[]} */
  const findings = [];
  let file = '(unknown)';
  let lineNo = 0;
  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const name = raw.slice(4).trim();
      file = name === '/dev/null' ? file : name.replace(/^b\//, '');
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      lineNo = Number(hunk[1]);
      continue;
    }
    if (raw.startsWith('+')) {
      const added = raw.slice(1);
      for (const { kind, re } of SECRET_PATTERNS) {
        if (re.test(added)) findings.push({ file, line: lineNo, kind });
      }
      lineNo += 1;
    } else if (!raw.startsWith('-') && !raw.startsWith('\\')) {
      lineNo += 1;
    }
  }
  return findings;
}

/**
 * Paths that look like real .env files (.env, .env.local, config/.env.production).
 * Template files such as .env.example are allowed.
 * @param {string[]} paths
 * @returns {string[]}
 */
export function envFiles(paths) {
  return paths.filter((p) => {
    const m = /(?:^|\/)\.env(?:\.([^/]+))?$/.exec(p.trim());
    if (!m) return false;
    const suffix = m[1];
    return !suffix || !/^(?:example|sample|template|dist)$/i.test(suffix);
  });
}

/**
 * Resolve the saved file path for a file hook. The hook command passes
 * {{filePath}} as arguments (documented template variable for file triggers);
 * if that was not substituted, fall back to common STDIN field names.
 * @param {string[]} argv
 * @param {HookEvent} event
 * @returns {string | null}
 */
export function savedFilePath(argv, event) {
  const fromArgs = argv.join(' ').trim();
  if (fromArgs && !fromArgs.includes('{{')) return fromArgs;
  const input =
    event.tool_input && typeof event.tool_input === 'object'
      ? /** @type {Record<string, unknown>} */ (event.tool_input)
      : {};
  for (const value of [event.file_path, event.filePath, event.path, event.file, input.path, input.file_path]) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Turn an absolute or relative path into a repo-relative POSIX path, or null
 * when it lies outside the repo.
 * @param {string} filePath
 * @param {string} root absolute repo root
 * @returns {string | null}
 */
export function toRepoRelative(filePath, root) {
  const normRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  let p = filePath.replace(/\\/g, '/');
  if (p.startsWith(`${normRoot}/`)) p = p.slice(normRoot.length + 1);
  else if (p.startsWith('/')) return null;
  p = p.replace(/^\.\//, '');
  if (p.startsWith('../')) return null;
  return p;
}

/**
 * True for TypeScript sources under src/ that tests-on-save should handle.
 * @param {string | null} relPath
 */
export function isWatchedSource(relPath) {
  return !!relPath && /^src\/.+\.(?:ts|tsx)$/.test(relPath);
}

/**
 * Best-effort check of a PostToolUse tool_response for a failed command.
 * Unknown shapes count as success so the audit still runs.
 * @param {HookEvent} event
 */
export function toolFailed(event) {
  const r = event.tool_response;
  if (!r || typeof r !== 'object') return false;
  const rec = /** @type {Record<string, unknown>} */ (r);
  for (const key of ['exit_code', 'exitCode', 'status']) {
    const v = rec[key];
    if (typeof v === 'number') return v !== 0;
  }
  return rec.success === false || rec.is_error === true;
}
