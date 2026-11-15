// Test-only helper: a valid unresolved item with fixed instants. Nothing in the app imports it.
import type { Item } from './types.ts';

/** 2026-12-04T22:00:00Z, the Kiroween 2026 deadline (2:00 PM PT). */
export const DUE = Date.UTC(2026, 11, 4, 22, 0, 0);
export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

export function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Test deadline',
    dueAt: DUE,
    zone: 'America/Los_Angeles',
    dateOnly: false,
    createdAt: DUE - 10 * DAY,
    lastActivityAt: DUE - 2 * DAY,
    resolution: null,
    demo: false,
    ...overrides,
  };
}
