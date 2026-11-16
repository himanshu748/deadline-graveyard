// A fresh context is a first visit, so the shell is scanned twice: with the intro open over the
// 3 demo deadlines, and again after skipping it. Both scans must have no axe violations at all.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { introDialog } from './helpers.ts';

test('app shell renders and has no axe violations, with and without the first-visit intro', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Deadline Graveyard' })).toBeVisible();
  const intro = introDialog(page);
  await expect(intro).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await intro.getByRole('button', { name: 'Skip intro' }).click();
  await expect(intro).toBeHidden();
  await expect(page.locator('.scene-item')).toHaveCount(3);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
