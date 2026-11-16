// Validates: capture-and-export R3.2 (scheduling as pure logic)
import { describe, expect, it } from 'vitest';
import { DAY, DUE, HOUR, makeItem } from '../domain/test-items.ts';
import { dueReminders, keysToMark, pruneSent, reminderKey } from './reminders.ts';

const item = makeItem({ title: 'Essay' });

describe('dueReminders (R3.2)', () => {
  it('is silent before the last 24 h', () => {
    expect(dueReminders([item], DUE - DAY - 1, new Set())).toEqual([]);
  });

  it('fires once when the item becomes due-soon', () => {
    const [r] = dueReminders([item], DUE - DAY, new Set());
    expect(r).toMatchObject({ key: reminderKey(item, DAY), itemId: item.id, title: 'Essay: less than 24 hours left' });
    expect(dueReminders([item], DUE - DAY + 1000, new Set([reminderKey(item, DAY)]))).toEqual([]);
  });

  it('fires again 1 h before due', () => {
    const sent = new Set([reminderKey(item, DAY)]);
    const [r] = dueReminders([item], DUE - HOUR, sent);
    expect(r?.title).toBe('Essay: less than 1 hour left');
  });

  it('sends only the latest reminder when the app opens inside both windows', () => {
    const fired = dueReminders([item], DUE - 30 * 60_000, new Set());
    expect(fired.map((r) => r.key)).toEqual([reminderKey(item, HOUR)]);
    const marked = new Set(keysToMark([item], fired));
    expect(marked).toEqual(new Set([reminderKey(item, HOUR), reminderKey(item, DAY)]));
    expect(dueReminders([item], DUE - 10 * 60_000, marked)).toEqual([]);
  });

  it('never fires for resolved or past items', () => {
    expect(dueReminders([makeItem({ resolution: { kind: 'submitted', at: DUE - 2 * DAY } })], DUE - HOUR, new Set())).toEqual([]);
    expect(dueReminders([item], DUE, new Set())).toEqual([]);
  });

  it('labels demo items', () => {
    expect(dueReminders([makeItem({ demo: true, title: 'Demo jam' })], DUE - HOUR, new Set())[0]?.title).toMatch(/^\[Demo\] Demo jam/);
  });

  it('re-arms after the deadline moves', () => {
    const sent = new Set(keysToMark([item], dueReminders([item], DUE - HOUR, new Set())));
    const moved = { ...item, dueAt: DUE + DAY };
    expect(dueReminders([moved], DUE + DAY - HOUR, sent)).toHaveLength(1);
    expect(pruneSent([moved], sent)).toEqual([]);
    expect(pruneSent([item], sent).sort()).toEqual([...sent].sort());
  });
});
