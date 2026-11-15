// Pure visual quantities the scene and the list view read from the domain, so both
// render from the same numbers (graveyard-scene R2.1 to R2.3, R2.6).
import { DUE_SOON_MS, GHOST_AFTER_MS, deriveStatus } from './status.ts';
import type { EpochMs, Item } from './types.ts';

/** Shortest wax a candle shows, so a nearly spent candle stays visible. */
export const MIN_WAX = 0.05;
/** A ghost is closest to the viewer after 30 days without activity. */
export const GHOST_FULL_MS = 30 * DUE_SOON_MS;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * graveyard-scene R2.1: remaining candle wax, `(dueAt - now) / (dueAt - createdAt)` clamped to [0.05, 1].
 * Returns 0 when the item is not a candle (not active or due-soon).
 */
export function waxFraction(item: Item, now: EpochMs): number {
  const status = deriveStatus(item, now);
  if (status !== 'active' && status !== 'due-soon') return 0;
  const span = item.dueAt - item.createdAt;
  if (span <= 0) return 1;
  return clamp((item.dueAt - now) / span, MIN_WAX, 1);
}

/**
 * graveyard-scene R2.2, R2.3: flame flicker. `slow` for active candles, `fast` for due-soon candles,
 * null when there is no flame. `urgency` rises from 0 to 1 across the last 24 h.
 */
export function flicker(item: Item, now: EpochMs): { speed: 'slow' | 'fast'; urgency: number } | null {
  const status = deriveStatus(item, now);
  if (status === 'active') return { speed: 'slow', urgency: 0 };
  if (status === 'due-soon') {
    return { speed: 'fast', urgency: clamp(1 - (item.dueAt - now) / DUE_SOON_MS, 0, 1) };
  }
  return null;
}

/**
 * graveyard-scene R2.6: how far a ghost has drifted toward the viewer, 0 at 7 days without activity,
 * 1 at 30 days or more. Returns 0 when the item is not a ghost.
 */
export function ghostDistance(item: Item, now: EpochMs): number {
  if (deriveStatus(item, now) !== 'ghost') return 0;
  const idle = now - item.lastActivityAt;
  return clamp((idle - GHOST_AFTER_MS) / (GHOST_FULL_MS - GHOST_AFTER_MS), 0, 1);
}
