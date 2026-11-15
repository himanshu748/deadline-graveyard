import { describe, expect, it } from 'vitest';
import { GHOST_AFTER_MS } from './status.ts';
import { DAY, DUE, HOUR, makeItem } from './test-items.ts';
import { GHOST_FULL_MS, MIN_WAX, flicker, ghostDistance, waxFraction } from './visual.ts';

describe('waxFraction', () => {
  // Validates: graveyard-scene R2.1
  it('is the remaining fraction of the candle, clamped to [0.05, 1]', () => {
    const item = makeItem({ createdAt: DUE - 10 * DAY, lastActivityAt: DUE - HOUR });
    expect(waxFraction(item, DUE - 5 * DAY)).toBeCloseTo(0.5);
    expect(waxFraction(item, DUE - 10 * DAY)).toBe(1);
    expect(waxFraction(item, DUE - 1)).toBe(MIN_WAX);
  });

  it('is 0 for anything that is not a candle', () => {
    expect(waxFraction(makeItem(), DUE)).toBe(0);
    expect(waxFraction(makeItem({ resolution: { kind: 'submitted', at: DUE - DAY } }), DUE - DAY)).toBe(0);
  });
});

describe('flicker', () => {
  // Validates: graveyard-scene R2.2, R2.3
  it('is slow for active candles and fast with rising urgency in the last 24h', () => {
    const item = makeItem({ lastActivityAt: DUE - HOUR });
    expect(flicker(item, DUE - 2 * DAY)).toEqual({ speed: 'slow', urgency: 0 });
    expect(flicker(item, DUE - DAY)).toEqual({ speed: 'fast', urgency: 0 });
    expect(flicker(item, DUE - 12 * HOUR)).toEqual({ speed: 'fast', urgency: 0.5 });
    expect(flicker(item, DUE)).toBeNull();
  });
});

describe('ghostDistance', () => {
  // Validates: graveyard-scene R2.6
  it('grows from 0 at 7 days idle to 1 at 30 days and stays there', () => {
    const now = DUE - 40 * DAY;
    const idle = (ms: number) => makeItem({ lastActivityAt: now - ms });
    expect(ghostDistance(idle(GHOST_AFTER_MS), now)).toBe(0);
    expect(ghostDistance(idle((GHOST_AFTER_MS + GHOST_FULL_MS) / 2), now)).toBeCloseTo(0.5);
    expect(ghostDistance(idle(GHOST_FULL_MS), now)).toBe(1);
    expect(ghostDistance(idle(60 * DAY), now)).toBe(1);
    expect(ghostDistance(idle(DAY), now)).toBe(0);
  });
});
