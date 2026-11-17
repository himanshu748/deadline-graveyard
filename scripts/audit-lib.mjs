// Pure helpers for scripts/audit.mjs: turn Lighthouse and axe results into reports/summary.md.
// No I/O here, so tests/audit/audit-lib.test.ts can check every rule with hand-written inputs.

export const CATEGORIES = /** @type {const} */ (['performance', 'accessibility', 'best-practices', 'seo']);
export const IMPACTS = /** @type {const} */ (['critical', 'serious', 'moderate', 'minor']);
export const RUN_LOG_START = '<!-- run-log:start -->';
export const RUN_LOG_END = '<!-- run-log:end -->';
/** Older rows than this are dropped from the run log. */
export const RUN_LOG_MAX = 30;
/** The Lighthouse report shows an audit as passed from this score up (its PASS_THRESHOLD). */
export const PASS_THRESHOLD = 0.9;

/** @typedef {typeof CATEGORIES[number]} CategoryId */
/** @typedef {Record<CategoryId, number | null>} Scores */
/** @typedef {Record<typeof IMPACTS[number], number>} ImpactCounts */
/**
 * @typedef {{ id: string, title: string, score: number | null, scoreDisplayMode: string, displayValue?: string }} LhAudit
 * @typedef {{ score: number | null, auditRefs?: { id: string }[] }} LhCategory
 * @typedef {{ categories?: Partial<Record<string, LhCategory>>, audits?: Record<string, LhAudit>, runtimeError?: { code: string, message: string } }} Lhr
 */
/** @typedef {{ id: string, impact?: string | null, help?: string, nodes: { target: unknown[] }[] }} AxeViolation */
/**
 * @typedef {{ preset: string, scores: Scores | null, metrics: { label: string, value: string }[], failed: FailedAudit[], error?: string }} LighthouseRun
 * @typedef {{ category: CategoryId, id: string, title: string, score: number | null, displayValue: string }} FailedAudit
 * @typedef {{ state: string, motion: string, counts: ImpactCounts | null, violations: { id: string, impact: string, help: string, nodes: number }[], error?: string }} AxeScan
 * @typedef {{
 *   date: string, sha: string, dirty: boolean, url: string, durationS: number,
 *   load: { start: number[], end: number[], cpus: number },
 *   lighthouse: { version: string, browser: string, runs: LighthouseRun[] },
 *   axe: { version: string, browser: string, scans: AxeScan[] },
 * }} AuditRun
 */

/**
 * Category scores as whole numbers from 0 to 100, rounded the way the Lighthouse report shows them.
 * A category that is missing or has no score (for example after a runtime error) is null.
 * @param {Lhr} lhr
 * @returns {Scores}
 */
export function categoryScores(lhr) {
  const out = /** @type {Scores} */ ({});
  for (const id of CATEGORIES) {
    const score = lhr.categories?.[id]?.score;
    out[id] = typeof score === 'number' ? Math.round(score * 100) : null;
  }
  return out;
}

const METRICS = [
  ['first-contentful-paint', 'First Contentful Paint'],
  ['largest-contentful-paint', 'Largest Contentful Paint'],
  ['total-blocking-time', 'Total Blocking Time'],
  ['cumulative-layout-shift', 'Cumulative Layout Shift'],
  ['speed-index', 'Speed Index'],
];

/**
 * The five lab metrics behind the performance score, as Lighthouse displays them.
 * @param {Lhr} lhr
 */
export function keyMetrics(lhr) {
  return METRICS.map(([id, label]) => ({ label: label ?? '', value: lhr.audits?.[id ?? '']?.displayValue ?? 'n/a' }));
}

/**
 * Audits in the four categories that the Lighthouse report would not show as passed: a numeric or
 * binary score below PASS_THRESHOLD, or an error. Manual, informative and not-applicable audits
 * have no pass or fail, so they are left out. Each audit is listed once per category.
 * @param {Lhr} lhr
 * @returns {FailedAudit[]}
 */
export function failedAudits(lhr) {
  /** @type {FailedAudit[]} */
  const out = [];
  for (const category of CATEGORIES) {
    const seen = new Set();
    for (const ref of lhr.categories?.[category]?.auditRefs ?? []) {
      const audit = lhr.audits?.[ref.id];
      if (!audit || seen.has(ref.id)) continue;
      seen.add(ref.id);
      const scored = audit.scoreDisplayMode === 'numeric' || audit.scoreDisplayMode === 'binary' || audit.scoreDisplayMode === 'metricSavings';
      const failed = audit.scoreDisplayMode === 'error' || (scored && typeof audit.score === 'number' && audit.score < PASS_THRESHOLD);
      if (failed) out.push({ category, id: ref.id, title: audit.title, score: audit.score, displayValue: audit.displayValue ?? '' });
    }
  }
  return out;
}

/**
 * Number of axe violations (rules, not nodes) per impact. axe leaves impact null only for rules
 * that passed, so a missing impact on a violation is counted as minor rather than dropped.
 * @param {AxeViolation[]} violations
 * @returns {ImpactCounts}
 */
export function countByImpact(violations) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) {
    const impact = IMPACTS.find((i) => i === v.impact) ?? 'minor';
    counts[impact] += 1;
  }
  return counts;
}

/**
 * Totals over every axe scan. A scan that errored counts in `errors`, not as zero violations.
 * @param {AxeScan[]} scans
 */
export function axeTotals(scans) {
  const totals = { critical: 0, serious: 0, moderate: 0, minor: 0, errors: 0 };
  for (const s of scans) {
    if (!s.counts) {
      totals.errors += 1;
      continue;
    }
    for (const i of IMPACTS) totals[i] += s.counts[i];
  }
  return totals;
}

/**
 * The audit fails when a Lighthouse run errored, an axe scan errored, or axe found a serious or
 * critical violation. Lighthouse scores are recorded, never used as a gate.
 * @param {AuditRun} run
 */
export function auditFailed(run) {
  const t = axeTotals(run.axe.scans);
  return run.lighthouse.runs.some((r) => r.error !== undefined || r.scores === null) || t.errors > 0 || t.serious + t.critical > 0;
}

/**
 * Previous run-log rows from an earlier summary.md (the table body between the markers).
 * @param {string} markdown
 * @returns {string[]}
 */
export function parseRunLog(markdown) {
  const start = markdown.indexOf(RUN_LOG_START);
  const end = markdown.indexOf(RUN_LOG_END);
  if (start < 0 || end < start) return [];
  return markdown
    .slice(start + RUN_LOG_START.length, end)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && !l.startsWith('| Date') && !/^\|[\s|:-]+\|$/.test(l));
}

/** @param {number | null} n */
const score = (n) => (n === null ? 'error' : String(n));

/** @param {Scores | null} s */
const scoreLine = (s) => (s ? CATEGORIES.map((c) => score(s[c])).join(' / ') : 'error');

/**
 * One run-log row: date, commit, both Lighthouse presets, axe totals and the load at the start.
 * @param {AuditRun} run
 */
export function runLogRow(run) {
  const t = axeTotals(run.axe.scans);
  /** @param {string} name */
  const preset = (name) => scoreLine(run.lighthouse.runs.find((r) => r.preset === name)?.scores ?? null);
  const all = t.critical + t.serious + t.moderate + t.minor;
  const axe = t.errors > 0 ? `${t.serious + t.critical} (${t.errors} scan errors)` : String(t.serious + t.critical);
  return `| ${run.date} | ${run.sha}${run.dirty ? ' (uncommitted changes)' : ''} | ${preset('mobile')} | ${preset('desktop')} | ${axe} | ${all} | ${run.load.start[0]?.toFixed(1) ?? 'n/a'} |`;
}

/** @param {string} text */
const cell = (text) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/**
 * The whole reports/summary.md for one run, with the run log carried over from the previous file.
 * @param {AuditRun} run
 * @param {string} previous the earlier summary.md, or '' when there is none
 */
export function renderSummary(run, previous) {
  const rows = [runLogRow(run), ...parseRunLog(previous)].slice(0, RUN_LOG_MAX);
  const t = axeTotals(run.axe.scans);
  const lines = [
    '# Audit summary',
    '',
    'Written by `npm run audit:a11y` (`scripts/audit.mjs`) from the run described below. Do not edit by hand; KIRO_USAGE.md quotes these numbers.',
    '',
    `- Date: ${run.date}`,
    `- Commit: ${run.sha}${run.dirty ? ' (with uncommitted changes outside reports/)' : ' (working tree clean outside reports/)'}`,
    `- Page: ${run.url} (the built \`dist/\` served by Vite preview), opened in a fresh browser profile, so it is a first visit: 3 Demo deadlines are seeded and the intro is open`,
    `- Lighthouse ${run.lighthouse.version} in ${run.lighthouse.browser}, categories ${CATEGORIES.join(', ')}, one run per preset (mobile is the default config, desktop is \`desktop-config.js\`)`,
    `- axe-core ${run.axe.version} through @axe-core/playwright in ${run.axe.browser}, all rules on, viewport 1280x800`,
    `- Machine load average (1, 5, 15 min) on ${run.load.cpus} cores: ${run.load.start.map((n) => n.toFixed(1)).join(', ')} at the start, ${run.load.end.map((n) => n.toFixed(1)).join(', ')} at the end. A busy machine lowers the performance score.`,
    `- Duration: ${run.durationS} s`,
    '',
    '## Lighthouse',
    '',
    '| Preset | Performance | Accessibility | Best practices | SEO |',
    '|---|---|---|---|---|',
    ...run.lighthouse.runs.map((r) => `| ${r.preset} | ${CATEGORIES.map((c) => score(r.scores ? r.scores[c] : null)).join(' | ')} |`),
    '',
  ];
  for (const r of run.lighthouse.runs) {
    lines.push(`### ${r.preset}`, '');
    if (r.error) lines.push(`Error: ${cell(r.error)}`, '');
    if (r.metrics.length > 0) {
      lines.push('| Metric | Value |', '|---|---|', ...r.metrics.map((m) => `| ${m.label} | ${cell(m.value)} |`), '');
    }
    if (r.failed.length === 0) {
      lines.push('No scored audit below 0.9.', '');
    } else {
      lines.push('Audits below 0.9 (the report would not show them as passed):', '', '| Category | Audit | Score | Value |', '|---|---|---|---|');
      for (const f of r.failed) lines.push(`| ${f.category} | ${cell(f.title)} (\`${f.id}\`) | ${f.score === null ? 'error' : f.score} | ${cell(f.displayValue) || ' '} |`);
      lines.push('');
    }
  }
  lines.push(
    '## axe',
    '',
    `Violations are counted per rule. Serious or critical in total: ${t.serious + t.critical}. All impacts: ${t.critical + t.serious + t.moderate + t.minor}.${t.errors > 0 ? ` Scans that failed to run: ${t.errors}.` : ''}`,
    '',
    '| State | Motion | Critical | Serious | Moderate | Minor |',
    '|---|---|---|---|---|---|',
  );
  for (const s of run.axe.scans) {
    lines.push(s.counts ? `| ${cell(s.state)} | ${s.motion} | ${IMPACTS.map((i) => s.counts?.[i] ?? 0).join(' | ')} |` : `| ${cell(s.state)} | ${s.motion} | error: ${cell(s.error ?? 'unknown')} | | | |`);
  }
  const found = run.axe.scans.flatMap((s) => s.violations.map((v) => `- ${cell(s.state)} (${s.motion}): \`${v.id}\` (${v.impact}, ${v.nodes} node${v.nodes === 1 ? '' : 's'}): ${cell(v.help)}`));
  lines.push('', ...(found.length > 0 ? ['Violations found:', '', ...found] : ['No violations of any impact.']), '');
  lines.push(
    '## Run log',
    '',
    'Every run of this script, newest first (scores are performance / accessibility / best practices / SEO).',
    '',
    RUN_LOG_START,
    '| Date | Commit | Lighthouse mobile | Lighthouse desktop | axe serious + critical | axe all | Load (1 min) |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    RUN_LOG_END,
    '',
  );
  return lines.join('\n');
}
