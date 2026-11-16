// Validates: capture-and-export R2.1, R2.2, R2.4
import { describe, expect, it } from 'vitest';
import { toInstant } from '../domain/time.ts';
import { DUE, makeItem } from '../domain/test-items.ts';
import { escapeText, foldLine, parseIcs, toIcs, unescapeText } from './ics.ts';

const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);
const octets = (s: string) => new TextEncoder().encode(s).length;

describe('toIcs (R2.1)', () => {
  it('writes a calendar with one VEVENT per item, UID, DTSTAMP, SUMMARY and a UTC DTSTART', () => {
    const ics = toIcs([makeItem({ title: 'Kiroween submission' })], NOW);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:00000000-0000-4000-8000-000000000001@deadline-graveyard\r\n');
    expect(ics).toContain('DTSTAMP:20261115T120000Z\r\n');
    expect(ics).toContain('DTSTART:20261204T220000Z\r\n');
    expect(ics).toContain('SUMMARY:Kiroween submission\r\n');
    expect(ics).toContain('X-DG-TZID:America/Los_Angeles\r\n');
    expect(ics).not.toContain('TZID=');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it('writes date-only deadlines as all-day DATE values in their own zone', () => {
    const due = toInstant({ date: '2026-09-30', zone: 'Asia/Kolkata' });
    if (!due.ok) throw new Error('fixture');
    const ics = toIcs([makeItem({ dueAt: due.epochMs, zone: 'Asia/Kolkata', dateOnly: true })], NOW);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260930\r\n');
    expect(ics).toContain('X-DG-DATE-ONLY:TRUE\r\n');
  });

  it('prefixes demo items with [Demo] (R2.2)', () => {
    const ics = toIcs([makeItem({ title: 'Haunted hackathon', demo: true })], NOW);
    expect(ics).toContain('SUMMARY:[Demo] Haunted hackathon\r\n');
    expect(ics).toContain('X-DG-DEMO:TRUE\r\n');
  });

  it('writes the link as a URL property and never lets it inject lines', () => {
    const ics = toIcs([makeItem({ url: 'https://example.com/a\nBEGIN:VEVENT' })], NOW);
    expect(ics.split('\r\n').filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(ics).toContain('URL:https://example.com/aBEGIN:VEVENT');
  });

  it('writes an empty calendar for no items', () => {
    expect(parseIcs(toIcs([], NOW))).toEqual([]);
  });
});

describe('escaping and folding (R2.4)', () => {
  it('escapes backslash, semicolon, comma and newlines and reverses it', () => {
    const raw = 'a\\b;c,d\ne\r\nf';
    expect(escapeText(raw)).toBe('a\\\\b\\;c\\,d\\ne\\nf');
    expect(unescapeText(escapeText(raw))).toBe('a\\b;c,d\ne\nf');
  });

  it('folds long lines at 75 octets without splitting a UTF-8 character', () => {
    const line = `SUMMARY:${'\u{1F383}'.repeat(40)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(octets(p)).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });

  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:short')).toBe('SUMMARY:short');
  });

  it('every line of a real export is at most 75 octets', () => {
    const ics = toIcs([makeItem({ title: `Very ${'long, '.repeat(40)}title; with\nnewlines` })], NOW);
    for (const line of ics.split('\r\n')) expect(octets(line)).toBeLessThanOrEqual(75);
  });
});

describe('parseIcs', () => {
  it('reads back what toIcs wrote', () => {
    const item = makeItem({ title: 'Grant, final; draft', demo: true });
    expect(parseIcs(toIcs([item], NOW))).toEqual([
      { id: item.id, title: 'Grant, final; draft', dueAt: DUE, zone: 'America/Los_Angeles', dateOnly: false, demo: true },
    ]);
  });

  it('skips events with a missing or broken DTSTART or zone', () => {
    const broken = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nSUMMARY:y\r\nDTSTART:nope\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:z\r\nSUMMARY:w\r\nDTSTART:20261204T220000Z\r\nX-DG-TZID:Mars/Olympus\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
    expect(parseIcs(broken)).toEqual([]);
  });
});
