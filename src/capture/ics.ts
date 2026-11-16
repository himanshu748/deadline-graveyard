// iCalendar export (capture-and-export R2.1 to R2.4) and a parser for our own output (P6).
// RFC 5545: https://www.rfc-editor.org/rfc/rfc5545
// - Timed deadlines use the UTC form `DTSTART:YYYYMMDDTHHMMSSZ` (3.3.5 form #2). A `TZID`
//   parameter would require a VTIMEZONE component for each zone (3.2.19, 3.6.5), which we do not
//   generate, so the zone travels in the extension property `X-DG-TZID` instead.
// - Date-only deadlines use `DTSTART;VALUE=DATE:YYYYMMDD` (an all-day event in the calendar app)
//   plus `X-DG-DATE-ONLY:TRUE`.
// - TEXT values escape backslash, semicolon, comma and newline (3.3.11). Lines are folded at 75
//   octets with CRLF and one space, never inside a UTF-8 sequence (3.1).
// Instants have second precision in iCalendar; the app only creates whole-second deadlines.
import { Temporal } from 'temporal-polyfill';
import { normalizeZone, toInstant, toLocal } from '../domain/time.ts';
import type { EpochMs, Item } from '../domain/types.ts';

export const ICS_PRODID = '-//Deadline Graveyard//Deadline Graveyard 0.1//EN';
export const UID_SUFFIX = '@deadline-graveyard';
export const DEMO_PREFIX = '[Demo] ';
const MAX_OCTETS = 75;

export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

export function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

const encoder = new TextEncoder();

/** R2.4: folds one content line into chunks of at most 75 octets. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= MAX_OCTETS) return line;
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  let limit = MAX_OCTETS;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
      limit = MAX_OCTETS - 1; // continuation lines start with one space
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

function utcStamp(ms: EpochMs): string {
  const iso = Temporal.Instant.fromEpochMilliseconds(Math.floor(ms / 1000) * 1000).toString(); // 2026-12-04T22:00:00Z
  return iso.replace(/[-:]/g, '').replace(/\.\d+/, '');
}

function eventLines(item: Item, now: EpochMs): string[] {
  const summary = (item.demo ? DEMO_PREFIX : '') + item.title;
  const lines = ['BEGIN:VEVENT', `UID:${escapeText(item.id)}${UID_SUFFIX}`, `DTSTAMP:${utcStamp(now)}`];
  if (item.dateOnly) {
    lines.push(`DTSTART;VALUE=DATE:${toLocal(item.dueAt, item.zone).date.replace(/-/g, '')}`, 'X-DG-DATE-ONLY:TRUE');
  } else {
    lines.push(`DTSTART:${utcStamp(item.dueAt)}`);
  }
  lines.push(`SUMMARY:${escapeText(summary)}`, `X-DG-TZID:${escapeText(item.zone)}`);
  if (item.demo) lines.push('X-DG-DEMO:TRUE', 'DESCRIPTION:Demo data seeded by Deadline Graveyard.');
  if (item.url) {
    try {
      // href drops tabs and newlines (WHATWG URL), so a stored link cannot inject content lines.
      const href = new URL(item.url).href;
      if (/^https?:/.test(href)) lines.push(`URL:${href}`);
    } catch {
      // Not a valid URL: leave it out of the calendar file.
    }
  }
  lines.push('END:VEVENT');
  return lines;
}

/** R2.1, R2.2: one VEVENT per item given (the caller picks which items to export). */
export function toIcs(items: Item[], now: EpochMs): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${ICS_PRODID}`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const item of items) lines.push(...eventLines(item, now));
  lines.push('END:VCALENDAR');
  return `${lines.map(foldLine).join('\r\n')}\r\n`;
}

export interface ParsedEvent {
  id: string;
  title: string;
  dueAt: EpochMs;
  zone: string;
  dateOnly: boolean;
  demo: boolean;
}

interface ContentLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): ContentLine | null {
  // Our output never quotes parameter values, so the first ':' ends the name and parameters.
  const colon = line.indexOf(':');
  if (colon < 0) return null;
  const [name = '', ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  return { name: name.toUpperCase(), params, value: line.slice(colon + 1) };
}

function parseUtc(value: string): EpochMs | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!m) return null;
  try {
    return Temporal.Instant.from(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).epochMilliseconds;
  } catch {
    return null;
  }
}

/** R2.3: reads the subset of iCalendar that toIcs writes. Events it cannot read are skipped. */
export function parseIcs(text: string): ParsedEvent[] {
  const unfolded = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const events: ParsedEvent[] = [];
  let current: Map<string, ContentLine> | null = null;
  for (const raw of unfolded.split(/\r\n|\n/)) {
    const line = parseLine(raw);
    if (!line) continue;
    if (line.name === 'BEGIN' && line.value === 'VEVENT') current = new Map();
    else if (line.name === 'END' && line.value === 'VEVENT' && current) {
      const event = toEvent(current);
      if (event) events.push(event);
      current = null;
    } else if (current && !current.has(line.name)) current.set(line.name, line);
  }
  return events;
}

function toEvent(props: Map<string, ContentLine>): ParsedEvent | null {
  const uid = props.get('UID');
  const start = props.get('DTSTART');
  const summary = props.get('SUMMARY');
  if (!uid || !start || !summary) return null;
  const zone = normalizeZone(unescapeText(props.get('X-DG-TZID')?.value ?? 'UTC'));
  if (zone === null) return null;
  const demo = props.get('X-DG-DEMO')?.value.toUpperCase() === 'TRUE';
  let title = unescapeText(summary.value);
  if (demo && title.startsWith(DEMO_PREFIX)) title = title.slice(DEMO_PREFIX.length);
  const id = unescapeText(uid.value).replace(new RegExp(`${UID_SUFFIX}$`), '');
  const dateOnly = start.params.VALUE === 'DATE' || props.get('X-DG-DATE-ONLY')?.value.toUpperCase() === 'TRUE';
  let dueAt: EpochMs | null;
  if (dateOnly) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(start.value);
    const converted = m ? toInstant({ date: `${m[1]}-${m[2]}-${m[3]}`, zone }) : null;
    dueAt = converted?.ok ? converted.epochMs : null;
  } else {
    dueAt = parseUtc(start.value);
  }
  if (dueAt === null) return null;
  return { id, title, dueAt, zone, dateOnly, demo };
}
