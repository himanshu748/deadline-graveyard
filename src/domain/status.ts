import type { EpochMs, Item, Phase, Status } from './types.ts';

/** 24 hours of elapsed time. Never calendar days, so DST cannot stretch it. */
export const DUE_SOON_MS = 24 * 60 * 60 * 1000;
/** 7 x 24 hours of elapsed time without activity turns an item into a ghost. */
export const GHOST_AFTER_MS = 7 * DUE_SOON_MS;

const PHASE_RANK: Record<Phase, number> = { active: 0, 'due-soon': 1, missed: 2 };

/** Order used by the monotonicity property: active < due-soon < missed. */
export function phaseRank(phase: Phase): number {
  return PHASE_RANK[phase];
}

/** R1.1 to R1.4: phase from instants only, using absolute elapsed milliseconds. */
export function phaseAt(dueAt: EpochMs, now: EpochMs): Phase {
  if (now >= dueAt) return 'missed';
  if (now >= dueAt - DUE_SOON_MS) return 'due-soon';
  return 'active';
}

/** R2.1 to R2.5: displayed status in precedence order. Ignores every zone field. */
export function deriveStatus(item: Item, now: EpochMs): Status {
  if (item.resolution?.kind === 'submitted') return 'submitted';
  if (item.resolution?.kind === 'buried') return 'buried';
  const phase = phaseAt(item.dueAt, now);
  if (phase === 'missed') return 'missed';
  if (now - item.lastActivityAt >= GHOST_AFTER_MS) return 'ghost';
  return phase;
}
