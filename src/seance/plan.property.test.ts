// Validates: seance R1.3, R2.1, R2.2, R2.3 as fast-check properties (design.md "Testing strategy").
// The planner must always include due-soon items, never invent a deadline it was not given,
// put every Q3 pick before anything else, and give the same plan for the same inputs.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { instantArb, itemArb, MAX_INSTANT, MIN_INSTANT } from '../domain/arbitraries.ts';
import { deriveStatus, DUE_SOON_MS } from '../domain/status.ts';
import type { Item } from '../domain/types.ts';
import { buildPlan, candidatesFor, WEEK_MS, type Answer, type SeanceAnswers } from './plan.ts';

const RUNS = 300;
const DAY = DUE_SOON_MS;
const clamp = (ms: number) => Math.min(MAX_INSTANT, Math.max(MIN_INSTANT, ms));
const open = (item: Item, now: number) => ['active', 'due-soon', 'ghost'].includes(deriveStatus(item, now));

/** Moves every instant of an item by `delta`, keeping its shape (created, active, resolved). */
function shift(item: Item, delta: number): Item {
  return {
    ...item,
    dueAt: item.dueAt + delta,
    createdAt: item.createdAt + delta,
    lastActivityAt: item.lastActivityAt + delta,
    resolution: item.resolution && { ...item.resolution, at: item.resolution.at + delta },
  };
}

const spreadItemsArb = fc.uniqueArray(itemArb(), { selector: (i) => i.id, maxLength: 10 });

/** Uniform due times from 1970 to 2100 rarely share a week, so half the scenarios put every
 * due time within 10 days of one base instant. Without this the Q3-first property missed a
 * mutation that only matters when two items are due in the same week. */
const clusteredItemsArb = fc
  .tuple(spreadItemsArb, fc.integer({ min: MIN_INSTANT + 60 * DAY, max: MAX_INSTANT - 60 * DAY }), fc.array(fc.integer({ min: -10 * DAY, max: 10 * DAY }), { minLength: 10, maxLength: 10 }))
  .map(([items, base, offsets]) => items.map((item, i) => shift(item, base + (offsets[i] ?? 0) - item.dueAt)));

/** Items, an instant near one of their due times (so every status shows up), and answers that
 * pick a mix of real ids and ids that match nothing. */
const scenarioArb = fc.oneof(spreadItemsArb, clusteredItemsArb).chain((items) => {
  const ids = items.map((i) => i.id);
  const nowArb =
    items.length === 0
      ? instantArb
      : fc.oneof(
          instantArb,
          fc.tuple(fc.constantFrom(...items), fc.integer({ min: -10 * DAY, max: 10 * DAY })).map(([i, off]) => clamp(i.dueAt + off)),
        );
  const idArb = ids.length === 0 ? fc.uuid() : fc.oneof({ arbitrary: fc.constantFrom(...ids), weight: 4 }, { arbitrary: fc.uuid(), weight: 1 });
  const answerArb: fc.Arbitrary<Answer> = fc.record({
    itemIds: fc.array(idArb, { maxLength: 6 }),
    note: fc.array(fc.string({ maxLength: 30 }), { maxLength: 4 }).map((lines) => lines.join('\n')),
  });
  const answersArb: fc.Arbitrary<SeanceAnswers> = fc.record({ restless: answerArb, lessons: answerArb, keepAlive: answerArb });
  return fc.record({ items: fc.constant(items), now: nowArb, answers: answersArb });
});

describe('buildPlan properties', () => {
  it('never invents a deadline: every step is a given item with its own title, due time and Demo flag, once', () => {
    fc.assert(
      fc.property(scenarioArb, ({ items, now, answers }) => {
        const byId = new Map(items.map((i) => [i.id, i]));
        const plan = buildPlan(items, answers, now);
        for (const step of plan.steps) {
          const item = byId.get(step.itemId);
          expect(item).toBeDefined();
          expect([step.title, step.dueAt, step.demo]).toEqual([item?.title, item?.dueAt, item?.demo]);
        }
        expect(new Set(plan.steps.map((s) => s.itemId)).size).toBe(plan.steps.length);
      }),
      { numRuns: RUNS },
    );
  });

  it('always includes every due-soon item, and every open item due within 7 days', () => {
    fc.assert(
      fc.property(scenarioArb, ({ items, now, answers }) => {
        const plan = buildPlan(items, answers, now);
        const stepOf = new Map(plan.steps.map((s) => [s.itemId, s]));
        for (const item of items) {
          if (deriveStatus(item, now) === 'due-soon') expect(stepOf.get(item.id)?.action).toBe('work');
          if (open(item, now) && item.dueAt - now < WEEK_MS) expect(stepOf.has(item.id)).toBe(true);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('puts every open Q3 pick before any other step (R2.1)', () => {
    fc.assert(
      fc.property(scenarioArb, ({ items, now, answers }) => {
        const plan = buildPlan(items, answers, now);
        const kept = new Set(items.filter((i) => answers.keepAlive.itemIds.includes(i.id) && open(i, now)).map((i) => i.id));
        const firstOther = plan.steps.findIndex((s) => !kept.has(s.itemId));
        const lastKept = plan.steps.reduce((last, s, i) => (kept.has(s.itemId) ? i : last), -1);
        expect(plan.steps.filter((s) => kept.has(s.itemId))).toHaveLength(kept.size);
        if (firstOther >= 0) expect(lastKept).toBeLessThan(firstOther);
        expect(plan.steps.filter((s) => s.section === 'keep').every((s) => kept.has(s.itemId))).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('only plans work, revive and bury for unresolved open items, and epitaphs only for bare graves picked in Q2', () => {
    fc.assert(
      fc.property(scenarioArb, ({ items, now, answers }) => {
        const byId = new Map(items.map((i) => [i.id, i]));
        for (const step of buildPlan(items, answers, now).steps) {
          const item = byId.get(step.itemId) as Item;
          const status = deriveStatus(item, now);
          if (step.action === 'epitaph') {
            expect(['missed', 'buried']).toContain(status);
            expect(answers.lessons.itemIds).toContain(item.id);
            expect(item.epitaph?.trim() ?? '').toBe('');
            expect(step.epitaph?.length ?? 0).toBeGreaterThan(0);
            expect(step.epitaph?.length ?? 0).toBeLessThanOrEqual(280);
          } else {
            expect(item.resolution).toBeNull();
            expect(open(item, now)).toBe(true);
          }
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('suggests revive for a Q1 ghost kept in Q3 and bury otherwise (R2.2)', () => {
    fc.assert(
      fc.property(scenarioArb, ({ items, now, answers }) => {
        const plan = buildPlan(items, answers, now);
        for (const item of items) {
          if (deriveStatus(item, now) !== 'ghost' || !answers.restless.itemIds.includes(item.id)) continue;
          const expected = answers.keepAlive.itemIds.includes(item.id) ? 'revive' : 'bury';
          expect(plan.steps.find((s) => s.itemId === item.id)?.action).toBe(expected);
        }
      }),
      { numRuns: RUNS },
    );
  });

  it('is deterministic and does not depend on the order items are stored in', () => {
    fc.assert(
      fc.property(scenarioArb, ({ items, now, answers }) => {
        const plan = buildPlan(items, answers, now);
        expect(buildPlan(items, answers, now)).toEqual(plan);
        expect(buildPlan([...items].reverse(), answers, now)).toEqual(plan);
      }),
      { numRuns: RUNS },
    );
  });
});

describe('candidatesFor properties (R1.1)', () => {
  it('Q1 includes every due-soon item and every ghost; Q3 is exactly the open items', () => {
    fc.assert(
      fc.property(scenarioArb, ({ items, now }) => {
        const q1 = new Set(candidatesFor(1, items, now).map((i) => i.id));
        const q3 = candidatesFor(3, items, now).map((i) => i.id);
        for (const item of items) {
          const status = deriveStatus(item, now);
          if (status === 'due-soon' || status === 'ghost') expect(q1.has(item.id)).toBe(true);
        }
        expect(new Set(q3)).toEqual(new Set(items.filter((i) => open(i, now)).map((i) => i.id)));
      }),
      { numRuns: RUNS },
    );
  });
});
