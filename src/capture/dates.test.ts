// Validates: capture-and-export R1.2, R1.8
import { describe, expect, it } from 'vitest';
import { findDateCandidates, parseIsoLike } from './dates.ts';

describe('parseIsoLike (R1.2)', () => {
  it('keeps the exact instant of an offset date-time and shows it in the reference zone', () => {
    expect(parseIsoLike('2026-12-04T14:00:00-08:00', 'Europe/London')).toEqual({
      text: '2026-12-04T14:00:00-08:00',
      date: '2026-12-04',
      time: '22:00',
      zone: 'Europe/London',
      zoneAssumed: false,
    });
  });

  it('uses UTC for Z and +00:00', () => {
    expect(parseIsoLike('2026-09-30T23:59Z', 'Asia/Kolkata')).toMatchObject({ date: '2026-09-30', time: '23:59', zone: 'UTC', zoneAssumed: false });
    expect(parseIsoLike('2026-09-30T23:59:00+0000', 'Asia/Kolkata')).toMatchObject({ zone: 'UTC' });
  });

  it('treats values without an offset as local time in the reference zone', () => {
    expect(parseIsoLike('2026-12-04T14:00', 'America/Los_Angeles')).toMatchObject({ time: '14:00', zone: 'America/Los_Angeles', zoneAssumed: true });
    expect(parseIsoLike('2026-10-31', 'UTC')).toEqual({ text: '2026-10-31', date: '2026-10-31', zone: 'UTC', zoneAssumed: true });
  });

  it('rejects impossible dates and junk', () => {
    expect(parseIsoLike('2026-02-30', 'UTC')).toBeNull();
    expect(parseIsoLike('2026-12-04T25:00', 'UTC')).toBeNull();
    expect(parseIsoLike('soon', 'UTC')).toBeNull();
  });
});

describe('findDateCandidates (R1.8)', () => {
  it('reads the Kiroween-style deadline with a zone abbreviation', () => {
    const [first] = findDateCandidates('Submissions close December 4, 2026 at 2:00 PM PT. Good luck!', 'Asia/Kolkata');
    expect(first).toMatchObject({ date: '2026-12-04', time: '14:00', zone: 'America/Los_Angeles', zoneAssumed: false });
  });

  it('reads day-first dates, 24 h times and assumes the reference zone when none is given', () => {
    expect(findDateCandidates('Deadline: 4th Dec 2026, 23:30', 'Europe/Berlin')).toEqual([
      { text: '4th Dec 2026, 23:30', date: '2026-12-04', time: '23:30', zone: 'Europe/Berlin', zoneAssumed: true },
    ]);
  });

  it('keeps date-only mentions date-only and ignores bare numbers after the year', () => {
    const [c] = findDateCandidates('Applications due 1 Sep 2026 10 places left', 'UTC');
    expect(c).toEqual({ text: '1 Sep 2026', date: '2026-09-01', zone: 'UTC', zoneAssumed: true });
  });

  it('returns several dates in order without duplicates', () => {
    const text = 'Opens 2026-09-01. Closes Sept 30, 2026. Reminder: closes 30 September 2026.';
    expect(findDateCandidates(text, 'UTC').map((c) => c.date)).toEqual(['2026-09-01', '2026-09-30']);
  });

  it('skips impossible dates and times', () => {
    expect(findDateCandidates('31 Feb 2026 and 3 Mar 2026 at 13:00 pm', 'UTC').map((c) => c.date)).toEqual([]);
  });

  it('finds nothing in text without dates', () => {
    expect(findDateCandidates('No deadline mentioned anywhere.', 'UTC')).toEqual([]);
  });
});
