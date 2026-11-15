import { describe, expect, it } from 'vitest';
import { DUE_SOON_MS, GHOST_AFTER_MS, deriveStatus, phaseAt, phaseRank } from './status.ts';
import { DAY, DUE, makeItem } from './test-items.ts';

describe('constants', () => {
  // Validates: deadline-engine R1.4, R2.4
  it('are absolute elapsed milliseconds', () => {
    expect(DUE_SOON_MS).toBe(86_400_000);
    expect(GHOST_AFTER_MS).toBe(604_800_000);
  });
});

describe('phaseAt boundaries', () => {
  // Validates: deadline-engine R1.1
  it('is active 1 ms before the due-soon window', () => {
    expect(phaseAt(DUE, DUE - DUE_SOON_MS - 1)).toBe('active');
    expect(phaseAt(DUE, DUE - 30 * DAY)).toBe('active');
  });

  // Validates: deadline-engine R1.2
  it('is due-soon at exactly due - 24h and 1 ms before due', () => {
    expect(phaseAt(DUE, DUE - DUE_SOON_MS)).toBe('due-soon');
    expect(phaseAt(DUE, DUE - 1)).toBe('due-soon');
  });

  // Validates: deadline-engine R1.3
  it('is missed at exactly due and after', () => {
    expect(phaseAt(DUE, DUE)).toBe('missed');
    expect(phaseAt(DUE, DUE + 365 * DAY)).toBe('missed');
  });

  it('ranks active < due-soon < missed', () => {
    expect(phaseRank('active')).toBeLessThan(phaseRank('due-soon'));
    expect(phaseRank('due-soon')).toBeLessThan(phaseRank('missed'));
  });
});

describe('deriveStatus precedence', () => {
  // Validates: deadline-engine R2.1
  it('reports submitted for any later now, even after due', () => {
    const item = makeItem({ resolution: { kind: 'submitted', at: DUE - DAY } });
    expect(deriveStatus(item, DUE - DAY)).toBe('submitted');
    expect(deriveStatus(item, DUE + 100 * DAY)).toBe('submitted');
  });

  // Validates: deadline-engine R2.2
  it('reports buried for any later now', () => {
    const item = makeItem({ resolution: { kind: 'buried', at: DUE + DAY } });
    expect(deriveStatus(item, DUE + DAY)).toBe('buried');
    expect(deriveStatus(item, DUE + 100 * DAY)).toBe('buried');
  });

  // Validates: deadline-engine R2.3
  it('reports missed over ghost when the item is past due and idle', () => {
    const item = makeItem({ lastActivityAt: DUE - 30 * DAY });
    expect(deriveStatus(item, DUE)).toBe('missed');
  });

  // Validates: deadline-engine R2.4
  it('turns into a ghost at exactly 7 x 24h without activity, not 1 ms earlier', () => {
    const now = DUE - 3 * DAY;
    expect(deriveStatus(makeItem({ lastActivityAt: now - GHOST_AFTER_MS }), now)).toBe('ghost');
    expect(deriveStatus(makeItem({ lastActivityAt: now - GHOST_AFTER_MS + 1 }), now)).toBe('active');
  });

  it('can be a ghost inside the due-soon window', () => {
    const now = DUE - 1;
    expect(deriveStatus(makeItem({ lastActivityAt: now - GHOST_AFTER_MS }), now)).toBe('ghost');
  });

  // Validates: deadline-engine R2.5, R1.5
  it('reports the phase otherwise and ignores the zone field', () => {
    const now = DUE - DAY;
    expect(deriveStatus(makeItem({ lastActivityAt: now }), now)).toBe('due-soon');
    expect(deriveStatus(makeItem({ lastActivityAt: now, zone: 'Asia/Kathmandu' }), now)).toBe('due-soon');
    expect(deriveStatus(makeItem({ lastActivityAt: now }), now - 1)).toBe('active');
  });
});
