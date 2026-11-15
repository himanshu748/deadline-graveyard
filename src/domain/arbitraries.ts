// fast-check generators for the deadline-engine properties (design.md "Correctness
// properties"). Test-only module: nothing in the app imports it.
import fc from 'fast-check';
import { Temporal } from 'temporal-polyfill';
import { DUE_SOON_MS } from './status.ts';
import type { EpochMs, Item, Resolution } from './types.ts';

/** 1970-01-01T00:00:00Z */
export const MIN_INSTANT: EpochMs = 0;
/** 2100-01-01T00:00:00Z */
export const MAX_INSTANT: EpochMs = 4_102_444_800_000;
const HOUR_MS = 3_600_000;

/**
 * DST zones in both hemispheres, a zone whose DST ended in 2019 (Sao Paulo),
 * a 30-minute DST shift (Lord Howe), fractional offsets and two no-DST controls.
 */
export const ZONES = [
  'America/Los_Angeles',
  'America/New_York',
  'Europe/London',
  'Australia/Sydney',
  'America/Sao_Paulo',
  'America/Santiago',
  'Australia/Lord_Howe',
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'UTC',
] as const;

export const DST_ZONES = ZONES.filter(
  (zone) => !['Asia/Kathmandu', 'Asia/Kolkata', 'UTC'].includes(zone),
);

export const zoneArb = fc.constantFrom(...ZONES);

export const instantArb = fc.integer({ min: MIN_INSTANT, max: MAX_INSTANT });

function clampInstant(ms: number): EpochMs {
  return Math.min(MAX_INSTANT, Math.max(MIN_INSTANT, ms));
}

export interface Transition {
  zone: string;
  /** The instant the offset changes. */
  at: EpochMs;
  /** Offset in ms before and after the change. */
  offsetBeforeMs: number;
  offsetAfterMs: number;
}

/** The first or second offset change in `zone` during `year`, or null if there is none. */
export function transitionInYear(zone: string, year: number, which: 0 | 1): Transition | null {
  const start = Temporal.PlainDate.from({ year, month: 1, day: 1 }).toZonedDateTime(zone);
  const first = start.getTimeZoneTransition('next');
  if (first === null || first.year !== year) return null;
  let chosen = first;
  if (which === 1) {
    const second = first.getTimeZoneTransition('next');
    if (second !== null && second.year === year) chosen = second;
  }
  const at = chosen.epochMilliseconds;
  const before = Temporal.Instant.fromEpochMilliseconds(at - 1).toZonedDateTimeISO(zone);
  return {
    zone,
    at,
    offsetBeforeMs: before.offsetNanoseconds / 1_000_000,
    offsetAfterMs: chosen.offsetNanoseconds / 1_000_000,
  };
}

const yearArb = fc.integer({ min: 1970, max: 2099 });
const whichArb = fc.constantFrom<0 | 1>(0, 1);

/**
 * Instants within 2 h before to 26 h after a real offset change in `zone`, so that a
 * due-soon window ending at the instant contains the change. Falls back to a uniform
 * instant when the zone has no change that year.
 */
export function nearTransitionArb(zone: string): fc.Arbitrary<EpochMs> {
  return fc
    .tuple(yearArb, whichArb, fc.integer({ min: -2 * HOUR_MS, max: 26 * HOUR_MS }), instantArb)
    .map(([year, which, offset, fallback]) => {
      const transition = transitionInYear(zone, year, which);
      return transition === null ? fallback : clampInstant(transition.at + offset);
    });
}

/** A zone with an instant that is uniform half the time and DST-biased the other half. */
export const zonedInstantArb: fc.Arbitrary<{ zone: string; ms: EpochMs }> = zoneArb.chain((zone) =>
  fc.oneof(instantArb, nearTransitionArb(zone)).map((ms) => ({ zone, ms })),
);

/** Real offset changes in DST zones (gaps where the offset grows, overlaps where it shrinks). */
export const transitionArb: fc.Arbitrary<Transition> = fc
  .tuple(fc.constantFrom(...DST_ZONES), yearArb, whichArb)
  .map(([zone, year, which]) => transitionInYear(zone, year, which))
  .filter((t): t is Transition => t !== null && t.offsetAfterMs !== t.offsetBeforeMs);

const resolutionArb = (dueAt: EpochMs): fc.Arbitrary<Resolution | null> =>
  fc.oneof(
    fc.constant(null),
    fc.record({
      kind: fc.constantFrom<'submitted' | 'buried'>('submitted', 'buried'),
      at: fc.integer({ min: Math.max(MIN_INSTANT, dueAt - 30 * DUE_SOON_MS), max: clampInstant(dueAt + 30 * DUE_SOON_MS) }),
    }),
  );

/** Items with instants from 1970 to 2100, DST-biased due instants and optional fields. */
export function itemArb(options: { resolved?: boolean } = {}): fc.Arbitrary<Item> {
  return zonedInstantArb.chain(({ zone, ms: dueAt }) => {
    const resolution =
      options.resolved === true
        ? resolutionArb(dueAt).filter((r): r is Resolution => r !== null)
        : options.resolved === false
          ? fc.constant(null)
          : resolutionArb(dueAt);
    return fc
      .record({
        id: fc.uuid(),
        title: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
        createdBefore: fc.integer({ min: 0, max: 60 * DUE_SOON_MS }),
        activityAfter: fc.integer({ min: 0, max: 60 * DUE_SOON_MS }),
        dateOnly: fc.boolean(),
        demo: fc.boolean(),
        resolution,
        url: fc.option(fc.webUrl(), { nil: undefined }),
        epitaph: fc.option(fc.string({ maxLength: 60 }), { nil: undefined }),
        notes: fc.option(fc.string({ maxLength: 60 }), { nil: undefined }),
      })
      .map((r) => {
        const createdAt = clampInstant(dueAt - r.createdBefore);
        const item: Item = {
          id: r.id,
          title: r.title,
          dueAt,
          zone,
          dateOnly: r.dateOnly,
          createdAt,
          lastActivityAt: clampInstant(createdAt + r.activityAfter),
          resolution: r.resolution,
          demo: r.demo,
        };
        if (r.url !== undefined) item.url = r.url;
        if (r.epitaph !== undefined) item.epitaph = r.epitaph;
        if (r.notes !== undefined) item.notes = r.notes;
        return item;
      });
  });
}
