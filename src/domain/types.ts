// Domain types for the deadline engine. Rules: .kiro/steering/deadline-domain.md

/** Integer UTC milliseconds since the Unix epoch. */
export type EpochMs = number;

export type ResolutionKind = 'submitted' | 'buried';

export interface Resolution {
  kind: ResolutionKind;
  at: EpochMs;
}

export interface Item {
  /** Created by the UI layer (crypto.randomUUID()), never by the domain. */
  id: string;
  title: string;
  url?: string;
  dueAt: EpochMs;
  /** IANA zone the deadline was published in. */
  zone: string;
  /** True when the source gave a date without a time (23:59:59 local is assumed). */
  dateOnly: boolean;
  createdAt: EpochMs;
  lastActivityAt: EpochMs;
  resolution: Resolution | null;
  /** Missed or buried items only. */
  epitaph?: string;
  notes?: string;
  /** Seeded demo data, always labelled Demo in the UI. */
  demo: boolean;
}

/** Time-only state, from `now` and `dueAt`. */
export type Phase = 'active' | 'due-soon' | 'missed';

/**
 * Displayed status. `ghost` (abandoned) is a status, not an overlay flag:
 * it sits between `missed` and the phase in the precedence order.
 */
export type Status = 'active' | 'due-soon' | 'missed' | 'ghost' | 'submitted' | 'buried';

export type ActionErrorCode =
  | 'resolved'
  | 'past-due'
  | 'not-ghost'
  | 'not-missed-or-ghost'
  | 'not-missed-or-buried'
  | 'invalid';

export interface ActionError {
  code: ActionErrorCode;
}

export type Result<T, E = ActionError> = { ok: true; value: T } | { ok: false; error: E };
