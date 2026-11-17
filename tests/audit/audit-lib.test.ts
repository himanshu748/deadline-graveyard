// Unit tests for the pure summary logic of scripts/audit.mjs. Inputs are small hand-written
// Lighthouse and axe result shapes, not copies of real reports.
import { describe, expect, it } from 'vitest';
import {
  RUN_LOG_END,
  RUN_LOG_MAX,
  RUN_LOG_START,
  auditFailed,
  axeTotals,
  categoryScores,
  countByImpact,
  failedAudits,
  keyMetrics,
  parseRunLog,
  renderSummary,
  runLogRow,
} from '../../scripts/audit-lib.mjs';

type Run = Parameters<typeof renderSummary>[0];

const lhr = {
  categories: {
    performance: { score: 0.634, auditRefs: [{ id: 'total-blocking-time' }, { id: 'first-contentful-paint' }, { id: 'diag' }] },
    accessibility: { score: 1, auditRefs: [{ id: 'color-contrast' }, { id: 'manual-check' }, { id: 'na' }] },
    'best-practices': { score: 0.955, auditRefs: [{ id: 'errors-in-console' }, { id: 'errors-in-console' }] },
    seo: { score: 0.9, auditRefs: [{ id: 'robots-txt' }, { id: 'broken' }] },
  },
  audits: {
    'total-blocking-time': { id: 'total-blocking-time', title: 'Total Blocking Time', score: 0.17, scoreDisplayMode: 'numeric', displayValue: '1,360 ms' },
    'first-contentful-paint': { id: 'first-contentful-paint', title: 'First Contentful Paint', score: 0.9, scoreDisplayMode: 'numeric', displayValue: '1.8 s' },
    diag: { id: 'diag', title: 'Some insight', score: 0, scoreDisplayMode: 'metricSavings' },
    'color-contrast': { id: 'color-contrast', title: 'Contrast', score: 1, scoreDisplayMode: 'binary' },
    'manual-check': { id: 'manual-check', title: 'Manual', score: null, scoreDisplayMode: 'manual' },
    na: { id: 'na', title: 'Not applicable', score: null, scoreDisplayMode: 'notApplicable' },
    'errors-in-console': { id: 'errors-in-console', title: 'Browser errors were logged to the console', score: 0, scoreDisplayMode: 'binary' },
    'robots-txt': { id: 'robots-txt', title: 'robots.txt is not valid', score: 0, scoreDisplayMode: 'binary', displayValue: '15 errors | found' },
    broken: { id: 'broken', title: 'Broken audit', score: null, scoreDisplayMode: 'error' },
  },
};

function run(overrides: Partial<Run> = {}): Run {
  return {
    date: '2026-11-16 18:07 UTC',
    sha: 'abc1234',
    dirty: false,
    url: 'http://localhost:4174/',
    durationS: 120,
    load: { start: [4.25, 3, 2], end: [5, 4, 3], cpus: 10 },
    lighthouse: {
      version: '12.8.2',
      browser: 'Chrome',
      runs: [
        { preset: 'mobile', scores: categoryScores(lhr), metrics: keyMetrics(lhr), failed: failedAudits(lhr) },
        { preset: 'desktop', scores: { performance: 91, accessibility: 100, 'best-practices': 100, seo: 100 }, metrics: [], failed: [] },
      ],
    },
    axe: {
      version: '4.14.0',
      browser: 'Chromium',
      scans: [
        { state: 'Scene', motion: 'no-preference', counts: { critical: 0, serious: 0, moderate: 1, minor: 0 }, violations: [{ id: 'region', impact: 'moderate', help: 'Content in landmarks', nodes: 2 }] },
        { state: 'Scene', motion: 'reduce', counts: { critical: 0, serious: 0, moderate: 0, minor: 0 }, violations: [] },
      ],
    },
    ...overrides,
  };
}

describe('categoryScores', () => {
  it('rounds each category to a whole number like the Lighthouse report', () => {
    expect(categoryScores(lhr)).toEqual({ performance: 63, accessibility: 100, 'best-practices': 96, seo: 90 });
  });

  it('gives null, never 0, for a missing or unscored category', () => {
    expect(categoryScores({ categories: { performance: { score: null } } })).toEqual({ performance: null, accessibility: null, 'best-practices': null, seo: null });
  });
});

describe('failedAudits', () => {
  it('lists scored audits below 0.9 and errors once per category, and skips manual and not-applicable ones', () => {
    expect(failedAudits(lhr).map((f) => `${f.category}:${f.id}`)).toEqual([
      'performance:total-blocking-time',
      'performance:diag',
      'best-practices:errors-in-console',
      'seo:robots-txt',
      'seo:broken',
    ]);
  });

  it('keeps the score at exactly 0.9 as passed', () => {
    expect(failedAudits(lhr).some((f) => f.id === 'first-contentful-paint')).toBe(false);
  });
});

describe('keyMetrics', () => {
  it('shows n/a for a metric the report does not have', () => {
    const metrics = keyMetrics(lhr);
    expect(metrics.map((m) => m.label)).toEqual(['First Contentful Paint', 'Largest Contentful Paint', 'Total Blocking Time', 'Cumulative Layout Shift', 'Speed Index']);
    expect(metrics[0]?.value).toBe('1.8 s');
    expect(metrics[1]?.value).toBe('n/a');
  });
});

describe('axe counting', () => {
  it('counts rules per impact and treats a missing impact as minor', () => {
    expect(countByImpact([{ id: 'a', impact: 'serious', nodes: [] }, { id: 'b', impact: 'serious', nodes: [] }, { id: 'c', impact: null, nodes: [] }])).toEqual({
      critical: 0,
      serious: 2,
      moderate: 0,
      minor: 1,
    });
  });

  it('counts a scan that failed to run as an error, not as zero violations', () => {
    const scans = [...run().axe.scans, { state: 'Broken', motion: 'reduce', counts: null, violations: [], error: 'timeout' }];
    expect(axeTotals(scans)).toEqual({ critical: 0, serious: 0, moderate: 1, minor: 0, errors: 1 });
    expect(auditFailed(run({ axe: { version: '4', browser: 'x', scans } }))).toBe(true);
  });
});

describe('auditFailed', () => {
  it('passes with moderate axe findings and low Lighthouse scores, since scores never gate', () => {
    expect(auditFailed(run())).toBe(false);
  });

  it('fails on a serious axe violation', () => {
    const scans = [{ state: 'S', motion: 'reduce', counts: { critical: 0, serious: 1, moderate: 0, minor: 0 }, violations: [] }];
    expect(auditFailed(run({ axe: { version: '4', browser: 'x', scans } }))).toBe(true);
  });

  it('fails when a Lighthouse run errored', () => {
    const base = run();
    const runs = [{ preset: 'mobile', scores: null, metrics: [], failed: [], error: 'NO_FCP' }, ...base.lighthouse.runs.slice(1)];
    expect(auditFailed(run({ lighthouse: { ...base.lighthouse, runs } }))).toBe(true);
  });
});

describe('run log', () => {
  it('writes one row with both presets, the axe totals and the 1 minute load', () => {
    expect(runLogRow(run())).toBe('| 2026-11-16 18:07 UTC | abc1234 | 63 / 100 / 96 / 90 | 91 / 100 / 100 / 100 | 0 | 1 | 4.3 |');
    expect(runLogRow(run({ dirty: true }))).toContain('abc1234 (uncommitted changes)');
  });

  it('carries earlier rows forward, newest first, and drops the oldest past the limit', () => {
    const first = renderSummary(run({ sha: 'aaaaaaa' }), '');
    const second = renderSummary(run({ sha: 'bbbbbbb' }), first);
    const rows = parseRunLog(second);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('bbbbbbb');
    expect(rows[1]).toContain('aaaaaaa');

    let summary = '';
    for (let i = 0; i < RUN_LOG_MAX + 5; i++) summary = renderSummary(run({ sha: `sha${i}` }), summary);
    const kept = parseRunLog(summary);
    expect(kept).toHaveLength(RUN_LOG_MAX);
    expect(kept[0]).toContain(`sha${RUN_LOG_MAX + 4}`);
  });

  it('ignores a file without the markers and skips the header and separator rows', () => {
    expect(parseRunLog('# Something else\n| a | b |')).toEqual([]);
    expect(parseRunLog(`${RUN_LOG_START}\n| Date | Commit |\n|---|---|\n| x | y |\n${RUN_LOG_END}`)).toEqual(['| x | y |']);
  });
});

describe('renderSummary', () => {
  it('includes the scores table, the failed audits, every axe scan and the measured load', () => {
    const md = renderSummary(run(), '');
    expect(md).toContain('| mobile | 63 | 100 | 96 | 90 |');
    expect(md).toContain('| desktop | 91 | 100 | 100 | 100 |');
    expect(md).toContain('| seo | robots.txt is not valid (`robots-txt`) | 0 | 15 errors \\| found |');
    expect(md).toContain('| Scene | no-preference | 0 | 0 | 1 | 0 |');
    expect(md).toContain('- Scene (no-preference): `region` (moderate, 2 nodes): Content in landmarks');
    expect(md).toContain('Serious or critical in total: 0. All impacts: 1.');
    expect(md).toContain('4.3, 3.0, 2.0 at the start');
    expect(md).toContain('- Commit: abc1234 (working tree clean outside reports/)');
  });

  it('writes "error" for a preset without scores instead of a number', () => {
    const base = run();
    const runs = [{ preset: 'mobile', scores: null, metrics: [], failed: [], error: 'PROTOCOL_TIMEOUT: Chrome did not respond' }, ...base.lighthouse.runs.slice(1)];
    const md = renderSummary(run({ lighthouse: { ...base.lighthouse, runs } }), '');
    expect(md).toContain('| mobile | error | error | error | error |');
    expect(md).toContain('Error: PROTOCOL_TIMEOUT: Chrome did not respond');
  });
});
