// The Séance dialog (seance R1.1 to R1.3, R2.5, R2.6, R3.2): three questions one at a time, each
// skippable, with the relevant items as checkboxes; then next week's plan, whose revive, bury and
// epitaph actions run one by one after a confirmation. Nothing is saved until the third question
// is finished. The App owns the clock, storage and domain actions and passes them in.
import { useEffect, useRef, useState } from 'preact/hooks';
import { formatForDisplay } from '../domain/time.ts';
import type { EpochMs, Item } from '../domain/types.ts';
import type { LlmProvider } from '../llm/provider.ts';
import type { MotionMode } from '../scene/motion.ts';
import { Modal } from '../ui/Modal.tsx';
import type { ViewEntry } from '../ui/view-model.ts';
import { CandleCircle } from './CandleCircle.tsx';
import { phrase, type Phrased } from './phrase.ts';
import {
  ACTION_VERBS,
  candidatesFor,
  emptyAnswers,
  NOTE_MAX_LENGTH,
  SECTION_HEADINGS,
  SECTION_ORDER,
  stepLabel,
  WEEK_MS,
  type Answer,
  type PlanStep,
  type Question,
  type SeanceAnswers,
  type SeanceRecord,
} from './plan.ts';

export interface SeanceProps {
  items: readonly Item[];
  now: EpochMs;
  /** The list view's entries, so status words and due times match it exactly. */
  entries: ReadonlyMap<string, ViewEntry>;
  userZone: string;
  locale: string;
  /** Newest first (R3.2). */
  history: readonly SeanceRecord[];
  mode: MotionMode;
  llm: LlmProvider;
  llmName: string;
  /** Builds and saves the plan. `error` is set when it could not be saved. */
  onFinish: (answers: SeanceAnswers) => Promise<{ record: SeanceRecord; error: string | null }>;
  /** Runs one confirmed plan action. Resolves to an error message, or null on success. */
  onApply: (step: PlanStep) => Promise<string | null>;
  onClose: () => void;
}

interface QuestionCopy {
  key: keyof SeanceAnswers;
  title: string;
  hint: string;
  legend: string;
  noteLabel: string;
  noteHint: string;
  empty: string;
}

export const QUESTIONS: Record<Question, QuestionCopy> = {
  1: {
    key: 'restless',
    title: 'Which spirits are restless?',
    hint: 'Deadlines due in the next 7 days, and every ghost. Pick the ones that worry you.',
    legend: 'Due this week, and ghosts',
    noteLabel: 'What is haunting you? (optional)',
    noteHint: 'Kept with this séance in your browser.',
    empty: 'Nothing is due in the next 7 days and no ghost is wandering.',
  },
  2: {
    key: 'lessons',
    title: 'What did the graves teach you?',
    hint: 'Deadlines missed or buried in the last 7 days. Pick the graves your lessons belong to.',
    legend: 'Graves from the last 7 days',
    noteLabel: 'Lessons, one per line (optional)',
    noteHint: 'The plan offers each lesson as the epitaph of a picked grave that has none.',
    empty: 'No deadline was missed or buried in the last 7 days.',
  },
  3: {
    key: 'keepAlive',
    title: 'What will you keep alive next week?',
    hint: 'Every deadline that is still open. Your picks go first in the plan.',
    legend: 'Open deadlines',
    noteLabel: 'A promise to yourself (optional)',
    noteHint: 'Shown at the top of the plan.',
    empty: 'No deadline is open. Add one to light a candle.',
  },
};

type Actionable = Exclude<PlanStep['action'], 'work'>;

const APPLY: Record<Actionable, { button: string; yes: string; done: string; confirm: (s: PlanStep) => string }> = {
  revive: {
    button: 'Revive',
    yes: 'Yes, revive it',
    done: 'Revived. Its candle burns again.',
    confirm: (s) => `Revive ${stepLabel(s)}? Its candle burns again and the 7-day ghost clock starts over.`,
  },
  bury: {
    button: 'Bury',
    yes: 'Yes, bury it',
    done: 'Buried. Its tombstone stands in the graveyard.',
    confirm: (s) => `Bury ${stepLabel(s)}? It becomes a tombstone, and this cannot be undone.`,
  },
  epitaph: {
    button: 'Engrave epitaph',
    yes: 'Yes, engrave it',
    done: 'Engraved on its tombstone.',
    confirm: (s) => `Engrave "${s.epitaph ?? ''}" on the tombstone of ${stepLabel(s)}?`,
  },
};

type View = { kind: 'question'; q: Question } | { kind: 'plan'; record: SeanceRecord; saveError: string | null };

function withAnswer(answers: SeanceAnswers, key: keyof SeanceAnswers, value: Answer): SeanceAnswers {
  const next = { ...answers };
  next[key] = value;
  return next;
}

export function Seance({ items, now, entries, userZone, locale, history, mode, llm, llmName, onFinish, onApply, onClose }: SeanceProps) {
  const [view, setView] = useState<View>({ kind: 'question', q: 1 });
  const [answers, setAnswers] = useState<SeanceAnswers>(emptyAnswers);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, { ok: boolean; text: string }>>({});
  const [phrased, setPhrased] = useState<Phrased | null>(null);
  const [phraseNote, setPhraseNote] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const viewKey = view.kind === 'question' ? `q${view.q}` : 'plan';
  const titleId = 'seance-title';

  // Each new question and the plan start at their heading, so a screen reader reads it first.
  useEffect(() => {
    headingRef.current?.focus();
  }, [viewKey]);

  // After a confirmation opens or closes, focus goes to the control that replaced the old one.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = null;
    document.getElementById(id)?.focus();
  });

  const when = (ms: EpochMs) => {
    try {
      return formatForDisplay(ms, userZone, userZone, locale).primary;
    } catch {
      return new Date(ms).toISOString();
    }
  };

  const finish = async (final: SeanceAnswers) => {
    setBusy(true);
    const { record, error } = await onFinish(final);
    setBusy(false);
    setView({ kind: 'plan', record, saveError: error });
  };

  const advance = (q: Question, final: SeanceAnswers) => {
    if (q === 3) return void finish(final);
    setView({ kind: 'question', q: (q + 1) as Question });
  };

  const apply = async (step: PlanStep, i: number) => {
    setBusy(true);
    const error = await onApply(step);
    setBusy(false);
    setConfirming(null);
    setResults((r) => ({ ...r, [i]: error ? { ok: false, text: error } : { ok: true, text: APPLY[step.action as Actionable].done } }));
    pendingFocus.current = `seance-result-${i}`;
  };

  const rephrase = async (record: SeanceRecord) => {
    setBusy(true);
    setPhraseNote(`Asking ${llmName}...`);
    const out = await phrase(record.plan, llm);
    setBusy(false);
    setPhrased(out);
    setPhraseNote(
      out.source === 'llm'
        ? `Rephrased by ${llmName}. The steps and buttons below still come from the rules.`
        : `${llmName} did not give a usable answer, so the plan stays written by the rules.`,
    );
  };

  const renderQuestion = (q: Question) => {
    const copy = QUESTIONS[q];
    const answer = answers[copy.key];
    const candidates = candidatesFor(q, items, now);
    const toggle = (id: string, checked: boolean) =>
      setAnswers((a) => {
        const ids = a[copy.key].itemIds.filter((x) => x !== id);
        return withAnswer(a, copy.key, { ...a[copy.key], itemIds: checked ? [...ids, id] : ids });
      });
    return (
      <>
        <p class="seance-progress">Question {q} of 3</p>
        <h3 id="seance-question" ref={headingRef} tabIndex={-1}>
          {copy.title}
        </h3>
        <p class="hint">{copy.hint}</p>
        {candidates.length > 0 ? (
          <fieldset class="seance-picks">
            <legend>{copy.legend}</legend>
            <ul>
              {candidates.map((item, i) => {
                const entry = entries.get(item.id);
                const id = `seance-pick-${q}-${i}`;
                return (
                  <li key={item.id}>
                    <input id={id} type="checkbox" checked={answer.itemIds.includes(item.id)} onChange={(e) => toggle(item.id, e.currentTarget.checked)} />
                    <label for={id}>
                      {item.title}
                      {item.demo ? <span class="badge-demo">Demo</span> : null}
                      <span class="pick-meta">{entry ? `${entry.statusText}, due ${entry.dueText}` : `due ${when(item.dueAt)}`}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : (
          <p class="empty">{copy.empty}</p>
        )}
        <div class="field">
          <label for={`seance-note-${q}`}>{copy.noteLabel}</label>
          <textarea
            id={`seance-note-${q}`}
            rows={3}
            maxLength={NOTE_MAX_LENGTH}
            value={answer.note}
            onInput={(e) => {
              const note = e.currentTarget.value;
              setAnswers((a) => withAnswer(a, copy.key, { ...a[copy.key], note }));
            }}
            aria-describedby={`seance-note-hint-${q}`}
          />
          <span class="hint" id={`seance-note-hint-${q}`}>
            {copy.noteHint}
          </span>
        </div>
        <div class="panel-actions">
          <button type="button" class="btn btn-primary" disabled={busy} onClick={() => advance(q, answers)}>
            {q === 3 ? 'Finish and see the plan' : 'Next question'}
          </button>
          <button
            type="button"
            class="btn"
            disabled={busy}
            onClick={() => {
              // R1.2: a skipped question counts as no answer, even if something was typed.
              const cleared = withAnswer(answers, copy.key, { itemIds: [], note: '' });
              setAnswers(cleared);
              advance(q, cleared);
            }}
          >
            Skip this question
          </button>
          {q > 1 ? (
            <button type="button" class="btn" disabled={busy} onClick={() => setView({ kind: 'question', q: (q - 1) as Question })}>
              Back
            </button>
          ) : null}
        </div>
        <p class="hint">Nothing is saved until you finish the third question.</p>
      </>
    );
  };

  const renderStep = (step: PlanStep, i: number) => {
    const result = results[i];
    const action = step.action === 'work' ? null : APPLY[step.action];
    return (
      <li key={step.itemId} class="plan-step">
        <p class="plan-step-title">
          {ACTION_VERBS[step.action]} {step.title}
          {step.demo ? <span class="badge-demo">Demo</span> : null}
        </p>
        {step.action === 'epitaph' ? <p class="epitaph">{`\u201C${step.epitaph ?? ''}\u201D`}</p> : null}
        <p class="entry-meta">
          Due {when(step.dueAt)}. {step.reason}
        </p>
        {action && result?.ok ? (
          <p id={`seance-result-${i}`} class="success" tabIndex={-1}>
            {result.text}
          </p>
        ) : null}
        {action && !result?.ok && confirming === i ? (
          <div class="confirm" role="group" aria-labelledby={`seance-confirm-${i}`}>
            <p id={`seance-confirm-${i}`}>{action.confirm(step)}</p>
            <div class="panel-actions">
              <button id={`seance-yes-${i}`} type="button" class={step.action === 'bury' ? 'btn btn-danger' : 'btn btn-primary'} disabled={busy} onClick={() => void apply(step, i)}>
                {action.yes}
              </button>
              <button
                type="button"
                class="btn"
                onClick={() => {
                  setConfirming(null);
                  pendingFocus.current = `seance-apply-${i}`;
                }}
              >
                Not now
              </button>
            </div>
          </div>
        ) : null}
        {action && !result?.ok && confirming !== i ? (
          <button
            id={`seance-apply-${i}`}
            type="button"
            class={step.action === 'bury' ? 'btn btn-small btn-danger' : 'btn btn-small'}
            disabled={busy}
            onClick={() => {
              setConfirming(i);
              pendingFocus.current = `seance-yes-${i}`;
            }}
          >
            {action.button}
            <span class="visually-hidden">: {stepLabel(step)}</span>
          </button>
        ) : null}
        {action && result && !result.ok ? (
          <p id={`seance-result-${i}`} class="error" tabIndex={-1}>
            {result.text}
          </p>
        ) : null}
      </li>
    );
  };

  const renderPlan = (record: SeanceRecord, saveError: string | null) => {
    const { plan } = record;
    const indexed = plan.steps.map((step, i) => ({ step, i }));
    return (
      <>
        <p class="seance-progress">The circle is complete</p>
        <h3 id="seance-plan" ref={headingRef} tabIndex={-1}>
          Next week's plan
        </h3>
        {saveError ? (
          <p role="alert" class="error">
            {saveError}
          </p>
        ) : null}
        <p class="hint">
          {when(plan.weekStart)} to {when(plan.weekStart + WEEK_MS)}.{' '}
          {phrased === null ? 'Written by the rules on this device; no AI was used.' : 'The steps below were written by the rules on this device.'}
        </p>
        {plan.promise ? <p class="seance-promise">Your promise: {plan.promise}</p> : null}
        {plan.steps.length === 0 && plan.lessons.length === 0 ? <p class="empty">Nothing is due in the next 7 days and no ghost needs you. Rest, or light a new candle.</p> : null}
        {SECTION_ORDER.map((section) => {
          const steps = indexed.filter(({ step }) => step.section === section);
          if (section === 'lessons' ? plan.lessons.length === 0 : steps.length === 0) return null;
          const headingId = `plan-section-${section}`;
          return (
            <section key={section} class="plan-section" aria-labelledby={headingId}>
              <h4 id={headingId}>{SECTION_HEADINGS[section]}</h4>
              {section === 'lessons' ? (
                <ul class="plan-lessons">
                  {plan.lessons.map((lesson, i) => (
                    <li key={i}>{lesson}</li>
                  ))}
                </ul>
              ) : null}
              {steps.length > 0 ? <ol class="plan-steps">{steps.map(({ step, i }) => renderStep(step, i))}</ol> : null}
            </section>
          );
        })}
        {plan.dropped > 0 ? (
          <p class="hint">
            {plan.dropped === 1 ? '1 picked deadline no longer exists, so it was left out.' : `${plan.dropped} picked deadlines no longer exist, so they were left out.`}
          </p>
        ) : null}
        {llm.id !== 'none' ? (
          <div class="seance-llm">
            <button type="button" class="btn btn-small" disabled={busy} onClick={() => void rephrase(record)}>
              Rephrase with {llmName} (sends the plan text to {llmName})
            </button>
            {phrased?.source === 'llm' ? (
              <figure class="seance-phrased">
                <figcaption>In {llmName}'s words</figcaption>
                <p class="plan-text">{phrased.text}</p>
              </figure>
            ) : null}
          </div>
        ) : null}
        <p role="status" class="hint">
          {phraseNote}
        </p>
        <div class="panel-actions">
          <button type="button" class="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </>
    );
  };

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <button type="button" class="btn btn-small panel-close" onClick={onClose}>
        Close
      </button>
      <h2 id={titleId}>The Séance</h2>
      <CandleCircle lit={view.kind === 'question' ? view.q : 3} mode={mode} />
      {view.kind === 'question' ? renderQuestion(view.q) : renderPlan(view.record, view.saveError)}
      {history.length > 0 ? (
        <details class="seance-history">
          <summary>Past séances ({history.length})</summary>
          <ul>
            {history.map((r) => (
              <li key={r.id}>
                <p class="seance-history-date">{when(r.at)}</p>
                {r.answers.restless.note.trim() ? <p class="entry-meta">What haunted you: {r.answers.restless.note.trim()}</p> : null}
                <p class="plan-text">{r.plan.text}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Modal>
  );
}
