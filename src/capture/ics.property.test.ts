// Validates: deadline-engine P6 and capture-and-export R2.3: exporting deadlines to .ics and parsing
// the file back gives the same uid, title, instant, zone and date-only flag.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { instantArb, ZONES } from '../domain/arbitraries.ts';
import { toInstant, toLocal } from '../domain/time.ts';
import type { Item } from '../domain/types.ts';
import { parseIcs, toIcs } from './ics.ts';

/** Titles full of the characters iCalendar must escape, plus emoji and other multi-byte text. */
const titleArb = fc
  .array(
    fc.oneof(
      { weight: 3, arbitrary: fc.string({ minLength: 1, maxLength: 12 }) },
      fc.constantFrom(',', ';', '\\', '\n', '\r\n', ':', '"', '\u{1F383}', '\u00e9', '\u5893', ' ', '[Demo] '),
    ),
    { minLength: 1, maxLength: 12 },
  )
  .map((parts) => parts.join(''))
  .filter((s) => s.trim().length > 0);

const zoneArb: fc.Arbitrary<string> = fc.constantFrom(...ZONES);

interface When {
  zone: string;
  dueAt: number;
  dateOnly: boolean;
}

const timedArb: fc.Arbitrary<When> = fc.record({ zone: zoneArb, ms: instantArb.map((ms) => Math.floor(ms / 1000) * 1000) }).map(({ zone, ms }) => ({ zone, dueAt: ms, dateOnly: false }));

/** Date-only deadlines as the app makes them: 23:59:59 local, skipping days where that time is in a DST gap. */
const dateOnlyArb: fc.Arbitrary<When> = fc
  .record({ zone: zoneArb, ms: instantArb })
  .map(({ zone, ms }) => {
    const date = toLocal(ms, zone).date;
    const converted = toInstant({ date, zone });
    return converted.ok && converted.adjustment === 'none' ? ({ zone, dueAt: converted.epochMs, dateOnly: true } as When) : null;
  })
  .filter((v): v is When => v !== null);

const itemArb: fc.Arbitrary<Item> = fc
  .record({ id: fc.uuid(), title: titleArb, demo: fc.boolean(), when: fc.oneof(timedArb, dateOnlyArb), url: fc.option(fc.webUrl(), { nil: undefined }) })
  .map(({ id, title, demo, when, url }) => {
    const item: Item = { id, title, demo, ...when, createdAt: 0, lastActivityAt: 0, resolution: null };
    if (url !== undefined) item.url = url;
    return item;
  });

describe('P6: .ics round trip (R2.3)', () => {
  it('parseIcs(toIcs(items)) recovers uid, title, instant, zone, date-only flag and demo flag', () => {
    fc.assert(
      fc.property(fc.uniqueArray(itemArb, { maxLength: 8, selector: (i) => i.id }), instantArb, (items, now) => {
        const parsed = parseIcs(toIcs(items, now));
        expect(parsed).toEqual(
          items.map((i) => ({ id: i.id, title: i.title.replace(/\r\n|\r/g, '\n'), dueAt: i.dueAt, zone: i.zone, dateOnly: i.dateOnly, demo: i.demo })),
        );
      }),
      { numRuns: 300 },
    );
  });

  it('never writes a line longer than 75 octets', () => {
    const enc = new TextEncoder();
    fc.assert(
      fc.property(fc.array(itemArb, { maxLength: 4 }), (items) => {
        for (const line of toIcs(items, 0).split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
      }),
    );
  });
});
