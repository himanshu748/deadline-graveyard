// Reminder scheduling as pure logic (capture-and-export R3.2). The app calls dueReminders on its
// one-second clock; each reminder fires once per item, offset and due instant, so editing the
// deadline re-arms it. No clock is read here: `now` is a parameter.
import { DUE_SOON_MS } from '../domain/status.ts';
import type { EpochMs, Item } from '../domain/types.ts';

export const HOUR_MS = 3_600_000;

/** R3.2: when the candle enters its last 24 h (due-soon) and 1 h before it burns out. */
export const REMINDER_OFFSETS_MS = [DUE_SOON_MS, HOUR_MS] as const;

export interface Reminder {
  /** Stable key stored in the "sent" set. */
  key: string;
  itemId: string;
  title: string;
  body: string;
}

export function reminderKey(item: Item, offsetMs: number): string {
  return `${item.id}|${item.dueAt}|${offsetMs}`;
}

function describeOffset(offsetMs: number): string {
  return offsetMs >= DUE_SOON_MS ? 'less than 24 hours' : offsetMs >= HOUR_MS ? 'less than 1 hour' : 'minutes';
}

/**
 * Reminders that should fire now: the item is unresolved, `now` is inside [due - offset, due),
 * and the key is not in `sent`. When both windows are open (for example the app was closed all
 * day), only the latest one fires, so the user gets one notification instead of two.
 */
export function dueReminders(items: Item[], now: EpochMs, sent: ReadonlySet<string>, offsets: readonly number[] = REMINDER_OFFSETS_MS): Reminder[] {
  const out: Reminder[] = [];
  const sorted = [...offsets].sort((a, b) => a - b);
  for (const item of items) {
    if (item.resolution !== null || now >= item.dueAt) continue;
    const open = sorted.find((offset) => now >= item.dueAt - offset);
    if (open === undefined) continue;
    const key = reminderKey(item, open);
    if (sent.has(key)) continue;
    const label = item.demo ? `[Demo] ${item.title}` : item.title;
    out.push({ key, itemId: item.id, title: `${label}: ${describeOffset(open)} left`, body: 'Your candle is burning down in Deadline Graveyard.' });
  }
  return out;
}

/** Keys to remember after firing: the fired one plus every wider window, so they never fire late. */
export function keysToMark(items: Item[], fired: Reminder[], offsets: readonly number[] = REMINDER_OFFSETS_MS): string[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const keys: string[] = [];
  for (const r of fired) {
    const item = byId.get(r.itemId);
    if (!item) continue;
    const firedOffset = offsets.find((o) => reminderKey(item, o) === r.key);
    if (firedOffset === undefined) continue;
    for (const o of offsets) if (o >= firedOffset) keys.push(reminderKey(item, o));
  }
  return keys;
}

/** Drops keys of items that no longer exist or whose due instant changed, to keep storage small. */
export function pruneSent(items: Item[], sent: Iterable<string>): string[] {
  const live = new Set(items.map((i) => `${i.id}|${i.dueAt}|`));
  return [...sent].filter((k) => live.has(k.slice(0, k.lastIndexOf('|') + 1)));
}
