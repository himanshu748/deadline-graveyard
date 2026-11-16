// Validates: first-visit R1.1, R2.1, R2.2, R2.3, R2.6 (demo seed, pure).
import { describe, expect, it } from 'vitest';
import { toIcs } from '../../capture/ics.ts';
import { deriveStatus, DUE_SOON_MS, GHOST_AFTER_MS } from '../../domain/status.ts';
import { DAY, DUE, HOUR, makeItem } from '../../domain/test-items.ts';
import { deriveViewModel } from '../view-model.ts';
import { clearDemo, DEMO_EPITAPH, DEMO_IDS, demoItems, shouldStartIntro, withDemo } from './demo-seed.ts';

const NOW = DUE - 20 * DAY + 37_123;

describe('demoItems (R2.1)', () => {
  const items = demoItems(NOW, 'Europe/London');

  it('seeds exactly 3 items, all demo = true, in the given zone', () => {
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.demo)).toBe(true);
    expect(items.every((i) => i.zone === 'Europe/London' && !i.dateOnly && i.resolution === null)).toBe(true);
    expect(new Set(items.map((i) => i.id))).toEqual(new Set(Object.values(DEMO_IDS)));
  });

  it('starts as ghost (A), due-soon (B) and missed (C) under the real status rules', () => {
    const status = Object.fromEntries(items.map((i) => [i.id, deriveStatus(i, NOW)]));
    expect(status).toEqual({ [DEMO_IDS.a]: 'ghost', [DEMO_IDS.b]: 'due-soon', [DEMO_IDS.c]: 'missed' });
  });

  it('places A about 5 days ahead with 8 days of silence, B about 6 hours ahead, C about 1 day ago', () => {
    const [a, b, c] = [DEMO_IDS.a, DEMO_IDS.b, DEMO_IDS.c].map((id) => items.find((i) => i.id === id));
    expect(a && a.dueAt - NOW).toBeGreaterThanOrEqual(5 * DAY);
    expect(a && a.dueAt - NOW).toBeLessThan(5 * DAY + 60_000);
    expect(a && NOW - a.lastActivityAt).toBe(8 * DAY);
    expect(a && NOW - a.lastActivityAt).toBeGreaterThanOrEqual(GHOST_AFTER_MS);
    expect(b && b.dueAt - NOW).toBeGreaterThanOrEqual(6 * HOUR);
    expect(b && b.dueAt - NOW).toBeLessThan(DUE_SOON_MS);
    expect(c && NOW - c.dueAt).toBeGreaterThan(DAY - 60_000);
    expect(c && NOW - c.dueAt).toBeLessThanOrEqual(DAY);
  });

  it('keeps every instant consistent: created before the last activity, due times on a whole minute', () => {
    for (const i of items) {
      expect(i.createdAt).toBeLessThanOrEqual(i.lastActivityAt);
      expect(i.lastActivityAt).toBeLessThanOrEqual(NOW);
      expect(i.dueAt % 60_000).toBe(0);
    }
  });

  it('gives only C an epitaph, and the epitaph itself says it is demo text', () => {
    expect(items.filter((i) => i.epitaph !== undefined).map((i) => i.id)).toEqual([DEMO_IDS.c]);
    expect(DEMO_EPITAPH.startsWith('Demo epitaph:')).toBe(true);
  });

  it('is the same for the same instant, so seeding is repeatable', () => {
    expect(demoItems(NOW, 'UTC')).toEqual(demoItems(NOW, 'UTC'));
  });
});

describe('Demo labels (R2.2, R2.3)', () => {
  const items = demoItems(NOW, 'UTC');

  it('starts every title with "Demo:" and names no real event, person or organisation', () => {
    expect(items.map((i) => i.title)).toEqual(['Demo: Weekend game jam submission', 'Demo: Course project report', 'Demo: Scholarship essay']);
  });

  it('labels the list view entries and their accessible names', () => {
    const vm = deriveViewModel(items, NOW, 'UTC', 'en-GB');
    expect(vm.entries).toHaveLength(3);
    for (const e of vm.entries) {
      expect(e.demo).toBe(true);
      expect(e.accessibleName).toMatch(/, Demo$/);
    }
  });

  it('marks every exported event as Demo in the .ics file', () => {
    const ics = toIcs(items, NOW);
    expect(ics.match(/^SUMMARY:\[Demo\] Demo: /gm)).toHaveLength(3);
    expect(ics.match(/^X-DG-DEMO:TRUE/gm)).toHaveLength(3);
  });
});

describe('clearDemo and withDemo (R2.5, R2.6)', () => {
  const mine = makeItem({ id: '00000000-0000-4000-8000-000000000301', title: 'My essay' });

  it('removes the demo items and keeps the user item untouched', () => {
    const all = [mine, ...demoItems(NOW, 'UTC')];
    expect(clearDemo(all)).toEqual([mine]);
    expect(clearDemo(all)[0]).toBe(mine);
  });

  it('replaces old demo items instead of adding 3 more, however often it runs', () => {
    const once = withDemo([mine], NOW, 'UTC');
    const twice = withDemo(once, NOW, 'UTC');
    expect(twice).toEqual(once);
    expect(twice.filter((i) => i.demo)).toHaveLength(3);
    expect(twice.filter((i) => !i.demo)).toEqual([mine]);
  });
});

describe('shouldStartIntro (R1.1, R2.6)', () => {
  it('starts only for an empty graveyard that has not seen the intro', () => {
    expect(shouldStartIntro(0, false)).toBe(true);
    expect(shouldStartIntro(0, true)).toBe(false);
    expect(shouldStartIntro(1, false)).toBe(false);
    expect(shouldStartIntro(3, true)).toBe(false);
  });
});
