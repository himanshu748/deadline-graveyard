// Past séances (seance R3.1, R3.2). The whole history is one value in the repository's settings
// store under SETTING_SEANCE_HISTORY, so JSON backups carry it with no extra code. A restored
// backup is untrusted, so each record is checked and a bad one is dropped, not the whole list.
import { EPITAPH_MAX_LENGTH } from '../domain/actions.ts';
import type { EpochMs } from '../domain/types.ts';
import { MAX_LESSONS, NOTE_MAX_LENGTH, type Answer, type Plan, type PlanSection, type PlanStep, type SeanceAnswers, type SeanceRecord, type StepAction } from './plan.ts';

export const SETTING_SEANCE_HISTORY = 'seance-history';
/** About a year of weekly séances. Older ones are dropped when a new one is saved. */
export const HISTORY_MAX = 52;

const LIMITS = { id: 100, title: 300, reason: 500, text: 50_000, ids: 10_000, steps: 10_000 } as const;
const SECTIONS = new Set<PlanSection>(['keep', 'due', 'let-go', 'lessons']);
const ACTIONS = new Set<StepAction>(['work', 'revive', 'bury', 'epitaph']);

/** Newest first; ties broken by id so the order is stable. */
function newestFirst(a: SeanceRecord, b: SeanceRecord): number {
  return b.at - a.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** R3.2: the history with `record` added (replacing one with the same id), newest first, capped. */
export function addRecord(history: readonly SeanceRecord[], record: SeanceRecord, max: number = HISTORY_MAX): SeanceRecord[] {
  return [record, ...history.filter((r) => r.id !== record.id)].sort(newestFirst).slice(0, max);
}

/** The instant of the most recent séance, or null when there has been none. */
export function lastSeanceAt(history: readonly SeanceRecord[]): EpochMs | null {
  return history.reduce<EpochMs | null>((last, r) => (last === null || r.at > last ? r.at : last), null);
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInstant = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isTextList = (v: unknown, maxItems: number, maxLength: number): v is string[] =>
  Array.isArray(v) && v.length <= maxItems && v.every((s) => isText(s, maxLength));

function answer(v: unknown): Answer | null {
  if (!isObj(v) || !isTextList(v.itemIds, LIMITS.ids, LIMITS.id) || !isText(v.note, NOTE_MAX_LENGTH)) return null;
  return { itemIds: [...v.itemIds], note: v.note };
}

function answers(v: unknown): SeanceAnswers | null {
  if (!isObj(v)) return null;
  const restless = answer(v.restless);
  const lessons = answer(v.lessons);
  const keepAlive = answer(v.keepAlive);
  return restless && lessons && keepAlive ? { restless, lessons, keepAlive } : null;
}

function step(v: unknown): PlanStep | null {
  if (!isObj(v)) return null;
  const { itemId, title, dueAt, demo, section, action, reason, epitaph } = v;
  if (!isText(itemId, LIMITS.id) || !isText(title, LIMITS.title) || !isInstant(dueAt) || typeof demo !== 'boolean') return null;
  if (!SECTIONS.has(section as PlanSection) || !ACTIONS.has(action as StepAction) || !isText(reason, LIMITS.reason)) return null;
  const out: PlanStep = { itemId, title, dueAt, demo, section: section as PlanSection, action: action as StepAction, reason };
  if (epitaph !== undefined) {
    if (!isText(epitaph, EPITAPH_MAX_LENGTH)) return null;
    out.epitaph = epitaph;
  }
  return out;
}

function plan(v: unknown): Plan | null {
  if (!isObj(v) || !isInstant(v.weekStart) || !Array.isArray(v.steps) || v.steps.length > LIMITS.steps) return null;
  if (!isTextList(v.lessons, MAX_LESSONS, NOTE_MAX_LENGTH) || !isText(v.promise, NOTE_MAX_LENGTH) || !isText(v.text, LIMITS.text)) return null;
  if (typeof v.dropped !== 'number' || !Number.isSafeInteger(v.dropped) || v.dropped < 0) return null;
  const steps = v.steps.map(step);
  if (steps.some((s) => s === null)) return null;
  return { weekStart: v.weekStart, steps: steps as PlanStep[], lessons: [...v.lessons], promise: v.promise, dropped: v.dropped, text: v.text };
}

function record(v: unknown): SeanceRecord | null {
  if (!isObj(v) || !isText(v.id, LIMITS.id) || v.id.trim().length === 0 || !isInstant(v.at)) return null;
  const a = answers(v.answers);
  const p = plan(v.plan);
  return a && p ? { id: v.id, at: v.at, answers: a, plan: p } : null;
}

/** Reads the stored setting: valid records only, without duplicate ids, newest first, capped. */
export function parseHistory(value: unknown): SeanceRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: SeanceRecord[] = [];
  for (const raw of value) {
    const r = record(raw);
    if (r && !seen.has(r.id)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out.sort(newestFirst).slice(0, HISTORY_MAX);
}
