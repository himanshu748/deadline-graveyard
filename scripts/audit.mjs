#!/usr/bin/env node
// npm run audit:a11y (also run by the a11y-lighthouse-on-build Kiro hook after `npm run build`).
//
// Serves the existing dist/ with Vite preview on a fixed port, runs Lighthouse (mobile and desktop
// presets; performance, accessibility, best practices, SEO) and axe (through Playwright, in normal
// and reduced motion) against it, then writes reports/raw/*.json (gitignored) and
// reports/summary.md (committed). It never builds: run `npm run build` first.
//
// Exit 0 when every run finished and axe found no serious or critical violation; exit 1 otherwise.
// Lighthouse scores are recorded as measured and never gate the exit code.
//
// Environment: AUDIT_PORT (default 4374 on 127.0.0.1, apart from the e2e server on 4373 and from
// Vite's default 4173, which other projects on the same machine also use) and CHROME_PATH
// (the Chrome for Lighthouse; otherwise the installed Chrome that chrome-launcher finds, otherwise
// Playwright's Chromium from `npx playwright install chromium`).
//
// Docs followed: Lighthouse Node API https://github.com/GoogleChrome/lighthouse/blob/main/docs/readme.md
// (flags, config as the 3rd argument, desktop preset = core/config/desktop-config.js), chrome-launcher
// launch options (its README), Vite preview() https://vite.dev/guide/api-javascript#preview and
// @axe-core/playwright https://playwright.dev/docs/accessibility-testing
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { preview } from 'vite';
import { CATEGORIES, auditFailed, categoryScores, countByImpact, failedAudits, keyMetrics, renderSummary } from './audit-lib.mjs';

const root = path.resolve(import.meta.dirname, '..');
const port = Number(process.env.AUDIT_PORT ?? 4374);
const url = `http://127.0.0.1:${port}/`;
const rawDir = path.join(root, 'reports', 'raw');
const summaryPath = path.join(root, 'reports', 'summary.md');

/** @param {string} cmd @param {string[]} args */
const output = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
};
/** @param {unknown} e */
const message = (e) => (e instanceof Error ? e.message : String(e)).split('\n')[0] ?? 'unknown error';

if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  process.stderr.write('audit: dist/index.html is missing. Run `npm run build` first; this script does not build.\n');
  process.exit(1);
}
mkdirSync(rawDir, { recursive: true });

const started = Date.now();
const loadStart = os.loadavg();
const sha = output('git', ['rev-parse', '--short', 'HEAD']) || 'unknown';
const dirty = output('git', ['status', '--porcelain', '--', '.', ':(exclude)reports']) !== '';

/** The Chrome for Lighthouse and a readable name for the summary. */
function lighthouseChrome() {
  let chromePath = process.env.CHROME_PATH ?? '';
  let source = 'CHROME_PATH';
  if (!chromePath) {
    try {
      chromePath = chromeLauncher.getChromePath();
      source = 'installed Chrome found by chrome-launcher';
    } catch {
      chromePath = chromium.executablePath();
      source = "Playwright's Chromium";
    }
  }
  const version = output(chromePath, ['--version']) || 'version unknown';
  return { chromePath, name: `${version} (${source}), headless` };
}

/**
 * One Lighthouse run in its own Chrome with a fresh profile (chrome-launcher's default).
 * @param {'mobile' | 'desktop'} preset
 * @param {string} chromePath
 * @returns {Promise<{ run: import('./audit-lib.mjs').LighthouseRun, version: string }>}
 */
async function runLighthouse(preset, chromePath) {
  const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ['--headless=new'] });
  try {
    const flags = { port: chrome.port, output: /** @type {'json'} */ ('json'), logLevel: /** @type {'error'} */ ('error'), onlyCategories: [...CATEGORIES] };
    const result = await lighthouse(url, flags, preset === 'desktop' ? desktopConfig : undefined);
    if (!result) throw new Error('Lighthouse returned no result');
    writeFileSync(path.join(rawDir, `lighthouse-${preset}.json`), String(result.report));
    const lhr = result.lhr;
    /** @type {import('./audit-lib.mjs').LighthouseRun} */
    const run = { preset, scores: categoryScores(lhr), metrics: keyMetrics(lhr), failed: failedAudits(lhr) };
    if (lhr.runtimeError) run.error = `${lhr.runtimeError.code}: ${lhr.runtimeError.message}`;
    return { run, version: lhr.lighthouseVersion };
  } catch (e) {
    return { run: { preset, scores: null, metrics: [], failed: [], error: message(e) }, version: '' };
  } finally {
    chrome.kill();
  }
}

/**
 * axe on the main states of the app, one fresh context per motion mode. Each scan covers the whole
 * page. A step that fails to run is recorded as an error for that state, never as zero violations.
 * @param {import('@playwright/test').Browser} browser
 * @param {'no-preference' | 'reduce'} motion
 * @param {unknown[]} raw
 */
async function axeScans(browser, motion, raw) {
  /** @type {import('./audit-lib.mjs').AxeScan[]} */
  const scans = [];
  let engine = '';
  const context = await browser.newContext({ reducedMotion: motion, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const dialog = page.locator('dialog[open]');
  const closeDialog = async () => {
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'detached' });
  };

  /** @param {string} state @param {() => Promise<void>} prepare */
  const scan = async (state, prepare) => {
    try {
      await prepare();
      const result = await new AxeBuilder({ page }).analyze();
      engine = result.testEngine.version;
      scans.push({
        state,
        motion,
        counts: countByImpact(result.violations),
        violations: result.violations.map((v) => ({ id: v.id, impact: v.impact ?? 'minor', help: v.help, nodes: v.nodes.length })),
      });
      raw.push({ state, motion, violations: result.violations, incomplete: result.incomplete.map((v) => v.id), passes: result.passes.length });
    } catch (e) {
      scans.push({ state, motion, counts: null, violations: [], error: message(e) });
    }
  };

  await scan('First visit, intro open over the 3 Demo deadlines', async () => {
    await page.goto(url);
    await page.getByRole('dialog', { name: /^First visit/ }).waitFor();
  });
  await scan('Scene and list view after Skip intro', async () => {
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await dialog.waitFor({ state: 'detached' });
    await page.locator('.scene-item').nth(2).waitFor();
  });
  await scan('Detail panel of the missed Demo deadline', async () => {
    await page.locator('.list-view .entry[data-id="demo-c"]').getByRole('button', { name: /^Details/ }).click();
    await dialog.waitFor();
  });
  await scan('Add deadline form', async () => {
    await closeDialog();
    await page.getByRole('button', { name: 'Add deadline' }).click();
    await dialog.waitFor();
  });
  await scan('Export and settings dialog', async () => {
    await closeDialog();
    await page.getByRole('button', { name: 'Export and settings' }).click();
    await dialog.waitFor();
  });
  await scan('Séance, first question', async () => {
    await closeDialog();
    await page.getByRole('button', { name: 'Hold a séance' }).click();
    await page.getByRole('heading', { name: 'Which spirits are restless?' }).waitFor();
  });
  await scan('List only view', async () => {
    await closeDialog();
    await page.getByRole('button', { name: 'List only' }).click();
    await page.locator('svg.scene').waitFor({ state: 'detached' });
  });
  await context.close();
  return { scans, engine };
}

let server;
try {
  server = await preview({ root, configFile: path.join(root, 'vite.config.ts'), logLevel: 'warn', preview: { host: '127.0.0.1', port, strictPort: true, open: false } });
} catch (e) {
  process.stderr.write(`audit: could not serve dist/ on port ${port} (${message(e)}). Stop whatever uses it or set AUDIT_PORT.\n`);
  process.exit(1);
}

/** @type {import('./audit-lib.mjs').AuditRun} */
let run;
try {
  const chrome = lighthouseChrome();
  const mobile = await runLighthouse('mobile', chrome.chromePath);
  const desktop = await runLighthouse('desktop', chrome.chromePath);

  const browser = await chromium.launch();
  /** @type {unknown[]} */
  const raw = [];
  const normal = await axeScans(browser, 'no-preference', raw);
  const reduced = await axeScans(browser, 'reduce', raw);
  const axeBrowser = `Playwright Chromium ${browser.version()}, headless`;
  await browser.close();
  writeFileSync(path.join(rawDir, 'axe.json'), JSON.stringify(raw, null, 2));

  run = {
    date: `${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    sha,
    dirty,
    url,
    durationS: Math.round((Date.now() - started) / 1000),
    load: { start: loadStart, end: os.loadavg(), cpus: os.availableParallelism() },
    lighthouse: { version: mobile.version || desktop.version || 'unknown', browser: chrome.name, runs: [mobile.run, desktop.run] },
    axe: { version: normal.engine || reduced.engine || 'unknown', browser: axeBrowser, scans: [...normal.scans, ...reduced.scans] },
  };
} finally {
  await server.close();
}

const previous = existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8') : '';
const summary = renderSummary(run, previous);
writeFileSync(summaryPath, summary);
process.stdout.write(summary);
process.exit(auditFailed(run) ? 1 : 0);
