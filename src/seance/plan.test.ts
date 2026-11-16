// Validates: seance R1.1, R1.3, R1.4, R2.1, R2.2, R2.3, R2.4 (example tests; properties are in plan.property.test.ts)
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY, HOUR, makeItem } from '../domain/test-items.ts';
import type { Item } from '../domain/types.ts';
import { buildPlan, candidatesFor, emptyAnswers, isSeanceDue, lessonsFrom, MAX_LESSONS, renderPlanText, WEEK_MS, type SeanceAnswers } from './plan.ts';

/** Mon 30 Nov 2026 12:00 UTC */
const NOW = Date.UTC(2026, 10, 30, 12);

let n = 0;
function item(title: string, overrides: Partial<Item>): Item {
  n++;
  return makeItem({
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    title,
    createdAt: NOW - 20 * DAY,
    lastActivityAt: NOW - HOUR,
    ...overrides,
  });
}

const soon = item('Grant form', { dueAt: NOW + 5 * HOUR });
const active3 = item('Essay', { dueAt: NOW + 3 * DAY, demo: true });
const far = item('Thesis', { dueAt: NOW + 20 * DAY });
const ghostNear = item('Jam game', { dueAt: NOW + 2 * DAY, lastActivityAt: NOW - 8 * DAY });
const ghostFar = item('Side project', { dueAt: NOW + 30 * DAY, lastActivityAt: NOW - 9 * DAY });
const missedRecent = item('Lab report', { dueAt: NOW - 2 * DAY });
const missedOld = item('Old quiz', { dueAt: NOW - 10 * DAY });
const missedWithEpitaph = item('Poster', { dueAt: NOW - DAY, epitaph: 'Print it the day before.' });
const buriedRecent = item('Startup idea', { dueAt: NOW + 9 * DAY, resolution: { kind: 'buried', at: NOW - DAY } });
const buriedOld = item('Podcast', { dueAt: NOW - 20 * DAY, resolution: { kind: 'buried', at: NOW - 9 * DAY } });
const submitted = item('Application', { dueAt: NOW + DAY, resolution: { kind: 'submitted', at: NOW - DAY } });

const ALL = [soon, active3, far, ghostNear, ghostFar, missedRecent, missedOld, missedWithEpitaph, buriedRecent, buriedOld, submitted];
const titles = (list: Item[]) => list.map((i) => i.title);

function answers(patch: Partial<Record<keyof SeanceAnswers, { ids?: Item[]; note?: string }>>): SeanceAnswers {
  const a = emptyAnswers();
  for (const key of Object.keys(patch) as Array<keyof SeanceAnswers>) {
    const p = patch[key];
    a[key] = { itemIds: (p?.ids ?? []).map((i) => i.id), note: p?.note ?? '' };
  }
  return a;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('candidatesFor (R1.1)', () => {
  it('Q1 lists open items due in the next 7 days and every ghost, in due order', () => {
    expect(titles(candidatesFor(1, ALL, NOW))).toEqual(['Grant form', 'Jam game', 'Essay', 'Side project']);
  });

  it('Q2 lists items missed or buried in the last 7 days', () => {
    expect(titles(candidatesFor(2, ALL, NOW))).toEqual(['Lab report', 'Poster', 'Startup idea']);
  });

  it('Q3 lists every open item, ghosts included, and nothing resolved or missed', () => {
    expect(titles(candidatesFor(3, ALL, NOW))).toEqual(['Grant form', 'Jam game', 'Essay', 'Thesis', 'Side project']);
  });

  it('uses absolute elapsed time at the 7-day edge', () => {
    const edge = item('Edge', { dueAt: NOW + WEEK_MS });
    expect(titles(candidatesFor(1, [edge], NOW))).toEqual([]);
    expect(titles(candidatesFor(1, [edge], NOW + 1))).toEqual(['Edge']);
  });
});

describe('isSeanceDue (R1.4)', () => {
  it('is due with no séance yet and exactly 7 x 24 h after the last one', () => {
    expect(isSeanceDue(null, NOW)).toBe(true);
    expect(isSeanceDue(NOW - WEEK_MS + 1, NOW)).toBe(false);
    expect(isSeanceDue(NOW - WEEK_MS, NOW)).toBe(true);
    expect(isSeanceDue(NOW, NOW)).toBe(false);
  });
});

describe('buildPlan', () => {
  const full = answers({
    restless: { ids: [ghostNear, ghostFar, soon], note: 'The jam game.' },
    lessons: { ids: [missedRecent, buriedRecent, missedWithEpitaph], note: '  Start a week early.\n\nAsk for help sooner.\n' },
    keepAlive: { ids: [far, ghostNear], note: 'Finish the thesis chapter.' },
  });
  const plan = buildPlan(ALL, full, NOW, { locale: 'en-GB', zone: 'UTC' });

  it('lists Q3 picks first, then the rest due within 7 days, in due order (R2.1)', () => {
    expect(plan.steps.map((s) => [s.section, s.title, s.action])).toEqual([
      ['keep', 'Jam game', 'revive'],
      ['keep', 'Thesis', 'work'],
      ['due', 'Grant form', 'work'],
      ['due', 'Essay', 'work'],
      ['let-go', 'Side project', 'bury'],
      ['lessons', 'Lab report', 'epitaph'],
      ['lessons', 'Startup idea', 'epitaph'],
    ]);
  });

  it('suggests revive for a Q1 ghost kept in Q3 and bury for one that is not (R2.2)', () => {
    expect(plan.steps.find((s) => s.itemId === ghostNear.id)?.action).toBe('revive');
    expect(plan.steps.find((s) => s.itemId === ghostFar.id)?.action).toBe('bury');
  });

  it('collects lessons and offers them as epitaphs for graves that have none (R2.3)', () => {
    expect(plan.lessons).toEqual(['Start a week early.', 'Ask for help sooner.']);
    expect(plan.steps.filter((s) => s.action === 'epitaph').map((s) => [s.title, s.epitaph])).toEqual([
      ['Lab report', 'Start a week early.'],
      ['Startup idea', 'Ask for help sooner.'],
    ]);
    expect(plan.steps.some((s) => s.itemId === missedWithEpitaph.id)).toBe(false);
  });

  it('writes the plan with fixed templates, the promise, Demo labels and the user zone (R2.4)', () => {
    expect(plan.promise).toBe('Finish the thesis chapter.');
    const lines = plan.text.split('\n');
    expect(lines[0]).toBe("Next week's plan, Mon 30 Nov to Mon 7 Dec.");
    expect(lines[1]).toBe('Your promise: Finish the thesis chapter.');
    expect(plan.text).toContain('Keep alive first:\n1. Revive Jam game, due ');
    expect(plan.text).toContain('4. Work on Essay (Demo), due ');
    expect(plan.text).toContain('Let go:\n5. Bury Side project, due ');
    expect(plan.text).toContain('Lessons from the graves:\n- Start a week early.\n- Ask for help sooner.\n- Engrave "Start a week early." on Lab report.');
    expect(plan.text).toContain('UTC');
    expect(plan.text).not.toContain('\u2014');
  });

  it('renders the same plan in another zone without changing its steps', () => {
    const kolkata = buildPlan(ALL, full, NOW, { locale: 'en-GB', zone: 'Asia/Kolkata' });
    expect(kolkata.steps).toEqual(plan.steps);
    expect(kolkata.text).not.toBe(plan.text);
    expect(renderPlanText(plan, 'en-GB', 'Asia/Kolkata')).toBe(kolkata.text);
  });

  it('includes unpicked ghosts due this week as work, and says why', () => {
    const p = buildPlan([ghostNear], emptyAnswers(), NOW);
    expect(p.steps).toEqual([expect.objectContaining({ section: 'due', action: 'work', reason: 'Due within 7 days. It has had no activity for a week.' })]);
  });

  it('marks due-soon items in the reason', () => {
    expect(buildPlan([soon], emptyAnswers(), NOW).steps[0]?.reason).toBe('Due within 24 hours.');
  });

  it('drops picked ids that no longer exist and says so', () => {
    const p = buildPlan([soon], answers({ keepAlive: { ids: [far, ghostFar] } }), NOW);
    expect(p.dropped).toBe(2);
    expect(p.steps.map((s) => s.itemId)).toEqual([soon.id]);
    expect(p.text).toContain('2 picked deadlines no longer exist, so they were left out.');
    expect(buildPlan([], answers({ restless: { ids: [far] } }), NOW).text).toContain('1 picked deadline no longer exists, so it was left out.');
  });

  it('skips resolved or missed Q3 picks and offers no epitaph without a lesson', () => {
    const p = buildPlan(ALL, answers({ keepAlive: { ids: [submitted, missedRecent] }, lessons: { ids: [missedRecent] } }), NOW);
    expect(p.steps.some((s) => s.section === 'keep')).toBe(false);
    expect(p.steps.some((s) => s.action === 'epitaph')).toBe(false);
  });

  it('has a kind empty plan when nothing is due and nothing was answered', () => {
    const p = buildPlan([], emptyAnswers(), NOW, { locale: 'en-GB', zone: 'UTC' });
    expect(p.steps).toEqual([]);
    expect(p.text).toBe("Next week's plan, Mon 30 Nov to Mon 7 Dec.\n\nNothing is due in the next 7 days and no ghost needs you. Rest, or light a new candle.");
  });

  it('makes no network call (R2.4)', () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    buildPlan(ALL, full, NOW);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('lessonsFrom', () => {
  it('takes one trimmed lesson per non-empty line, at most MAX_LESSONS', () => {
    expect(lessonsFrom(' a \r\n\n b ')).toEqual(['a', 'b']);
    expect(lessonsFrom(Array.from({ length: 15 }, (_, i) => `L${i}`).join('\n'))).toHaveLength(MAX_LESSONS);
  });

  it('cuts an epitaph offer to the epitaph limit', () => {
    const long = 'x'.repeat(400);
    const p = buildPlan([missedRecent], answers({ lessons: { ids: [missedRecent], note: long } }), NOW);
    expect(p.lessons[0]).toHaveLength(400);
    expect(p.steps[0]?.epitaph).toHaveLength(280);
  });
});
