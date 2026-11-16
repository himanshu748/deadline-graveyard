// Validates: first-visit R1.1 to R1.6, R2.1, R2.2, R2.4 to R2.6, R3.1 to R3.3 in a real browser,
// against the production build. Each test is a fresh browser context, so each one is a first
// visit. The full-motion test runs the tour in real time (about 50 s) without touching it.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { introDialog } from './helpers.ts';

const TOUR_TITLES = ['Welcome to the graveyard', 'Due within 24 hours', 'Missed deadlines become graves', 'Neglected projects haunt you', 'Submitted work lights a lantern'];

/** Serious and critical axe violations on the whole page, as short readable strings. */
async function seriousViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const entry = (page: Page, id: string) => page.locator(`.list-view .entry[data-id="${id}"]`);

async function readDownload(page: Page, click: () => Promise<void>): Promise<string> {
  const download = page.waitForEvent('download');
  await click();
  const file = await download;
  let text = '';
  for await (const chunk of await file.createReadStream()) text += String(chunk);
  return text;
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  (page as Page & { errors?: string[] }).errors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { errors?: string[] }).errors ?? []).toEqual([]);
});

test('full motion: a passive viewer sees 5 captioned steps within 60 s, then keeps the labelled demo', async ({ page }) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const dialog = introDialog(page);
  await expect(dialog).toBeVisible();
  const started = Date.now();
  await expect(page.locator('svg.scene')).toHaveAttribute('data-motion', 'full');
  await expect(dialog.locator('.intro-progress')).toBeVisible();
  await expect(dialog.locator('.intro-copy')).toHaveAttribute('aria-live', 'polite');
  expect(await seriousViolations(page)).toEqual([]);
  await page.screenshot({ path: 'test-results/first-visit-step1.png' });

  // Watch the captions without pressing anything until the closing question appears (R1.2).
  const seen: string[] = [];
  const heading = dialog.getByRole('heading', { level: 2 });
  while (Date.now() - started < 70_000) {
    const title = (await heading.textContent()) ?? '';
    if (title === 'Keep the demo?') break;
    if (seen.at(-1) !== title) seen.push(title);
    await page.waitForTimeout(250);
  }
  const elapsed = Date.now() - started;
  expect(seen).toEqual(TOUR_TITLES);
  expect(elapsed).toBeLessThanOrEqual(60_000);
  await expect(heading).toHaveText('Keep the demo?');
  test.info().annotations.push({ type: 'passive tour', description: `${(elapsed / 1000).toFixed(1)} s until the keep question` });

  // A passive viewer accepted nothing, so demo item A is still a ghost (R3.3).
  await expect(page.locator('.scene-item[data-id="demo-a"]')).toHaveAttribute('data-kind', 'ghost');
  await dialog.getByRole('button', { name: 'Keep the demo' }).click();
  await expect(dialog).toBeHidden();

  // R1.5: focus lands on the first scene item (the missed one, first in due order).
  await expect(page.locator(':focus')).toHaveAttribute('data-id', 'demo-c');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^Demo: Scholarship essay, missed, .*, Demo$/);

  // R2.2: the list view labels every demo item, and the sample epitaph says it is demo text.
  await expect(page.locator('.list-view .entry')).toHaveCount(3);
  for (const id of ['demo-a', 'demo-b', 'demo-c']) {
    await expect(entry(page, id).locator('.badge-demo')).toHaveText('Demo');
    await expect(entry(page, id).locator('h4')).toContainText(/^Demo: /);
  }
  await expect(entry(page, 'demo-c').locator('.epitaph')).toContainText('Demo epitaph: start the draft a week earlier.');

  // R2.2: the .ics export carries [Demo] on every event.
  await page.getByRole('button', { name: 'Export and settings' }).click();
  const tools = page.getByRole('dialog', { name: 'Export and settings' });
  const ics = await readDownload(page, () => tools.getByRole('button', { name: 'Export to calendar (.ics)' }).click());
  expect(ics.match(/^SUMMARY:\[Demo\] Demo: .+$/gm)).toHaveLength(3);
  expect(ics.match(/^X-DG-DEMO:TRUE/gm)).toHaveLength(3);
  await tools.getByRole('button', { name: 'Done' }).click();

  // R1.1: the flag is saved, so a reload does not start the intro or seed again.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add deadline' })).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.scene-item')).toHaveCount(3);
});

test('Skip intro ends the tour at once; Replay the intro asks first and does not double the demo', async ({ page }) => {
  await page.goto('/');
  const dialog = introDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Skip intro' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(':focus')).toHaveAttribute('data-id', 'demo-c');
  await expect(page.getByTestId('demo-note')).toContainText('3 demo deadlines are in the graveyard');

  // R1.6, R2.6: replay from the menu; stored items mean a confirmation first.
  await page.getByRole('button', { name: 'Export and settings' }).click();
  const tools = page.getByRole('dialog', { name: 'Export and settings' });
  await tools.getByRole('button', { name: 'Replay the intro' }).click();
  await expect(tools.getByText('Replay the intro? It replaces the demo deadlines already here with 3 fresh ones')).toBeVisible();
  await expect(tools.getByRole('button', { name: 'Replay with demo deadlines' })).toBeFocused();
  await tools.getByRole('button', { name: 'Replay with demo deadlines' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('First visit, step 1 of 5')).toBeVisible();
  await expect(page.locator('.scene-item')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator('.list-view .entry')).toHaveCount(3);
});

test('Escape skips the intro at any step and saves the flag', async ({ page }) => {
  await page.goto('/');
  const dialog = introDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Next' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('First visit, step 2 of 5')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator(':focus')).toHaveAttribute('data-id', 'demo-c');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add deadline' })).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('reduced motion: static steps wait for Next; revive the ghost, decline the lantern, then clear the demo', async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const dialog = introDialog(page);
  await expect(dialog).toBeVisible();
  await expect(page.locator('svg.scene')).toHaveAttribute('data-motion', 'reduced');
  await expect(dialog.locator('.intro-progress')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /Pause the tour/ })).toHaveCount(0);
  await expect(dialog.getByText('Motion is reduced, so each step waits for Next.')).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // R1.4: longer than the longest full-motion step (11 s), and still on step 1.
  await page.waitForTimeout(12_500);
  await expect(dialog.getByText('First visit, step 1 of 5')).toBeVisible();
  await expect(dialog.getByRole('heading', { level: 2 })).toHaveText(TOUR_TITLES[0] ?? '');

  for (let step = 2; step <= 4; step++) {
    await dialog.getByRole('button', { name: 'Next' }).click();
    await expect(dialog.getByText(`First visit, step ${step} of 5`)).toBeVisible();
  }

  // R3.1: the ghost step invites a revive, which turns A into an active candle.
  await expect(page.locator('.scene-item[data-id="demo-a"]')).toHaveAttribute('data-kind', 'ghost');
  expect(await seriousViolations(page)).toEqual([]);
  await page.screenshot({ path: 'test-results/first-visit-ghost-reduced.png' });
  await dialog.getByRole('button', { name: 'Revive the ghost' }).click();
  await expect(dialog.getByText('Revived. Its candle burns on the ground again.')).toBeVisible();
  await expect(page.locator('.scene-item[data-id="demo-a"]')).toHaveAttribute('data-kind', 'candle');
  await expect(entry(page, 'demo-a')).toHaveAttribute('data-status', 'active');

  // R3.3: declining the lantern moves on and leaves A burning.
  await dialog.getByRole('button', { name: 'Next' }).click();
  await expect(dialog.getByText('First visit, step 5 of 5')).toBeVisible();
  await dialog.getByRole('button', { name: 'Not now' }).click();
  await expect(dialog.getByRole('heading', { name: 'Keep the demo?' })).toBeVisible();
  await expect(entry(page, 'demo-a')).toHaveAttribute('data-status', 'active');
  expect(await seriousViolations(page)).toEqual([]);

  // R2.4, R2.5: clearing removes every demo item; focus goes to Add deadline.
  await dialog.getByRole('button', { name: 'Clear demo' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('.scene-item')).toHaveCount(0);
  await expect(page.getByText('Demo', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add deadline' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add deadline' })).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.scene-item')).toHaveCount(0);
});

test('reduced motion: decline the ghost, light the lantern; the .ics then holds the 2 open demo items', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const dialog = introDialog(page);
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 3; i++) await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: 'Not now' }).click();
  await expect(dialog.getByText('First visit, step 5 of 5')).toBeVisible();
  await expect(entry(page, 'demo-a')).toHaveAttribute('data-status', 'ghost');

  // R3.2: the lantern lights on demo item A.
  await dialog.getByRole('button', { name: 'Light the lantern' }).click();
  await expect(dialog.getByText('Submitted. Its lantern now hangs lit on the fence.')).toBeVisible();
  await expect(page.locator('.scene-item[data-id="demo-a"]')).toHaveAttribute('data-kind', 'lantern');
  await dialog.getByRole('button', { name: 'Finish the tour' }).click();
  await dialog.getByRole('button', { name: 'Keep the demo' }).click();
  await expect(dialog).toBeHidden();
  await expect(entry(page, 'demo-a')).toHaveAttribute('data-status', 'submitted');

  await page.getByRole('button', { name: 'Export and settings' }).click();
  const tools = page.getByRole('dialog', { name: 'Export and settings' });
  const ics = await readDownload(page, () => tools.getByRole('button', { name: 'Export to calendar (.ics)' }).click());
  expect(ics.match(/^SUMMARY:.+$/gm)?.sort()).toEqual(['SUMMARY:[Demo] Demo: Course project report', 'SUMMARY:[Demo] Demo: Scholarship essay']);
});
