// Validates: deadline-engine R4.1, R4.2. The domain must never read the clock, the DOM
// or storage, so property tests can drive `now` freely (deadline-domain.md purity rule).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const domainDir = fileURLToPath(new URL('../../src/domain/', import.meta.url));

const FORBIDDEN: Array<[RegExp, string]> = [
  [/\bDate\.now\s*\(/, 'Date.now()'],
  [/\bnew\s+Date\s*\(\s*\)/, 'new Date()'],
  [/\bperformance\.now\s*\(/, 'performance.now()'],
  [/\bTemporal\.Now\b/, 'Temporal.Now'],
  [/\bdocument\./, 'document'],
  [/\bwindow\./, 'window'],
  [/\bnavigator\./, 'navigator'],
  [/\blocalStorage\b/, 'localStorage'],
  [/\bsessionStorage\b/, 'sessionStorage'],
  [/\bindexedDB\b/, 'indexedDB'],
];

/** Removes // and /* *\/ comments so prose that names a forbidden call does not trip the scan. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function domainSources(): string[] {
  return readdirSync(domainDir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => path.join(domainDir, f));
}

describe('domain purity', () => {
  it('scans at least the core modules', () => {
    const names = domainSources().map((f) => path.basename(f));
    expect(names).toEqual(expect.arrayContaining(['status.ts', 'actions.ts', 'time.ts', 'types.ts', 'visual.ts']));
  });

  it.each(domainSources().map((f) => [path.relative(domainDir, f), f]))(
    'src/domain/%s reads no clock, DOM or storage',
    (_name, file) => {
      const code = stripComments(readFileSync(file, 'utf8'));
      const hits = FORBIDDEN.filter(([re]) => re.test(code)).map(([, label]) => label);
      expect(hits).toEqual([]);
    },
  );

  it('the scanner catches a forbidden call', () => {
    const code = stripComments('const t = Date.now(); // fine in a comment: performance.now()');
    expect(FORBIDDEN.filter(([re]) => re.test(code)).map(([, l]) => l)).toEqual(['Date.now()']);
  });
});
