// Validates: graveyard-scene R1.5, R2.1, R2.4 to R2.7, R2.9 (layout side).
import { describe, expect, it } from 'vitest';
import { DAY, DUE, HOUR, makeItem } from '../domain/test-items.ts';
import type { Item } from '../domain/types.ts';
import { flicker, waxFraction } from '../domain/visual.ts';
import { BASE_HEIGHT, layoutScene, truncate, VIEW_WIDTH, wrapText } from './layout.ts';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function itemsOfEveryKind(now: number): Item[] {
  return [
    makeItem({ id: id(1), title: 'Active', dueAt: now + 5 * DAY, createdAt: now - 5 * DAY, lastActivityAt: now }),
    makeItem({ id: id(2), title: 'Due soon', dueAt: now + 2 * HOUR, createdAt: now - 2 * DAY, lastActivityAt: now }),
    makeItem({ id: id(3), title: 'Missed', dueAt: now - HOUR, epitaph: 'Start earlier' }),
    makeItem({ id: id(4), title: 'Buried', dueAt: now - DAY, resolution: { kind: 'buried', at: now - HOUR } }),
    makeItem({ id: id(5), title: 'Submitted', dueAt: now + DAY, resolution: { kind: 'submitted', at: now - HOUR } }),
    makeItem({ id: id(6), title: 'Ghost', dueAt: now + 20 * DAY, createdAt: now - 30 * DAY, lastActivityAt: now - 10 * DAY, demo: true }),
  ];
}

describe('layoutScene', () => {
  const now = DUE - 3 * DAY;

  it('maps each status to its scene element', () => {
    const kinds = Object.fromEntries(layoutScene(itemsOfEveryKind(now), now).nodes.map((n) => [n.title, n.kind]));
    expect(kinds).toEqual({
      Active: 'candle',
      'Due soon': 'candle',
      Missed: 'tombstone',
      Buried: 'tombstone',
      Submitted: 'lantern',
      Ghost: 'ghost',
    });
  });

  it('returns one node per item in due order', () => {
    const items = itemsOfEveryKind(now);
    const { nodes } = layoutScene(items, now);
    expect(nodes).toHaveLength(items.length);
    const dues = nodes.map((n) => items.find((i) => i.id === n.id)?.dueAt ?? 0);
    expect(dues).toEqual([...dues].sort((a, b) => a - b));
  });

  it('reads wax and flicker from domain/visual.ts (R2.1 to R2.3)', () => {
    const items = itemsOfEveryKind(now);
    for (const node of layoutScene(items, now).nodes) {
      const item = items.find((i) => i.id === node.id);
      if (!item) throw new Error('missing item');
      expect(node.wax).toBe(waxFraction(item, now));
      expect(node.flicker).toEqual(flicker(item, now));
    }
    const dueSoon = layoutScene(items, now).nodes.find((n) => n.title === 'Due soon');
    expect(dueSoon?.flicker?.speed).toBe('fast');
  });

  it('shrinks a candle as time passes', () => {
    const item = makeItem({ createdAt: DUE - 10 * DAY, lastActivityAt: DUE - DAY });
    const early = layoutScene([item], DUE - 8 * DAY).nodes[0]?.wax ?? 0;
    const late = layoutScene([item], DUE - 2 * DAY).nodes[0]?.wax ?? 0;
    expect(late).toBeLessThan(early);
  });

  it('keeps the demo flag and epitaph (R2.4, R2.7)', () => {
    const { nodes } = layoutScene(itemsOfEveryKind(now), now);
    expect(nodes.find((n) => n.title === 'Ghost')?.demo).toBe(true);
    expect(nodes.find((n) => n.title === 'Missed')?.epitaph).toBe('Start earlier');
  });

  it('places 40 candles in extra rows and grows the scene instead of overlapping (R1.5)', () => {
    const many = Array.from({ length: 40 }, (_, i) => makeItem({ id: id(100 + i), dueAt: now + (i + 1) * DAY, createdAt: now - DAY, lastActivityAt: now }));
    const layout = layoutScene(many, now);
    expect(layout.height).toBeGreaterThan(BASE_HEIGHT);
    const rows = new Set(layout.nodes.map((n) => n.y));
    expect(rows.size).toBeGreaterThan(1);
  });

  it('keeps the base composition for an empty graveyard', () => {
    const layout = layoutScene([], now);
    expect(layout).toMatchObject({ width: VIEW_WIDTH, height: BASE_HEIGHT, nodes: [] });
  });
});

describe('text fitting', () => {
  it('truncates with an ellipsis', () => {
    expect(truncate('Kiroween', 10)).toBe('Kiroween');
    expect(truncate('Kiroween hackathon', 10)).toBe('Kiroween\u2026');
    expect(truncate('Kiroween hackathon', 10).length).toBeLessThanOrEqual(10);
  });

  it('wraps an epitaph into at most 3 lines, each within the width', () => {
    const lines = wrapText('Start the demo video two days before the deadline, not two hours', 11, 3);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(11);
    expect(lines.at(-1)?.endsWith('\u2026')).toBe(true);
  });

  it('keeps short text as is', () => {
    expect(wrapText('No epitaph yet', 11, 3)).toEqual(['No epitaph', 'yet']);
  });
});
