// Validates: capture-and-export R1.7, R1.8, R1.9, R2.1 in a real browser with every non-local
// request blocked. `vite preview` serves no /api, so "Fill in from the link" must fail politely
// and the paste-text and manual paths must still work. Starts from an empty graveyard (helpers.ts).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { startEmpty } from './helpers.ts';

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;
  await page.route('**/*', (route) => (route.request().url().startsWith(origin) ? route.continue() : route.abort()));
  await startEmpty(page);
});

test('add from URL falls back to pasted text, then saves after the user confirms', async ({ page }) => {
  await page.getByRole('button', { name: 'Add deadline' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Link (optional)').fill('https://jam.example/');
  await dialog.getByRole('button', { name: 'Fill in from the link' }).click();
  await expect(dialog.getByRole('status').first()).toContainText('The link is kept');
  await dialog.getByLabel('Page text').fill('Submissions close December 4, 2030 at 2:00 PM PT.');
  await dialog.getByRole('button', { name: 'Find dates in the text' }).click();
  await expect(dialog.getByLabel('Date', { exact: true })).toHaveValue('2030-12-04');
  await expect(dialog.getByLabel('Time', { exact: true })).toHaveValue('14:00');
  await expect(dialog.getByLabel('Time zone of the deadline')).toHaveValue('America/Los_Angeles');
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  await dialog.getByLabel('Name').fill('Demo-free e2e jam');
  await dialog.getByRole('button', { name: 'Light the candle' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('heading', { level: 4, name: 'Demo-free e2e jam' })).toBeVisible();
});

test('export and settings dialog has no axe violations and offers the .ics download', async ({ page }) => {
  await page.getByRole('button', { name: 'Add deadline' }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Name').fill('Export me');
  await form.getByLabel('Date', { exact: true }).fill('2030-01-15');
  await form.getByLabel('No specific time').check();
  await form.getByRole('button', { name: 'Light the candle' }).click();
  await expect(form).toBeHidden();

  await page.getByRole('button', { name: 'Export and settings' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Export and settings' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export to calendar (.ics)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^deadline-graveyard-\d{4}-\d{2}-\d{2}\.ics$/);
  const stream = await file.createReadStream();
  let text = '';
  for await (const chunk of stream) text += String(chunk);
  expect(text).toContain('SUMMARY:Export me');
  expect(text).toContain('DTSTART;VALUE=DATE:20300115');
});
