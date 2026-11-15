// Correctness properties P1 to P4 from .kiro/specs/deadline-engine/design.md.
// On failure fast-check prints the seed and the shrunk counterexample, so a failure
// can be replayed with { seed, path } in the fc.assert options.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bury, editDue, revive, setEpitaph, submit, touch } from './actions.ts';
import { MAX_INSTANT, MIN_INSTANT, instantArb, itemArb, zoneArb, zonedInstantArb } from './arbitraries.ts';
import { DUE_SOON_MS, deriveStatus, phaseAt, phaseRank } from './status.ts';
import { toInstant, toLocal } from './time.ts';
import type { EpochMs, Item } from './types.ts';

const HOUR_MS = 3_600_000;

describe('deadline-engine correctness properties', () => {
  // Validates: deadline-engine P1 (R1.5, R3.1, R3.6)
  it('P1: status is independent of zone, and a local rendering in any zone converts back to the same instant', () => {
    fc.assert(
      fc.property(itemArb(), instantArb, zoneArb, zoneArb, (raw, now, zoneA, zoneB) => {
        const dueAt = raw.dueAt - (raw.dueAt % 1000); // toLocal has second precision
        const item = { ...raw, dueAt };
        expect(deriveStatus({ ...item, zone: zoneA }, now)).toBe(deriveStatus({ ...item, zone: zoneB }, now));

        for (const zone of [zoneA, zoneB]) {
          const local = toLocal(dueAt, zone);
          const back = toInstant({ ...local, zone });
          if (!back.ok) throw new Error(`conversion failed: ${back.error}`);
          // The same wall-clock time always comes back.
          expect(toLocal(back.epochMs, zone)).toEqual(local);
          if (back.adjustment === 'ambiguous-earlier') {
            // A repeated fall-back time maps to its first occurrence (R3.2).
            expect(back.epochMs).toBeLessThanOrEqual(dueAt);
            expect(dueAt - back.epochMs).toBeLessThanOrEqual(2 * HOUR_MS);
          } else {
            expect(back.adjustment).toBe('none');
            expect(back.epochMs).toBe(dueAt);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  // Validates: deadline-engine P2 (R1.1, R1.2, R1.3, R1.6)
  it('P2: with no user action the phase never moves backwards as now increases', () => {
    fc.assert(
      fc.property(itemArb({ resolved: false }), instantArb, instantArb, (item, a, b) => {
        const [now1, now2] = a <= b ? [a, b] : [b, a];
        expect(phaseRank(phaseAt(item.dueAt, now1))).toBeLessThanOrEqual(phaseRank(phaseAt(item.dueAt, now2)));
        if (deriveStatus(item, now1) === 'missed') expect(deriveStatus(item, now2)).toBe('missed');
      }),
      { numRuns: 500 },
    );
  });

  // Validates: deadline-engine P3 (R2.1, R2.2, R2.6, R2.10, R2.11)
  it('P3: submitted and buried are terminal for every later now and every action', () => {
    type Step = { action: 'submit' | 'bury' | 'revive' | 'touch' | 'editDue' | 'setEpitaph'; advance: number; text: string };
    const stepArb: fc.Arbitrary<Step> = fc.record({
      action: fc.constantFrom('submit', 'bury', 'revive', 'touch', 'editDue', 'setEpitaph'),
      advance: fc.integer({ min: 0, max: 400 * DUE_SOON_MS }),
      text: fc.string({ maxLength: 40 }),
    });
    fc.assert(
      fc.property(itemArb({ resolved: true }), fc.array(stepArb, { maxLength: 12 }), (start, steps) => {
        const terminal = deriveStatus(start, start.resolution?.at ?? MIN_INSTANT);
        let item: Item = start;
        let now: EpochMs = start.resolution?.at ?? MIN_INSTANT;
        for (const step of steps) {
          now = Math.min(MAX_INSTANT, now + step.advance);
          if (step.action === 'setEpitaph') {
            // Epitaphs may be written on buried items (R2.11) but never change the resolution.
            const result = setEpitaph(item, step.text, now);
            if (result.ok) item = result.value;
          } else {
            const result =
              step.action === 'submit'
                ? submit(item, now)
                : step.action === 'bury'
                  ? bury(item, now)
                  : step.action === 'revive'
                    ? revive(item, now)
                    : step.action === 'touch'
                      ? touch(item, now)
                      : editDue(item, now + DUE_SOON_MS, 'UTC', false, now);
            expect(result).toEqual({ ok: false, error: { code: 'resolved' } });
          }
          expect(item.resolution).toEqual(start.resolution);
          expect(deriveStatus(item, now)).toBe(terminal);
        }
      }),
      { numRuns: 500 },
    );
  });

  // Validates: deadline-engine P4 (R1.2, R1.4)
  it('P4: the due-soon window is exactly [dueAt - 86,400,000 ms, dueAt), including across DST transitions', () => {
    fc.assert(
      fc.property(zonedInstantArb, instantArb, ({ zone, ms: dueAt }, probe) => {
        // An item that is never a ghost at the probed instant, so status equals phase.
        const statusAt = (now: EpochMs) =>
          deriveStatus(
            { id: 'p4', title: 'P4', dueAt, zone, dateOnly: false, createdAt: now, lastActivityAt: now, resolution: null, demo: false },
            now,
          );
        const start = dueAt - DUE_SOON_MS;
        const boundaries: Array<[EpochMs, string]> = [
          [start - 1, 'active'],
          [start, 'due-soon'],
          [start + 1, 'due-soon'],
          [dueAt - 1, 'due-soon'],
          [dueAt, 'missed'],
          [dueAt + 1, 'missed'],
        ];
        for (const [now, expected] of boundaries) {
          expect(phaseAt(dueAt, now)).toBe(expected);
          expect(statusAt(now)).toBe(expected);
        }
        // A probe inside or near the window: due-soon exactly when start <= now < dueAt.
        const now = Math.min(MAX_INSTANT, Math.max(MIN_INSTANT, start + (probe % (2 * DUE_SOON_MS)) - DUE_SOON_MS / 2));
        expect(statusAt(now) === 'due-soon').toBe(start <= now && now < dueAt);
      }),
      { numRuns: 1000 },
    );
  });
});
