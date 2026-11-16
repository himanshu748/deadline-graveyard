// Demo data for the first visit (first-visit R1.1, R2.1 to R2.3, R2.5, R2.6). Pure functions:
// `now` and the zone are passed in, so tests can check the states at seed time.
import type { EpochMs, Item } from '../../domain/types.ts';

/** Setting key for the "intro seen" flag (first-visit R1.1, R1.5). Saved in backups like every setting. */
export const SETTING_INTRO_SEEN = 'intro-seen';

/** Fixed ids, so seeding twice replaces the same 3 items instead of adding 3 more. */
export const DEMO_IDS = { a: 'demo-a', b: 'demo-b', c: 'demo-c' } as const;

/** The sample epitaph is itself marked as demo text (R2.2). */
export const DEMO_EPITAPH = 'Demo epitaph: start the draft a week earlier.';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Rounds up to a whole minute so the demo times read cleanly ("14:05", not "14:04:37"). */
const wholeMinute = (ms: EpochMs): EpochMs => Math.ceil(ms / MINUTE) * MINUTE;

/**
 * R2.1: exactly 3 demo items relative to `now`. A starts as a ghost (due in about 5 days, no
 * activity for 8 days), B is due soon (about 6 hours), C was missed about a day ago and carries
 * the sample epitaph. R2.3: generic titles that name no real event, person or organisation.
 */
export function demoItems(now: EpochMs, zone: string): Item[] {
  const base = { zone, dateOnly: false, resolution: null, demo: true } as const;
  return [
    {
      ...base,
      id: DEMO_IDS.a,
      title: 'Demo: Weekend game jam submission',
      dueAt: wholeMinute(now + 5 * DAY),
      createdAt: now - 12 * DAY,
      lastActivityAt: now - 8 * DAY,
    },
    {
      ...base,
      id: DEMO_IDS.b,
      title: 'Demo: Course project report',
      dueAt: wholeMinute(now + 6 * HOUR),
      createdAt: now - 4 * DAY,
      lastActivityAt: now - HOUR,
    },
    {
      ...base,
      id: DEMO_IDS.c,
      title: 'Demo: Scholarship essay',
      dueAt: wholeMinute(now - DAY),
      createdAt: now - 10 * DAY,
      lastActivityAt: now - 2 * DAY,
      epitaph: DEMO_EPITAPH,
    },
  ];
}

/** R2.5: every item with `demo = true` goes; every other item stays, unchanged and in order. */
export function clearDemo(items: readonly Item[]): Item[] {
  return items.filter((i) => !i.demo);
}

/** R2.6 (replay after a confirmation): old demo items are replaced, so seeding is idempotent. */
export function withDemo(items: readonly Item[], now: EpochMs, zone: string): Item[] {
  return [...clearDemo(items), ...demoItems(now, zone)];
}

/** R1.1, R2.6: only an empty graveyard that has never finished or skipped the intro starts it. */
export function shouldStartIntro(itemCount: number, introSeen: boolean): boolean {
  return itemCount === 0 && !introSeen;
}
