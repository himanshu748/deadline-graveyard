// Validates: first-visit R2.5 and R2.6 as properties over arbitrary mixes of user and demo items.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { instantArb, itemArb, zoneArb } from '../../domain/arbitraries.ts';
import { clearDemo, demoItems, withDemo } from './demo-seed.ts';

const mixArb = fc.uniqueArray(itemArb(), { maxLength: 25, selector: (i) => i.id });

describe('clearDemo properties', () => {
  it('removes exactly the demo items: no demo item is left and every other item stays, unchanged and in order', () => {
    fc.assert(
      fc.property(mixArb, (items) => {
        const before = structuredClone(items);
        const kept = clearDemo(items);
        expect(kept.some((i) => i.demo)).toBe(false);
        expect(kept).toEqual(items.filter((i) => !i.demo));
        expect(kept.length).toBe(items.length - items.filter((i) => i.demo).length);
        kept.forEach((item) => expect(items).toContain(item));
        expect(items).toEqual(before);
      }),
      { numRuns: 300 },
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(mixArb, (items) => {
        expect(clearDemo(clearDemo(items))).toEqual(clearDemo(items));
      }),
    );
  });
});

describe('withDemo properties', () => {
  it('always leaves exactly the 3 seeded demo items next to every user item, and repeating it changes nothing', () => {
    fc.assert(
      fc.property(mixArb, instantArb, zoneArb, (items, now, zone) => {
        const once = withDemo(items, now, zone);
        expect(once.filter((i) => i.demo)).toEqual(demoItems(now, zone));
        expect(once.filter((i) => !i.demo)).toEqual(items.filter((i) => !i.demo));
        expect(withDemo(once, now, zone)).toEqual(once);
      }),
      { numRuns: 200 },
    );
  });
});
