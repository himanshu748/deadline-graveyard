// User actions as pure functions. Each returns a new item or a typed error and never
// mutates its input. Rules: deadline-domain.md "Transitions caused by user actions".
import { deriveStatus } from './status.ts';
import { normalizeZone } from './time.ts';
import type { ActionErrorCode, EpochMs, Item, Result } from './types.ts';

export const EPITAPH_MAX_LENGTH = 280;

function fail(code: ActionErrorCode): Result<Item> {
  return { ok: false, error: { code } };
}

function done(item: Item): Result<Item> {
  return { ok: true, value: item };
}

/** R2.6, R2.7: submit an unresolved item before its due instant. */
export function submit(item: Item, now: EpochMs): Result<Item> {
  if (item.resolution !== null) return fail('resolved');
  if (now >= item.dueAt) return fail('past-due');
  return done({ ...item, resolution: { kind: 'submitted', at: now }, lastActivityAt: now });
}

/** R2.8: bury a ghost or a missed item. */
export function bury(item: Item, now: EpochMs): Result<Item> {
  if (item.resolution !== null) return fail('resolved');
  const status = deriveStatus(item, now);
  if (status !== 'ghost' && status !== 'missed') return fail('not-missed-or-ghost');
  return done({ ...item, resolution: { kind: 'buried', at: now } });
}

/** R2.9: revive a ghost by recording activity now. */
export function revive(item: Item, now: EpochMs): Result<Item> {
  if (item.resolution !== null) return fail('resolved');
  if (deriveStatus(item, now) !== 'ghost') return fail('not-ghost');
  return done({ ...item, lastActivityAt: now });
}

/** R2.12: record activity (for example a note) on an unresolved item. */
export function touch(item: Item, now: EpochMs): Result<Item> {
  if (item.resolution !== null) return fail('resolved');
  return done({ ...item, lastActivityAt: now });
}

/** R2.10, R2.13: change the due instant of an unresolved item. Counts as activity. */
export function editDue(
  item: Item,
  dueAt: EpochMs,
  zone: string,
  dateOnly: boolean,
  now: EpochMs,
): Result<Item> {
  if (item.resolution !== null) return fail('resolved');
  const canonical = normalizeZone(zone);
  if (!Number.isSafeInteger(dueAt) || canonical === null) return fail('invalid');
  return done({ ...item, dueAt, zone: canonical, dateOnly, lastActivityAt: now });
}

/**
 * R2.11: write, edit or clear (empty text) the epitaph of a missed or buried item.
 * The status does not change and the epitaph is not counted as activity.
 */
export function setEpitaph(item: Item, text: string, now: EpochMs): Result<Item> {
  const status = deriveStatus(item, now);
  if (status !== 'missed' && status !== 'buried') return fail('not-missed-or-buried');
  const trimmed = text.trim();
  if (trimmed.length > EPITAPH_MAX_LENGTH) return fail('invalid');
  if (trimmed.length === 0) {
    const rest = { ...item };
    delete rest.epitaph;
    return done(rest);
  }
  return done({ ...item, epitaph: trimmed });
}
