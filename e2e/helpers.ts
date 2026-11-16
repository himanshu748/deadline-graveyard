// Shared e2e steps. A fresh browser context is a first visit: the app seeds 3 demo deadlines and
// starts the intro (first-visit R1.1). Specs that test other features start from an empty
// graveyard the way a real user gets one: skip the intro, clear the demo, then reload so the
// page starts clean (no intro, since the "intro seen" flag is now saved).
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
