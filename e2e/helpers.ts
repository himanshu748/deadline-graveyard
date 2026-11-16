// Shared e2e steps. A fresh browser context is a first visit: the app seeds 3 demo deadlines and
// starts the intro (first-visit R1.1). Specs that test other features start from an empty
// graveyard the way a real user gets one: skip the intro, clear the demo, then reload so the
// page starts clean (no intro, since the "intro seen" flag is now saved).
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export const introDialog = (page: Page) => page.getByRole('dialog', { name: /^First visit/ });

export async function startEmpty(page: Page) {
  await page.goto('/');
  const intro = introDialog(page);
  await expect(intro).toBeVisible();
  await intro.getByRole('button', { name: 'Skip intro' }).click();
  await expect(intro).toBeHidden();
  await page.getByTestId('demo-note').getByRole('button', { name: 'Clear demo' }).click();
  await expect(page.locator('.scene-item')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Add deadline' })).toBeEnabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Adds a timed deadline through the form, `hoursAhead` from the page's own clock (which differs
 * from the test's clock once `page.clock` has fast-forwarded). Date and time are typed in the
 * browser's zone, which is the machine's zone, as a user would.
 */
export async function addDeadline(page: Page, title: string, hoursAhead: number) {
  const pageNow = await page.evaluate(() => Date.now());
  const due = new Date(pageNow + hoursAhead * 3_600_000);
  await page.getByRole('button', { name: 'Add deadline' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(title);
  await dialog.getByLabel('Date', { exact: true }).fill(`${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`);
  await dialog.getByLabel('Time', { exact: true }).fill(`${pad(due.getHours())}:${pad(due.getMinutes())}`);
  await dialog.getByRole('button', { name: 'Light the candle' }).click();
  await expect(dialog).toBeHidden();
}

/** Serious and critical axe violations (the page, or only `include`), as short readable strings. */
export async function seriousViolations(page: Page, include?: string): Promise<string[]> {
  const builder = new AxeBuilder({ page });
  if (include) builder.include(include);
  const { violations } = await builder.analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}
