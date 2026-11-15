import { describe, expect, it } from 'vitest';
import { EPITAPH_MAX_LENGTH, bury, editDue, revive, setEpitaph, submit, touch } from './actions.ts';
import { GHOST_AFTER_MS, deriveStatus } from './status.ts';
import { DAY, DUE, HOUR, makeItem } from './test-items.ts';
import type { Item } from './types.ts';

function frozen(overrides: Partial<Item> = {}): Item {
  return Object.freeze(makeItem(overrides));
}

const ghostNow = DUE - 2 * DAY;
const ghost = () => frozen({ lastActivityAt: ghostNow - GHOST_AFTER_MS });

describe('submit', () => {
  // Validates: deadline-engine R2.7
  it('sets resolution submitted at now before due, without mutating the input', () => {
    const item = frozen();
    const result = submit(item, DUE - 1);
    expect(result).toEqual({
      ok: true,
      value: { ...item, resolution: { kind: 'submitted', at: DUE - 1 }, lastActivityAt: DUE - 1 },
    });
    expect(item.resolution).toBeNull();
  });

  // Validates: deadline-engine R2.6
  it('rejects at or after due with past-due', () => {
    expect(submit(frozen(), DUE)).toEqual({ ok: false, error: { code: 'past-due' } });
  });

  // Validates: deadline-engine R2.6, R2.10
  it('rejects a resolved item with resolved', () => {
    const item = frozen({ resolution: { kind: 'buried', at: DUE + DAY } });
    expect(submit(item, DUE - DAY)).toEqual({ ok: false, error: { code: 'resolved' } });
  });
});

describe('bury', () => {
  // Validates: deadline-engine R2.8
  it('buries a missed item and a ghost', () => {
    const missed = bury(frozen(), DUE + HOUR);
    expect(missed.ok && missed.value.resolution).toEqual({ kind: 'buried', at: DUE + HOUR });
    const buriedGhost = bury(ghost(), ghostNow);
    expect(buriedGhost.ok && deriveStatus(buriedGhost.value, ghostNow)).toBe('buried');
  });

  it('rejects an active or due-soon candle', () => {
    const item = frozen({ lastActivityAt: DUE - HOUR });
    expect(bury(item, DUE - HOUR)).toEqual({ ok: false, error: { code: 'not-missed-or-ghost' } });
  });

  // Validates: deadline-engine R2.10
  it('rejects a resolved item', () => {
    const item = frozen({ resolution: { kind: 'submitted', at: DUE - DAY } });
    expect(bury(item, DUE + DAY)).toEqual({ ok: false, error: { code: 'resolved' } });
  });
});

describe('revive', () => {
  // Validates: deadline-engine R2.9
  it('sets lastActivityAt to now and returns the ghost to a candle', () => {
    const result = revive(ghost(), ghostNow);
    expect(result.ok && result.value.lastActivityAt).toBe(ghostNow);
    expect(result.ok && deriveStatus(result.value, ghostNow)).toBe('active');
  });

  it('rejects an item that is not a ghost', () => {
    expect(revive(frozen(), DUE - DAY)).toEqual({ ok: false, error: { code: 'not-ghost' } });
    expect(revive(frozen(), DUE)).toEqual({ ok: false, error: { code: 'not-ghost' } });
  });

  // Validates: deadline-engine R2.10
  it('rejects a resolved item', () => {
    const item = frozen({ lastActivityAt: 0, resolution: { kind: 'buried', at: DUE } });
    expect(revive(item, DUE + DAY)).toEqual({ ok: false, error: { code: 'resolved' } });
  });
});

describe('touch', () => {
  // Validates: deadline-engine R2.12
  it('records activity on an unresolved item and rejects a resolved one', () => {
    const result = touch(frozen(), DUE - HOUR);
    expect(result.ok && result.value.lastActivityAt).toBe(DUE - HOUR);
    const resolved = frozen({ resolution: { kind: 'submitted', at: DUE - DAY } });
    expect(touch(resolved, DUE)).toEqual({ ok: false, error: { code: 'resolved' } });
  });
});

describe('editDue', () => {
  // Validates: deadline-engine R2.13
  it('stores the new instant, canonical zone and dateOnly flag and counts as activity', () => {
    const result = editDue(frozen(), DUE + DAY, 'europe/london', true, DUE - HOUR);
    expect(result.ok && result.value).toMatchObject({
      dueAt: DUE + DAY,
      zone: 'Europe/London',
      dateOnly: true,
      lastActivityAt: DUE - HOUR,
    });
  });

  it('can move a missed item back to a candle', () => {
    const result = editDue(frozen(), DUE + 5 * DAY, 'UTC', false, DUE + DAY);
    expect(result.ok && deriveStatus(result.value, DUE + DAY)).toBe('active');
  });

  it('rejects an invalid zone or a non-integer instant', () => {
    expect(editDue(frozen(), DUE, 'Mars/Olympus', false, DUE)).toEqual({ ok: false, error: { code: 'invalid' } });
    expect(editDue(frozen(), 1.5, 'UTC', false, DUE)).toEqual({ ok: false, error: { code: 'invalid' } });
  });

  // Validates: deadline-engine R2.10
  it('rejects a resolved item', () => {
    const item = frozen({ resolution: { kind: 'submitted', at: DUE - DAY } });
    expect(editDue(item, DUE + DAY, 'UTC', false, DUE)).toEqual({ ok: false, error: { code: 'resolved' } });
  });
});

describe('setEpitaph', () => {
  // Validates: deadline-engine R2.11
  it('stores a trimmed epitaph on a missed item without changing status or activity', () => {
    const item = frozen();
    const result = setEpitaph(item, '  Start the demo video earlier.  ', DUE + DAY);
    expect(result.ok && result.value.epitaph).toBe('Start the demo video earlier.');
    expect(result.ok && result.value.lastActivityAt).toBe(item.lastActivityAt);
    expect(result.ok && deriveStatus(result.value, DUE + DAY)).toBe('missed');
  });

  it('edits and clears the epitaph on a buried item', () => {
    const item = frozen({ resolution: { kind: 'buried', at: DUE + DAY }, epitaph: 'old' });
    const edited = setEpitaph(item, 'new', DUE + 2 * DAY);
    expect(edited.ok && edited.value.epitaph).toBe('new');
    const cleared = setEpitaph(item, '   ', DUE + 2 * DAY);
    expect(cleared.ok && 'epitaph' in cleared.value).toBe(false);
    expect(cleared.ok && deriveStatus(cleared.value, DUE + 2 * DAY)).toBe('buried');
  });

  it('rejects candles, ghosts and lanterns, and text over the limit', () => {
    expect(setEpitaph(frozen(), 'x', DUE - DAY)).toEqual({ ok: false, error: { code: 'not-missed-or-buried' } });
    expect(setEpitaph(ghost(), 'x', ghostNow)).toEqual({ ok: false, error: { code: 'not-missed-or-buried' } });
    const lantern = frozen({ resolution: { kind: 'submitted', at: DUE - DAY } });
    expect(setEpitaph(lantern, 'x', DUE + DAY)).toEqual({ ok: false, error: { code: 'not-missed-or-buried' } });
    expect(setEpitaph(frozen(), 'x'.repeat(EPITAPH_MAX_LENGTH + 1), DUE + DAY)).toEqual({
      ok: false,
      error: { code: 'invalid' },
    });
  });
});
