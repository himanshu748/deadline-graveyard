// Rule-based date finder for fetched metadata and pasted page text (capture-and-export R1.2,
// R1.8). Pure: no clock, no DOM. Every candidate is a wall-clock date (and time) in a valid IANA
// zone, ready for domain/time.ts toInstant, so the user always sees and confirms local values.
import { Temporal } from 'temporal-polyfill';
import { normalizeZone, toInstant, toLocal } from '../domain/time.ts';

export interface DateCandidate {
  /** The text the date was read from, for the picker label. */
  text: string;
  /** YYYY-MM-DD in `zone`. */
  date: string;
  /** HH:mm in `zone`; absent for date-only. */
  time?: string;
  zone: string;
  /** True when the source gave no zone or offset and the reference zone was assumed. */
  zoneAssumed: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11,
  november: 11, dec: 12, december: 12,
};

/**
 * Common English zone abbreviations on event pages, mapped to the zone they name. Daylight and
 * standard forms map to the same IANA zone, which then applies the right offset for the date.
 * Ambiguous ones (IST, CST in Asia) are left out on purpose.
 */
export const ZONE_ABBREVIATIONS: Record<string, string> = {
  PT: 'America/Los_Angeles', PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles',
  MT: 'America/Denver', MST: 'America/Denver', MDT: 'America/Denver',
  CT: 'America/Chicago', CST: 'America/Chicago', CDT: 'America/Chicago',
  ET: 'America/New_York', EST: 'America/New_York', EDT: 'America/New_York',
  UTC: 'UTC', GMT: 'UTC', Z: 'UTC',
  BST: 'Europe/London', CET: 'Europe/Paris', CEST: 'Europe/Paris',
  AEST: 'Australia/Sydney', AEDT: 'Australia/Sydney', JST: 'Asia/Tokyo',
};

const pad = (n: number) => String(n).padStart(2, '0');

function isRealDate(date: string): boolean {
  return toInstant({ date, zone: 'UTC' }).ok;
}

const ISO_RE = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * An ISO 8601 date or date-time as found in JSON-LD or `<time datetime>`. A value with an offset
 * is an exact instant: it is shown in UTC for `Z` or `+00:00`, otherwise in the reference zone.
 * A value without an offset is local time in the reference zone, flagged as assumed.
 */
export function parseIsoLike(value: string, referenceZone: string): DateCandidate | null {
  const zoneRef = normalizeZone(referenceZone) ?? 'UTC';
  const text = value.trim();
  const m = ISO_RE.exec(text);
  if (!m) return null;
  const [, date = '', hh, mm, , offset] = m;
  if (!isRealDate(date)) return null;
  if (hh === undefined || mm === undefined) return { text, date, zone: zoneRef, zoneAssumed: true };
  if (Number(hh) > 23 || Number(mm) > 59) return null;
  if (offset === undefined) return { text, date, time: `${hh}:${mm}`, zone: zoneRef, zoneAssumed: true };
  let epochMs: number;
  try {
    const normalized = offset.toUpperCase() === 'Z' ? 'Z' : offset.includes(':') ? offset : `${offset.slice(0, 3)}:${offset.slice(3)}`;
    epochMs = Temporal.Instant.from(`${date}T${hh}:${mm}:${m[4] ?? '00'}${normalized}`).epochMilliseconds;
    const isUtc = normalized === 'Z' || /^[+-]00:00$/.test(normalized);
    const zone = isUtc ? 'UTC' : zoneRef;
    const local = toLocal(epochMs, zone);
    return { text, date: local.date, time: local.time.slice(0, 5), zone, zoneAssumed: false };
  } catch {
    return null;
  }
}

const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const ZONE_NAMES = Object.keys(ZONE_ABBREVIATIONS).sort((a, b) => b.length - a.length).join('|');
const MERIDIEM = String.raw`(am|pm|a\.m\.|p\.m\.)`;
// A time needs minutes or am/pm, so "1 Sep 2026 10 places" is date-only.
const TIME_PART = String.raw`(?:\s*(?:,|at|@|-|by)?\s*(\d{1,2})(?::(\d{2})\s*${MERIDIEM}?|\s*${MERIDIEM}))?(?:\s*\(?\b(${ZONE_NAMES})\b\)?)?`;
const DAY_FIRST = new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH_NAMES})\.?,?\s+(\d{4})${TIME_PART}`, 'gi');
const MONTH_FIRST = new RegExp(String.raw`\b(${MONTH_NAMES})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})${TIME_PART}`, 'gi');
const ISO_IN_TEXT = /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/gi;

function toTime(hourText: string | undefined, minuteText: string | undefined, meridiem: string | undefined): string | null | undefined {
  if (hourText === undefined) return undefined;
  // A bare number after the date is not a time unless it has minutes or am/pm.
  if (minuteText === undefined && meridiem === undefined) return undefined;
  let hour = Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  if (minute > 59) return null;
  if (meridiem !== undefined) {
    if (hour < 1 || hour > 12) return null;
    const pm = meridiem.toLowerCase().startsWith('p');
    hour = (hour % 12) + (pm ? 12 : 0);
  } else if (hour > 23) return null;
  return `${pad(hour)}:${pad(minute)}`;
}

function fromParts(
  text: string,
  year: string,
  monthName: string,
  day: string,
  hour: string | undefined,
  minute: string | undefined,
  meridiem: string | undefined,
  zoneName: string | undefined,
  referenceZone: string,
): DateCandidate | null {
  const month = MONTHS[monthName.toLowerCase()];
  if (month === undefined) return null;
  const date = `${year}-${pad(month)}-${pad(Number(day))}`;
  if (!isRealDate(date)) return null;
  const time = toTime(hour, minute, meridiem);
  if (time === null) return null;
  const named = zoneName === undefined ? undefined : ZONE_ABBREVIATIONS[zoneName.toUpperCase()];
  const candidate: DateCandidate = { text: text.trim(), date, zone: named ?? referenceZone, zoneAssumed: named === undefined };
  if (time !== undefined) candidate.time = time;
  return candidate;
}

/** R1.8: every recognisable date in free text, in order of appearance, without duplicates. */
export function findDateCandidates(text: string, referenceZone: string, limit = 10): DateCandidate[] {
  const zoneRef = normalizeZone(referenceZone) ?? 'UTC';
  const source = text.slice(0, 200_000);
  const found: Array<{ at: number; c: DateCandidate }> = [];
  for (const m of source.matchAll(DAY_FIRST)) {
    const c = fromParts(m[0], m[3] ?? '', m[2] ?? '', m[1] ?? '', m[4], m[5], m[6] ?? m[7], m[8], zoneRef);
    if (c) found.push({ at: m.index, c });
  }
  for (const m of source.matchAll(MONTH_FIRST)) {
    const c = fromParts(m[0], m[3] ?? '', m[1] ?? '', m[2] ?? '', m[4], m[5], m[6] ?? m[7], m[8], zoneRef);
    if (c) found.push({ at: m.index, c });
  }
  for (const m of source.matchAll(ISO_IN_TEXT)) {
    const c = parseIsoLike(m[0], zoneRef);
    if (c) found.push({ at: m.index, c });
  }
  found.sort((a, b) => a.at - b.at);
  const seen = new Set<string>();
  const out: DateCandidate[] = [];
  for (const { c } of found) {
    const key = `${c.date}|${c.time ?? ''}|${c.zone}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}
