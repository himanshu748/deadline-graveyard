import { describe, expect, it } from 'vitest';
import { formatForDisplay, isValidZone, normalizeZone, toInstant, toLocal } from './time.ts';

const utc = (iso: string) => Date.parse(iso);

describe('toInstant', () => {
  // Validates: deadline-engine R3.2, R3.3
  it('shifts a New York spring-forward gap time forward by the gap and flags it', () => {
    const result = toInstant({ date: '2026-03-08', time: '02:30', zone: 'America/New_York' });
    expect(result).toEqual({ ok: true, epochMs: utc('2026-03-08T07:30:00Z'), dateOnly: false, adjustment: 'gap-shifted' });
    expect(result.ok && toLocal(result.epochMs, 'America/New_York')).toEqual({ date: '2026-03-08', time: '03:30:00' });
  });

  // Validates: deadline-engine R3.2, R3.3
  it('takes the earlier offset for a New York fall-back time and flags it', () => {
    const result = toInstant({ date: '2026-11-01', time: '01:30', zone: 'America/New_York' });
    expect(result).toEqual({ ok: true, epochMs: utc('2026-11-01T05:30:00Z'), dateOnly: false, adjustment: 'ambiguous-earlier' });
  });

  // Validates: deadline-engine R3.2, R3.3
  it('handles the 30-minute Lord Howe DST shift in both directions', () => {
    expect(toInstant({ date: '2026-10-04', time: '02:15', zone: 'Australia/Lord_Howe' })).toEqual({
      ok: true,
      epochMs: utc('2026-10-03T15:45:00Z'),
      dateOnly: false,
      adjustment: 'gap-shifted',
    });
    expect(toInstant({ date: '2026-04-05', time: '01:45', zone: 'Australia/Lord_Howe' })).toEqual({
      ok: true,
      epochMs: utc('2026-04-04T14:45:00Z'),
      dateOnly: false,
      adjustment: 'ambiguous-earlier',
    });
  });

  it('handles the +05:45 Kathmandu offset with no adjustment', () => {
    expect(toInstant({ date: '2026-01-15', time: '12:00:00', zone: 'Asia/Kathmandu' })).toEqual({
      ok: true,
      epochMs: utc('2026-01-15T06:15:00Z'),
      dateOnly: false,
      adjustment: 'none',
    });
  });

  // Validates: deadline-engine R3.4
  it('treats a date without a time as 23:59:59 in the deadline zone and marks it dateOnly', () => {
    expect(toInstant({ date: '2026-12-04', zone: 'America/Los_Angeles' })).toEqual({
      ok: true,
      epochMs: utc('2026-12-05T07:59:59Z'),
      dateOnly: true,
      adjustment: 'none',
    });
  });

  // Validates: deadline-engine R3.7
  it('returns typed errors for an invalid zone, date or time', () => {
    expect(toInstant({ date: '2026-12-04', zone: 'Mars/Olympus' })).toEqual({ ok: false, error: 'invalid-zone' });
    expect(toInstant({ date: '2026-12-04', zone: '' })).toEqual({ ok: false, error: 'invalid-zone' });
    expect(toInstant({ date: '2026-02-30', zone: 'UTC' })).toEqual({ ok: false, error: 'invalid-date' });
    expect(toInstant({ date: '4 Dec 2026', zone: 'UTC' })).toEqual({ ok: false, error: 'invalid-date' });
    expect(toInstant({ date: '2026-12-04', time: '25:00', zone: 'UTC' })).toEqual({ ok: false, error: 'invalid-time' });
    expect(toInstant({ date: '2026-12-04', time: '2pm', zone: 'UTC' })).toEqual({ ok: false, error: 'invalid-time' });
  });
});

describe('zones', () => {
  it('canonicalises case and rejects unknown zones', () => {
    expect(normalizeZone('asia/kolkata')).toBe('Asia/Kolkata');
    expect(isValidZone('Europe/London')).toBe(true);
    expect(isValidZone('Not/AZone')).toBe(false);
  });
});

describe('formatForDisplay', () => {
  const due = utc('2026-12-04T22:00:00Z');

  // Validates: deadline-engine R3.6
  it('shows the user zone and adds the source zone when it differs', () => {
    const shown = formatForDisplay(due, 'Asia/Kolkata', 'America/Los_Angeles', 'en-GB');
    expect(shown.primary).toContain('5 Dec 2026');
    expect(shown.primary).toContain('03:30');
    expect(shown.source).toContain('4 Dec 2026');
    expect(shown.source).toContain('14:00');
  });

  it('omits the source zone when the zones match', () => {
    const shown = formatForDisplay(due, 'America/Los_Angeles', 'America/Los_Angeles', 'en-US');
    expect(shown.source).toBeUndefined();
    expect(shown.primary).toContain('02:00');
    expect(shown.primary).toContain('PM');
  });
});
