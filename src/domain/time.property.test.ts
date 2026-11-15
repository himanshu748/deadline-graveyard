// Correctness property P5 from .kiro/specs/deadline-engine/design.md: local wall-clock
// round trip under the 'compatible' DST policy in deadline-domain.md.
import fc from 'fast-check';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { instantArb, transitionArb, zoneArb } from './arbitraries.ts';
import { toInstant, toLocal } from './time.ts';
import type { EpochMs } from './types.ts';

/** Wall-clock date and time of a "local epoch" (wall-clock milliseconds read as UTC). */
function wall(localMs: EpochMs): { date: string; time: string } {
  return toLocal(localMs, 'UTC');
}

/** True when the wall-clock time exists exactly once in the zone (no gap, no overlap). */
function existsOnce(local: { date: string; time: string }, zone: string): boolean {
  const pdt = Temporal.PlainDateTime.from(`${local.date}T${local.time}`);
  const earlier = pdt.toZonedDateTime(zone, { disambiguation: 'earlier' });
  const later = pdt.toZonedDateTime(zone, { disambiguation: 'later' });
  return earlier.epochMilliseconds === later.epochMilliseconds;
}

describe('deadline-engine correctness property P5', () => {
  // Validates: deadline-engine P5 (R3.2, R3.5)
  it('P5a: a local date-time that exists exactly once round-trips through toInstant and toLocal', () => {
    fc.assert(
      fc.property(zoneArb, instantArb, (zone, ms) => {
        const local = toLocal(ms, zone);
        fc.pre(existsOnce(local, zone));
        const converted = toInstant({ ...local, zone });
        expect(converted).toEqual({ ok: true, epochMs: ms - (ms % 1000), dateOnly: false, adjustment: 'none' });
        if (converted.ok) expect(toLocal(converted.epochMs, zone)).toEqual(local);
      }),
      { numRuns: 1000 },
    );
  });

  // Validates: deadline-engine P5 (R3.2, R3.3)
  it('P5b: a spring-forward gap time is shifted forward by the gap and flagged gap-shifted', () => {
    const gapArb = transitionArb.filter((t) => t.offsetAfterMs > t.offsetBeforeMs);
    fc.assert(
      fc.property(gapArb, fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), (t, fraction) => {
        const gapMs = t.offsetAfterMs - t.offsetBeforeMs;
        const intoGap = Math.floor((fraction * gapMs) / 1000) * 1000;
        const typed = wall(t.at + t.offsetBeforeMs + intoGap);
        const converted = toInstant({ ...typed, zone: t.zone });
        expect(converted).toEqual({ ok: true, epochMs: t.at + intoGap, dateOnly: false, adjustment: 'gap-shifted' });
        if (converted.ok) {
          expect(toLocal(converted.epochMs, t.zone)).toEqual(wall(t.at + t.offsetAfterMs + intoGap));
        }
      }),
      { numRuns: 1000 },
    );
  });

  // Validates: deadline-engine P5 (R3.2, R3.3, R3.5)
  it('P5c: a repeated fall-back time takes the earlier offset, is flagged ambiguous-earlier and round-trips', () => {
    const overlapArb = transitionArb.filter((t) => t.offsetAfterMs < t.offsetBeforeMs);
    fc.assert(
      fc.property(overlapArb, fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), (t, fraction) => {
        const overlapMs = t.offsetBeforeMs - t.offsetAfterMs;
        const intoOverlap = Math.floor((fraction * overlapMs) / 1000) * 1000;
        const wallMs = t.at + t.offsetAfterMs + intoOverlap;
        const typed = wall(wallMs);
        const converted = toInstant({ ...typed, zone: t.zone });
        expect(converted).toEqual({
          ok: true,
          epochMs: wallMs - t.offsetBeforeMs,
          dateOnly: false,
          adjustment: 'ambiguous-earlier',
        });
        if (converted.ok) expect(toLocal(converted.epochMs, t.zone)).toEqual(typed);
      }),
      { numRuns: 1000 },
    );
  });
});
