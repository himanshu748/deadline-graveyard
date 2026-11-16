// Validates: accessible-list-view R2.1 to R2.4, R3.4; graveyard-scene R3.4 (in a real browser).
// Each test starts from an empty graveyard (intro skipped, demo cleared, see helpers.ts) and adds
// its own deadlines through the form, so no demo data is involved.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { startEmpty } from './helpers.ts';

async function addDeadline(page: Page, title: string, daysAhead: number, hoursAhead = 0) {
  const due = new Date(Date.now() + daysAhead * 86_400_000 + hoursAhead * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  await page.getByRole('button', { name: 'Add deadline' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(title);
  await dialog.getByLabel('Date').fill(`${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`);
  await dialog.getByLabel('Time', { exact: true }).fill(`${pad(due.getHours())}:${pad(due.getMinutes())}`);
  await dialog.getByRole('button', { name: 'Light the candle' }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  (page as Page & { errors?: string[] }).errors = errors;
  await startEmpty(page);
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { errors?: string[] }).errors ?? []).toEqual([]);
});

test('keyboard: one Tab stop, arrow keys, Enter opens, Escape returns focus', async ({ page }) => {
  await addDeadline(page, 'Essay', 5);
  await addDeadline(page, 'Grant form', 0, 3);
  const items = page.locator('.scene-item');
  await expect(items).toHaveCount(2);
  await expect(page.locator('.scene-item[tabindex="0"]')).toHaveCount(1);

  await page.locator('.scene-item[tabindex="0"]').focus();
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^Grant form, due soon, due /);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^Essay, active, due /);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Essay' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^Essay, active/);
  await page.screenshot({ path: 'test-results/scene-focus.png' });
});

test('skip link moves focus to the list view heading', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to the list view' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Every grave, in words' })).toBeFocused();
});

test('axe finds no violations in the scene view or the list only view', async ({ page }) => {
  await addDeadline(page, 'Essay', 5);
  await addDeadline(page, 'Grant form', 0, 3);
  await page.getByRole('button', { name: /^Mark submitted.*Essay/ }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'List only' }).click();
  await expect(page.locator('svg.scene')).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Add deadline' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('reduced motion: flames stay still; full motion: flames flicker', async ({ page }) => {
  await addDeadline(page, 'Grant form', 0, 3);
  const flame = page.locator('[data-flame]').first();
  const sample = async () => {
    const a = await flame.getAttribute('transform');
    await page.waitForTimeout(350);
    return a !== (await flame.getAttribute('transform'));
  };
  await expect(page.locator('svg.scene')).toHaveAttribute('data-motion', 'full');
  expect(await sample()).toBe(true);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('svg.scene')).toHaveAttribute('data-motion', 'reduced');
  expect(await sample()).toBe(false);
  await page.screenshot({ path: 'test-results/scene-reduced.png' });
});
