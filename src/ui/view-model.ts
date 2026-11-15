// One derived list for both renderings (accessible-list-view design.md). The scene and the list
// view both call deriveStatus on the same items and `now`, so they cannot disagree (R1.1, R2.9).
import { deriveStatus } from '../domain/status.ts';
import { formatForDisplay } from '../domain/time.ts';
import type { EpochMs, Item, Status } from '../domain/types.ts';
import { byDue } from '../scene/layout.ts';

export type EntryAction = 'submit' | 'revive' | 'bury' | 'edit' | 'epitaph';

export interface ViewEntry {
  id: string;
  title: string;
  status: Status;
  /** Status in words, for example "due soon" or "ghost, inactive 9 days". */
  statusText: string;
  /** Due time in the user's zone. */
  dueText: string;
  /** Due time in the deadline's own zone, when it differs from the user's. */
  sourceDueText?: string;
  /** Coarse time left or since, for example "2 days left". Not part of the accessible name (R3.3). */
  relativeText: string;
  epitaph?: string;
  demo: boolean;
  dateOnly: boolean;
  actions: EntryAction[];
  /** R3.1: "<title>, <status in words>, due <time>", plus "Demo" for demo data. */
  accessibleName: string;
}

export interface ViewGroup {
  status: Status;
  heading: string;
  ids: string[];
}

export interface ViewModel {
  /** Every item once, in due order. */
  entries: ViewEntry[];
  /** Non-empty groups only, in the R1.2 order. */
  groups: ViewGroup[];
}

/** R1.2: list view group order. */
export const GROUP_ORDER: readonly Status[] = ['due-soon', 'active', 'ghost', 'missed', 'buried', 'submitted'];

export const GROUP_HEADINGS: Record<Status, string> = {
  'due-soon': 'Due soon: fast-flickering candles',
  active: 'Active: burning candles',
  ghost: 'Ghosts: inactive for 7 days or more',
  missed: 'Missed: tombstones',
  buried: 'Buried: tombstones',
  submitted: 'Submitted: lit lanterns',
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** R1.4: the actions the scene and the list both offer for a status. */
export function allowedActions(status: Status): EntryAction[] {
  switch (status) {
    case 'active':
    case 'due-soon':
      return ['submit', 'edit'];
    case 'ghost':
      return ['revive', 'submit', 'bury', 'edit'];
    case 'missed':
      return ['epitaph', 'bury', 'edit'];
    case 'buried':
      return ['epitaph'];
    case 'submitted':
      return [];
  }
}

export const ACTION_LABELS: Record<EntryAction, string> = {
  submit: 'Mark submitted',
  revive: 'Revive',
  bury: 'Bury',
  edit: 'Edit deadline',
  epitaph: 'Write epitaph',
};

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

/** Coarse duration in words, changing at most once an hour so nothing ticks (R3.3). */
export function coarseDuration(ms: number): string {
  if (ms >= 2 * DAY) return plural(Math.floor(ms / DAY), 'day');
  if (ms >= HOUR) return plural(Math.floor(ms / HOUR), 'hour');
  return 'under an hour';
}

function statusText(item: Item, status: Status, now: EpochMs): string {
  switch (status) {
    case 'due-soon':
      return 'due soon';
    case 'ghost':
      return `ghost, inactive ${plural(Math.floor((now - item.lastActivityAt) / DAY), 'day')}`;
    default:
      return status;
  }
}

function relativeText(item: Item, status: Status, now: EpochMs): string {
  switch (status) {
    case 'active':
    case 'due-soon':
    case 'ghost':
      return `${coarseDuration(item.dueAt - now)} left`;
    case 'missed':
      return `missed ${coarseDuration(now - item.dueAt)} ago`;
    case 'buried':
      return 'laid to rest';
    case 'submitted':
      return item.resolution ? `submitted ${coarseDuration(Math.max(0, item.dueAt - item.resolution.at))} before the deadline` : 'submitted';
  }
}

export function deriveViewModel(items: readonly Item[], now: EpochMs, userZone: string, locale: string): ViewModel {
  const entries = [...items].sort(byDue).map((item): ViewEntry => {
    const status = deriveStatus(item, now);
    let dueText = 'time unavailable';
    let sourceDueText: string | undefined;
    try {
      const shown = formatForDisplay(item.dueAt, userZone, item.zone, locale);
      dueText = shown.primary;
      sourceDueText = shown.source;
    } catch {
      // A bad zone in stored data must not crash the list (design.md error handling).
    }
    if (item.dateOnly) dueText = `${dueText} (end of day)`;
    const words = statusText(item, status, now);
    const entry: ViewEntry = {
      id: item.id,
      title: item.title,
      status,
      statusText: words,
      dueText,
      relativeText: relativeText(item, status, now),
      demo: item.demo,
      dateOnly: item.dateOnly,
      actions: allowedActions(status),
      accessibleName: `${item.title}, ${words}, due ${dueText}${item.demo ? ', Demo' : ''}`,
    };
    if (sourceDueText !== undefined) entry.sourceDueText = `${sourceDueText} in ${item.zone}`;
    if (item.epitaph !== undefined) entry.epitaph = item.epitaph;
    return entry;
  });
  const groups = GROUP_ORDER.map((status) => ({
    status,
    heading: GROUP_HEADINGS[status],
    ids: entries.filter((e) => e.status === status).map((e) => e.id),
  })).filter((g) => g.ids.length > 0);
  return { entries, groups };
}

/** R2.2: roving focus. Left/Right move by one (clamped), Home/End jump. Other keys keep the index. */
export function nextFocusIndex(current: number, key: string, count: number): number {
  if (count <= 0) return -1;
  const last = count - 1;
  const here = Math.max(0, Math.min(last, current));
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return Math.min(last, here + 1);
    case 'ArrowLeft':
    case 'ArrowUp':
      return Math.max(0, here - 1);
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return here;
  }
}

/** R3.2: items whose status changed. New and removed items are not changes. */
export function diffStatuses(
  prev: ReadonlyMap<string, Status>,
  next: ReadonlyMap<string, Status>,
): Array<{ id: string; from: Status; to: Status }> {
  const out: Array<{ id: string; from: Status; to: Status }> = [];
  for (const [id, to] of next) {
    const from = prev.get(id);
    if (from !== undefined && from !== to) out.push({ id, from, to });
  }
  return out;
}

export const CHANGE_MESSAGES: Record<Status, string> = {
  active: 'is burning again',
  'due-soon': 'is now due soon',
  missed: 'was missed and became a tombstone',
  ghost: 'has turned into a ghost',
  buried: 'was buried',
  submitted: 'was submitted and its lantern is lit',
};
