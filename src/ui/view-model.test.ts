// Validates: accessible-list-view R1.1 to R1.4, R2.2, R3.1, R3.2, R3.3.
import { describe, expect, it, vi } from 'vitest';
import { DAY, DUE, HOUR, makeItem } from '../domain/test-items.ts';
import { createAnnouncer } from './announcer.ts';
import { allowedActions, coarseDuration, deriveViewModel, diffStatuses, GROUP_ORDER, nextFocusIndex } from './view-model.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = DUE - 3 * DAY;

const items = [
  makeItem({ id: id(1), title: 'Spring course essay', dueAt: now + 5 * DAY, createdAt: now - DAY, lastActivityAt: now, zone: 'UTC' }),
  makeItem({ id: id(2), title: 'Grant form', dueAt: now + 2 * HOUR, createdAt: now - DAY, lastActivityAt: now, zone: 'UTC' }),
  makeItem({ id: id(3), title: 'Game jam', dueAt: now - HOUR, zone: 'UTC', epitaph: 'Scope smaller' }),
  makeItem({ id: id(4), title: 'Old idea', dueAt: now + 9 * DAY, createdAt: now - 20 * DAY, lastActivityAt: now - 9 * DAY, zone: 'UTC', demo: true }),
  makeItem({ id: id(5), title: 'Kiroween', dueAt: now + DAY, resolution: { kind: 'submitted', at: now - HOUR } }),
];

describe('deriveViewModel', () => {
  const vm = deriveViewModel(items, now, 'UTC', 'en-GB');

  it('has one entry per item, in due order (R1.1)', () => {
    expect(vm.entries.map((e) => e.id).sort()).toEqual(items.map((i) => i.id).sort());
    const dues = vm.entries.map((e) => items.find((i) => i.id === e.id)?.dueAt ?? 0);
    expect(dues).toEqual([...dues].sort((a, b) => a - b));
  });

  it('groups in the order due soon, active, ghosts, missed, buried, submitted, skipping empty groups (R1.2)', () => {
    expect(vm.groups.map((g) => g.status)).toEqual(['due-soon', 'active', 'ghost', 'missed', 'submitted']);
    expect(GROUP_ORDER).toEqual(['due-soon', 'active', 'ghost', 'missed', 'buried', 'submitted']);
  });

  it('describes status in words, the Demo label and the epitaph (R1.3)', () => {
    const ghost = vm.entries.find((e) => e.id === id(4));
    expect(ghost?.statusText).toBe('ghost, inactive 9 days');
    expect(ghost?.demo).toBe(true);
    expect(vm.entries.find((e) => e.id === id(3))?.epitaph).toBe('Scope smaller');
  });

  it('shows the user zone first and the source zone when it differs (R1.3)', () => {
    const lantern = vm.entries.find((e) => e.id === id(5));
    expect(lantern?.dueText).toMatch(/UTC/);
    expect(lantern?.sourceDueText).toMatch(/America\/Los_Angeles$/);
    expect(vm.entries.find((e) => e.id === id(1))?.sourceDueText).toBeUndefined();
  });

  it('builds accessible names as "<title>, <status>, due <time>" (R3.1)', () => {
    const e = vm.entries.find((x) => x.id === id(2));
    expect(e?.accessibleName).toBe(`Grant form, due soon, due ${e?.dueText}`);
    expect(vm.entries.find((x) => x.id === id(4))?.accessibleName).toMatch(/, Demo$/);
  });

  it('keeps accessible names stable while the clock ticks (R3.3)', () => {
    const later = deriveViewModel(items, now + 59_000, 'UTC', 'en-GB');
    expect(later.entries.map((e) => e.accessibleName)).toEqual(vm.entries.map((e) => e.accessibleName));
  });

  it('marks date-only deadlines and survives a bad stored zone', () => {
    const odd = deriveViewModel([makeItem({ dateOnly: true }), makeItem({ id: id(9), zone: 'Not/AZone' })], now, 'UTC', 'en');
    expect(odd.entries.find((e) => e.id === id(9))?.dueText).toBe('time unavailable');
    expect(odd.entries.find((e) => e.id !== id(9))?.dueText).toMatch(/\(end of day\)$/);
  });
});

describe('allowedActions (R1.4)', () => {
  it('offers each status its actions', () => {
    expect(allowedActions('active')).toEqual(['submit', 'edit']);
    expect(allowedActions('due-soon')).toEqual(['submit', 'edit']);
    expect(allowedActions('ghost')).toEqual(['revive', 'submit', 'bury', 'edit']);
    expect(allowedActions('missed')).toEqual(['epitaph', 'bury', 'edit']);
    expect(allowedActions('buried')).toEqual(['epitaph']);
    expect(allowedActions('submitted')).toEqual([]);
  });
});

describe('nextFocusIndex (R2.2)', () => {
  it('moves by one with arrows, clamped at the ends', () => {
    expect(nextFocusIndex(0, 'ArrowRight', 3)).toBe(1);
    expect(nextFocusIndex(2, 'ArrowRight', 3)).toBe(2);
    expect(nextFocusIndex(1, 'ArrowLeft', 3)).toBe(0);
    expect(nextFocusIndex(0, 'ArrowLeft', 3)).toBe(0);
  });

  it('jumps with Home and End and ignores other keys', () => {
    expect(nextFocusIndex(1, 'Home', 5)).toBe(0);
    expect(nextFocusIndex(1, 'End', 5)).toBe(4);
    expect(nextFocusIndex(1, 'a', 5)).toBe(1);
    expect(nextFocusIndex(0, 'End', 0)).toBe(-1);
  });
});

describe('diffStatuses and the announcer (R3.2)', () => {
  it('reports only changed statuses', () => {
    const prev = new Map([
      ['a', 'active' as const],
      ['b', 'active' as const],
    ]);
    const next = new Map([
      ['a', 'due-soon' as const],
      ['b', 'active' as const],
      ['c', 'active' as const],
    ]);
    expect(diffStatuses(prev, next)).toEqual([{ id: 'a', from: 'active', to: 'due-soon' }]);
  });

  it('announces once and drops a duplicate within 1 s', () => {
    vi.useFakeTimers();
    const el = { textContent: '' } as HTMLElement;
    let t = 0;
    const a = createAnnouncer(el, () => t);
    a.announce('Grant form is now due soon.');
    vi.advanceTimersByTime(60);
    expect(el.textContent).toBe('Grant form is now due soon.');
    el.textContent = 'x';
    t = 500;
    a.announce('Grant form is now due soon.');
    vi.advanceTimersByTime(60);
    expect(el.textContent).toBe('x');
    vi.useRealTimers();
  });

  it('describes durations coarsely', () => {
    expect(coarseDuration(3 * DAY)).toBe('3 days');
    expect(coarseDuration(5 * HOUR)).toBe('5 hours');
    expect(coarseDuration(10 * 60_000)).toBe('under an hour');
  });
});
