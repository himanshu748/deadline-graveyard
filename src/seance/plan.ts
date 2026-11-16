// The Séance plan builder (seance R1.1, R1.3, R1.4, R2.1 to R2.4). Pure: `now` is always a
// parameter, nothing reads the clock, the DOM or the network, so fast-check can drive it.
// Design: .kiro/specs/seance/design.md
import { Temporal } from 'temporal-polyfill';
import { EPITAPH_MAX_LENGTH } from '../domain/actions.ts';
import { deriveStatus, GHOST_AFTER_MS } from '../domain/status.ts';
import { formatForDisplay } from '../domain/time.ts';
import type { EpochMs, Item, Status } from '../domain/types.ts';

/** 7 x 24 hours of elapsed time, the same absolute week the ghost rule uses. */
export const WEEK_MS = GHOST_AFTER_MS;
/** Longest note the question flow accepts for one answer. */
export const NOTE_MAX_LENGTH = 1_000;
/** At most this many lessons are taken from the second answer. */
export const MAX_LESSONS = 10;

export type Question = 1 | 2 | 3;

// Type aliases rather than interfaces so a record is assignable to the storage JsonValue type.
export type Answer = { itemIds: string[]; note: string };

export type SeanceAnswers = {
  /** Q1 "Which spirits are restless?" */
  restless: Answer;
  /** Q2 "What did the graves teach you?" */
  lessons: Answer;
  /** Q3 "What will you keep alive next week?" */
  keepAlive: Answer;
};

export type StepAction = 'work' | 'revive' | 'bury' | 'epitaph';

/** keep: picked in Q3. due: the rest due within 7 days. let-go: Q1 ghosts not kept. lessons: epitaph offers. */
export type PlanSection = 'keep' | 'due' | 'let-go' | 'lessons';

export type PlanStep = {
  itemId: string;
  title: string;
  dueAt: EpochMs;
  demo: boolean;
  section: PlanSection;
  action: StepAction;
  reason: string;
  /** Epitaph steps only: the lesson offered for engraving. */
  epitaph?: string;
};

export type Plan = {
  weekStart: EpochMs;
  steps: PlanStep[];
  /** The "Lessons from the graves" section (R2.3). */
  lessons: string[];
  /** The Q3 note, shown at the top of the plan. Empty when the user wrote none. */
  promise: string;
  /** Picked ids that no longer match an item (deleted during the séance). */
  dropped: number;
  /** Rule-based text of the whole plan (R2.4). */
  text: string;
};

export type SeanceRecord = { id: string; at: EpochMs; answers: SeanceAnswers; plan: Plan };

export interface PlanDisplay {
  locale: string;
  /** The user's IANA zone. Times in the text are shown in it. */
  zone: string;
}

export const SECTION_ORDER: readonly PlanSection[] = ['keep', 'due', 'let-go', 'lessons'];

export const SECTION_HEADINGS: Record<PlanSection, string> = {
  keep: 'Keep alive first',
  due: 'Also due this week',
  'let-go': 'Let go',
  lessons: 'Lessons from the graves',
};

export const ACTION_VERBS: Record<StepAction, string> = {
  work: 'Work on',
  revive: 'Revive',
  bury: 'Bury',
  epitaph: 'Engrave',
};

export function emptyAnswers(): SeanceAnswers {
  return { restless: { itemIds: [], note: '' }, lessons: { itemIds: [], note: '' }, keepAlive: { itemIds: [], note: '' } };
}

function byDue(a: Item, b: Item): number {
  return a.dueAt - b.dueAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Still in play: not submitted, buried or missed. Ghosts count, because they can be revived. */
function isOpen(status: Status): boolean {
  return status === 'active' || status === 'due-soon' || status === 'ghost';
}

function hasEpitaph(item: Item): boolean {
  return item.epitaph !== undefined && item.epitaph.trim().length > 0;
}

/**
 * R1.1: the items listed under each question, in due order.
 * 1: open items due in the next 7 days, plus every ghost.
 * 2: items missed in the last 7 days and items buried in the last 7 days.
 * 3: every open item.
 */
export function candidatesFor(question: Question, items: readonly Item[], now: EpochMs): Item[] {
  return [...items].sort(byDue).filter((item) => {
    const status = deriveStatus(item, now);
    switch (question) {
      case 1:
        return status === 'ghost' || (isOpen(status) && item.dueAt - now < WEEK_MS);
      case 2:
        if (status === 'missed') return now - item.dueAt < WEEK_MS;
        return status === 'buried' && item.resolution !== null && now - item.resolution.at < WEEK_MS;
      case 3:
        return isOpen(status);
    }
  });
}

/** R1.4: true when there has never been a séance, or 7 x 24 h have passed since the last one. */
export function isSeanceDue(lastAt: EpochMs | null, now: EpochMs): boolean {
  return lastAt === null || now - lastAt >= WEEK_MS;
}

/** One lesson per non-empty line of the Q2 note. */
export function lessonsFrom(note: string): string[] {
  return note
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_LESSONS);
}

function reasonFor(section: PlanSection, status: Status, restless: boolean): string {
  switch (section) {
    case 'keep':
      return status === 'ghost'
        ? 'You chose to keep this alive. It has had no activity for a week, so revive it first.'
        : `You chose to keep this alive this week.${restless ? ' You also named it restless.' : ''}`;
    case 'due':
      return [
        status === 'due-soon' ? 'Due within 24 hours.' : 'Due within 7 days.',
        status === 'ghost' ? 'It has had no activity for a week.' : '',
        restless ? 'You named it restless.' : '',
      ]
        .filter(Boolean)
        .join(' ');
    case 'let-go':
      return 'You named this ghost restless but did not choose to keep it alive. Bury it to let it rest.';
    case 'lessons':
      return 'This grave has no epitaph yet. Engrave your lesson on it.';
  }
}

/**
 * R1.3, R2.1 to R2.4: next week's plan from the answers and the current items, with
 * rule-based templates only. Steps refer only to items that exist, each item at most once:
 * 1. keep: Q3 picks that are still open, in due order (ghosts get "revive", R2.2).
 * 2. due: every other open item due within 7 days, in due order, except Q1 ghosts not kept.
 * 3. let-go: ghosts picked in Q1 but not in Q3 get "bury" (R2.2).
 * 4. lessons: Q2 picks that are missed or buried with no epitaph get the next lesson to engrave (R2.3).
 * Picked ids with no matching item are dropped and counted.
 */
export function buildPlan(
  items: readonly Item[],
  answers: SeanceAnswers,
  now: EpochMs,
  display: PlanDisplay = { locale: 'en', zone: 'UTC' },
): Plan {
  const known = new Set(items.map((i) => i.id));
  const pickedIds = [...answers.restless.itemIds, ...answers.lessons.itemIds, ...answers.keepAlive.itemIds];
  const dropped = new Set(pickedIds.filter((id) => !known.has(id))).size;
  const q1 = new Set(answers.restless.itemIds);
  const q2 = new Set(answers.lessons.itemIds);
  const q3 = new Set(answers.keepAlive.itemIds);
  const sorted = [...items].sort(byDue);
  const statusOf = new Map(sorted.map((i) => [i.id, deriveStatus(i, now)]));
  const used = new Set<string>();
  const steps: PlanStep[] = [];

  const push = (item: Item, section: PlanSection, action: StepAction, epitaph?: string) => {
    const status = statusOf.get(item.id) ?? 'active';
    const step: PlanStep = {
      itemId: item.id,
      title: item.title,
      dueAt: item.dueAt,
      demo: item.demo,
      section,
      action,
      reason: reasonFor(section, status, q1.has(item.id)),
    };
    if (epitaph !== undefined) step.epitaph = epitaph;
    steps.push(step);
    used.add(item.id);
  };

  for (const item of sorted) {
    const status = statusOf.get(item.id);
    if (status !== undefined && q3.has(item.id) && isOpen(status) && !used.has(item.id)) {
      push(item, 'keep', status === 'ghost' ? 'revive' : 'work');
    }
  }
  for (const item of sorted) {
    const status = statusOf.get(item.id);
    if (status === undefined || used.has(item.id) || !isOpen(status) || item.dueAt - now >= WEEK_MS) continue;
    if (status === 'ghost' && q1.has(item.id)) continue;
    push(item, 'due', 'work');
  }
  for (const item of sorted) {
    if (!used.has(item.id) && statusOf.get(item.id) === 'ghost' && q1.has(item.id)) push(item, 'let-go', 'bury');
  }

  const lessons = lessonsFrom(answers.lessons.note);
  if (lessons.length > 0) {
    let n = 0;
    for (const item of sorted) {
      const status = statusOf.get(item.id);
      if (used.has(item.id) || !q2.has(item.id) || (status !== 'missed' && status !== 'buried') || hasEpitaph(item)) continue;
      const lesson = lessons[Math.min(n, lessons.length - 1)] ?? '';
      push(item, 'lessons', 'epitaph', lesson.slice(0, EPITAPH_MAX_LENGTH).trimEnd());
      n++;
    }
  }

  const plan: Plan = { weekStart: now, steps, lessons, promise: answers.keepAlive.note.trim(), dropped, text: '' };
  plan.text = renderPlanText(plan, display.locale, display.zone);
  return plan;
}

/** A step's title as shown in text, with the Demo label demo data always carries. */
export function stepLabel(step: Pick<PlanStep, 'title' | 'demo'>): string {
  return step.demo ? `${step.title} (Demo)` : step.title;
}

function dueText(ms: EpochMs, locale: string, zone: string): string {
  try {
    return formatForDisplay(ms, zone, zone, locale).primary;
  } catch {
    return new Date(ms).toISOString();
  }
}

function dayText(ms: EpochMs, locale: string, zone: string): string {
  try {
    return Temporal.Instant.fromEpochMilliseconds(ms).toZonedDateTimeISO(zone).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/** R2.4: the whole plan as plain text from fixed templates. Times are shown in `zone`. */
export function renderPlanText(plan: Omit<Plan, 'text'>, locale: string, zone: string): string {
  const lines = [`Next week's plan, ${dayText(plan.weekStart, locale, zone)} to ${dayText(plan.weekStart + WEEK_MS, locale, zone)}.`];
  if (plan.promise) lines.push(`Your promise: ${plan.promise}`);
  let n = 0;
  for (const section of SECTION_ORDER) {
    const steps = plan.steps.filter((s) => s.section === section);
    if (section === 'lessons') {
      if (plan.lessons.length === 0) continue;
      lines.push('', `${SECTION_HEADINGS.lessons}:`);
      for (const lesson of plan.lessons) lines.push(`- ${lesson}`);
      for (const s of steps) lines.push(`- ${ACTION_VERBS.epitaph} "${s.epitaph ?? ''}" on ${stepLabel(s)}.`);
      continue;
    }
    if (steps.length === 0) continue;
    lines.push('', `${SECTION_HEADINGS[section]}:`);
    for (const s of steps) {
      n++;
      lines.push(`${n}. ${ACTION_VERBS[s.action]} ${stepLabel(s)}, due ${dueText(s.dueAt, locale, zone)}. ${s.reason}`);
    }
  }
  if (plan.steps.length === 0 && plan.lessons.length === 0) {
    lines.push('', 'Nothing is due in the next 7 days and no ghost needs you. Rest, or light a new candle.');
  }
  if (plan.dropped > 0) {
    lines.push(
      '',
      plan.dropped === 1
        ? '1 picked deadline no longer exists, so it was left out.'
        : `${plan.dropped} picked deadlines no longer exist, so they were left out.`,
    );
  }
  return lines.join('\n');
}
