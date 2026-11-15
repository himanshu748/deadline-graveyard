// Timezone, DST and date-only handling with the Temporal API (temporal-polyfill).
// Policy (deadline-domain.md, R3.2): disambiguation 'compatible'. A local time in a
// spring-forward gap shifts forward by the gap; a repeated fall-back time takes the
// earlier offset. The domain never reads the clock: every instant is a parameter.
import { Temporal } from 'temporal-polyfill';
import type { EpochMs } from './types.ts';

export interface LocalInput {
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm or HH:mm:ss. Omitted means a date-only deadline. */
  time?: string;
  /** IANA zone identifier. */
  zone: string;
}

export type Adjustment = 'none' | 'gap-shifted' | 'ambiguous-earlier';

export type ConversionError = 'invalid-zone' | 'invalid-date' | 'invalid-time';

export type Converted =
  | { ok: true; epochMs: EpochMs; dateOnly: boolean; adjustment: Adjustment }
  | { ok: false; error: ConversionError };

/** R3.4: a date without a time means the last second of that day in the deadline's zone. */
export const DATE_ONLY_TIME = '23:59:59';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

/** Returns the canonical zone id, or null when the zone is not a valid IANA zone (R3.7). */
export function normalizeZone(zone: string): string | null {
  if (typeof zone !== 'string' || zone.length === 0) return null;
  try {
    return Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(zone).timeZoneId;
  } catch {
    return null;
  }
}

export function isValidZone(zone: string): boolean {
  return normalizeZone(zone) !== null;
}

/** R3.2 to R3.4, R3.7: local wall-clock date and time in a zone to an instant. */
export function toInstant(input: LocalInput): Converted {
  const zone = normalizeZone(input.zone);
  if (zone === null) return { ok: false, error: 'invalid-zone' };

  if (!DATE_RE.test(input.date)) return { ok: false, error: 'invalid-date' };
  let date: Temporal.PlainDate;
  try {
    date = Temporal.PlainDate.from(input.date, { overflow: 'reject' });
  } catch {
    return { ok: false, error: 'invalid-date' };
  }

  const dateOnly = input.time === undefined;
  const timeText = input.time ?? DATE_ONLY_TIME;
  if (!TIME_RE.test(timeText)) return { ok: false, error: 'invalid-time' };
  let time: Temporal.PlainTime;
  try {
    time = Temporal.PlainTime.from(timeText, { overflow: 'reject' });
  } catch {
    return { ok: false, error: 'invalid-time' };
  }

  const local = date.toPlainDateTime(time);
  const chosen = local.toZonedDateTime(zone, { disambiguation: 'compatible' });
  const earlier = local.toZonedDateTime(zone, { disambiguation: 'earlier' });
  const later = local.toZonedDateTime(zone, { disambiguation: 'later' });

  let adjustment: Adjustment = 'none';
  if (earlier.epochMilliseconds !== later.epochMilliseconds) {
    adjustment = chosen.toPlainDateTime().equals(local) ? 'ambiguous-earlier' : 'gap-shifted';
  }
  return { ok: true, epochMs: chosen.epochMilliseconds, dateOnly, adjustment };
}

/** Wall-clock date (YYYY-MM-DD) and time (HH:mm:ss, truncated) of an instant in a valid zone. */
export function toLocal(epochMs: EpochMs, zone: string): { date: string; time: string } {
  const zdt = Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(zone);
  return {
    date: zdt.toPlainDate().toString(),
    time: zdt.toPlainTime().toString({ smallestUnit: 'second' }),
  };
}

const DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
};

/**
 * R3.6: the instant in the user's zone, plus the source zone time when the zones differ.
 * Both zones must be valid; the UI reads the user zone once and passes it in.
 */
export function formatForDisplay(
  epochMs: EpochMs,
  userZone: string,
  sourceZone: string,
  locale: string,
): { primary: string; source?: string } {
  const instant = Temporal.Instant.fromEpochMilliseconds(epochMs);
  const user = instant.toZonedDateTimeISO(userZone);
  const primary = user.toLocaleString(locale, DISPLAY_OPTIONS);
  const source = instant.toZonedDateTimeISO(sourceZone);
  if (source.timeZoneId === user.timeZoneId) return { primary };
  return { primary, source: source.toLocaleString(locale, DISPLAY_OPTIONS) };
}
