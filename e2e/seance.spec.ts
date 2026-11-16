// Validates: seance R1.1, R1.2, R1.3 (and R2.3, R2.6) in a real browser, keyboard only, plus an
// axe scan of every step of the Séance dialog with normal and reduced motion. Each test starts
// from an empty graveyard (intro skipped, demo cleared, see helpers.ts) and adds deadlines through
// the form, as in a11y.spec.ts, so no demo data is involved.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { startEmpty } from './helpers.ts';

const pad = (n: number) => String(n).padStart(2, '0');
/** The visually hidden ": Old essay" suffix is computed into the name with a space before the colon. */
const ENGRAVE_OLD_ESSAY = /^Engrave epitaph\s*: Old essay$/;

async function addDeadline(page: Page, title: string, hoursAhead: number) {
  const due = new Date(Date.now() + hoursAhead * 3_600_000);
  await page.getByRole('button', { name: 'Add deadline' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(title);
  await dialog.getByLabel('Date').fill(`${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`);
  await dialog.getByLabel('Time', { exact: true }).fill(`${pad(due.getHours())}:${pad(due.getMinutes())}`);
  await dialog.getByRole('button', { name: 'Light the candle' }).click();
  await expect(dialog).toBeHidden();
}

/** One missed grave (2 days ago), one due-soon candle (3 h) and one active candle (4 days). */
async function seed(page: Page) {
  await addDeadline(page, 'Old essay', -48);
  await addDeadline(page, 'Grant form', 3);
  await addDeadline(page, 'Portfolio', 96);
}

/** Presses Tab until `target` has focus, so the test reaches it the way a keyboard user would. */
async function tabTo(page: Page, target: Locator, max = 40) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab never reached ${target.toString()}`);
}

/** Serious and critical axe violations inside the open dialog, as short readable strings. */
async function seriousViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).include('dialog').analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
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

test('keyboard only: three questions, a skip, a plan and a confirmed epitaph', async ({ page }) => {
  await startEmpty(page);
  await seed(page);
  await expect(page.getByTestId('seance-invite')).toContainText('first séance');

  const opener = page.getByRole('button', { name: 'Hold a séance' });
  await tabTo(page, opener);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'The Séance' });
  await expect(dialog).toBeVisible();

  // Q1: due in the next 7 days and ghosts, in due order (R1.1).
  await expect(dialog.getByRole('heading', { name: 'Which spirits are restless?' })).toBeFocused();
  await expect(dialog.getByText('Question 1 of 3')).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(2);
  await expect(dialog.locator('.seance-picks label').first()).toContainText('Grant form');
  const grant = dialog.getByRole('checkbox', { name: /^Grant form/ });
  await tabTo(page, grant);
  await page.keyboard.press(' ');
  await expect(grant).toBeChecked();
  await tabTo(page, dialog.getByLabel('What is haunting you? (optional)'));
  await page.keyboard.type('The grant form.');
  await tabTo(page, dialog.getByRole('button', { name: 'Next question' }));
  await page.keyboard.press('Enter');

  // Q2: graves from the last 7 days. Skipping it clears what was typed (R1.2).
  await expect(dialog.getByRole('heading', { name: 'What did the graves teach you?' })).toBeFocused();
  await expect(dialog.getByRole('checkbox')).toHaveCount(1);
  await tabTo(page, dialog.getByRole('checkbox', { name: /^Old essay/ }));
  await page.keyboard.press(' ');
  await tabTo(page, dialog.getByLabel('Lessons, one per line (optional)'));
  await page.keyboard.type('This line is skipped.');
  await tabTo(page, dialog.getByRole('button', { name: 'Skip this question' }));
  await page.keyboard.press('Enter');

  // Q3: every open deadline. Back returns to Q2, which is empty again after the skip.
  await expect(dialog.getByRole('heading', { name: 'What will you keep alive next week?' })).toBeFocused();
  await tabTo(page, dialog.getByRole('button', { name: 'Back' }));
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('heading', { name: 'What did the graves teach you?' })).toBeFocused();
  await expect(dialog.getByRole('checkbox', { name: /^Old essay/ })).not.toBeChecked();
  await expect(dialog.getByLabel('Lessons, one per line (optional)')).toHaveValue('');
  await tabTo(page, dialog.getByRole('checkbox', { name: /^Old essay/ }));
  await page.keyboard.press(' ');
  await tabTo(page, dialog.getByLabel('Lessons, one per line (optional)'));
  await page.keyboard.type('Start a week early.');
  await tabTo(page, dialog.getByRole('button', { name: 'Next question' }));
  await page.keyboard.press('Enter');

  await expect(dialog.getByRole('heading', { name: 'What will you keep alive next week?' })).toBeFocused();
  await tabTo(page, dialog.getByRole('checkbox', { name: /^Portfolio/ }));
  await page.keyboard.press(' ');
  await tabTo(page, dialog.getByRole('button', { name: 'Finish and see the plan' }));
  await page.keyboard.press('Enter');

  // The plan (R1.3, R2.1, R2.3): the Q3 pick first, then the rest due this week, then lessons.
  await expect(dialog.getByRole('heading', { name: "Next week's plan" })).toBeFocused();
  await expect(dialog.getByText('Written by the rules on this device; no AI was used.')).toBeVisible();
  await expect(dialog.locator('.plan-section h4')).toHaveText(['Keep alive first', 'Also due this week', 'Lessons from the graves']);
  await expect(dialog.locator('.plan-step-title')).toHaveText(['Work on Portfolio', 'Work on Grant form', 'Engrave Old essay']);
  await expect(dialog.locator('.plan-lessons li')).toHaveText(['Start a week early.']);

  // R2.6: the action waits for a confirmation, and Not now leaves the grave untouched.
  const engrave = dialog.getByRole('button', { name: ENGRAVE_OLD_ESSAY });
  await tabTo(page, engrave);
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Engrave "Start a week early." on the tombstone of Old essay?')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Yes, engrave it' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Not now' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(engrave).toBeFocused();
  await page.keyboard.press('Enter');
  // Wait for focus to reach the confirmation before pressing again; two back-to-back presses
  // raced the focus move under load (seen once in a full parallel run on 16 Nov 2026).
  await expect(dialog.getByRole('button', { name: 'Yes, engrave it' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Engraved on its tombstone.')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await expect(page.getByTestId('seance-invite')).toHaveCount(0);
  await expect(page.locator('.list-view .epitaph', { hasText: 'Start a week early.' })).toBeVisible();

  // R3.1, R3.2: the séance is kept and listed when the dialog opens again.
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('Past séances (1)')).toBeVisible();
  await page.screenshot({ path: 'test-results/seance-keyboard.png' });
});

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`axe finds no serious or critical violations on any Séance step (${reducedMotion} motion)`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await startEmpty(page);
    await seed(page);
    await page.getByRole('button', { name: 'Hold a séance' }).click();
    const dialog = page.getByRole('dialog', { name: 'The Séance' });
    await expect(dialog).toBeVisible();

    const circle = dialog.locator('svg.candle-circle');
    await expect(circle).toHaveAttribute('data-motion', reducedMotion === 'reduce' ? 'reduced' : 'full');
    const flameTransition = await circle.locator('.cc-flame').first().evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(flameTransition).toBe(reducedMotion === 'reduce' ? '0s' : '0.2s');

    for (const question of ['Which spirits are restless?', 'What did the graves teach you?', 'What will you keep alive next week?']) {
      await expect(dialog.getByRole('heading', { name: question })).toBeVisible();
      await dialog.getByRole('checkbox').first().check();
      if (question === 'What did the graves teach you?') await dialog.getByRole('textbox').fill('Start a week early.');
      expect(await seriousViolations(page)).toEqual([]);
      await dialog.getByRole('button', { name: /^(Next question|Finish and see the plan)$/ }).click();
    }

    await expect(dialog.getByRole('heading', { name: "Next week's plan" })).toBeVisible();
    await expect(circle).toHaveAttribute('data-lit', '3');
    expect(await seriousViolations(page)).toEqual([]);
    await dialog.getByRole('button', { name: ENGRAVE_OLD_ESSAY }).click();
    await expect(dialog.getByRole('button', { name: 'Yes, engrave it' })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.screenshot({ path: `test-results/seance-plan-${reducedMotion}.png`, fullPage: true });
  });
}
