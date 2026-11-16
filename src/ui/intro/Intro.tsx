// The first-visit intro panel (first-visit R1.2 to R1.5, R2.4, R3.1 to R3.3). A modal dialog at
// the bottom of the screen with one caption per step; the scene above it shows the real (demo)
// items under a moving spotlight. The App owns the step, the items and the domain actions.
// Skip and Escape end the tour at any time. In full motion each step moves on by itself (with
// Pause, WCAG 2.2.2); in reduced motion nothing moves and every step waits for Next.
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Status } from '../../domain/types.ts';
import { startStepClock, type MotionMode, type StepClock } from '../../scene/motion.ts';
import { Modal } from '../Modal.tsx';
import { keepText, nextStep, STEP_COPY, STEP_SECONDS, stepNumber, TOUR, type IntroStep } from './steps.ts';

export { nextStep } from './steps.ts';

export interface IntroProps {
  step: IntroStep;
  mode: MotionMode;
  /** Status of demo item A right now, or null when it no longer exists. */
  ghostStatus: Status | null;
  /** Demo items left, for the closing question. */
  demoCount: number;
  onNext: () => void;
  /** Skip button and Escape during the tour (R1.3). */
  onSkip: () => void;
  /** R3.1 and R3.2: resolve to an error message, or null when the action worked. */
  onRevive: () => Promise<string | null>;
  onSubmit: () => Promise<string | null>;
  /** R2.4: the closing choice. */
  onFinish: (clear: boolean) => void;
  /** Test seam; the default is the GSAP step clock from the scene motion helper. */
  startClock?: typeof startStepClock;
}

const INVITES = {
  ghost: { yes: 'Revive the ghost', done: 'Revived. Its candle burns on the ground again.' },
  lantern: { yes: 'Light the lantern', done: 'Submitted. Its lantern now hangs lit on the fence.' },
} as const;

type Invite = keyof typeof INVITES;

function inviteFor(step: IntroStep, status: Status | null): Invite | null {
  if (step === 'ghost' && status === 'ghost') return 'ghost';
  if (step === 'lantern' && (status === 'active' || status === 'due-soon' || status === 'ghost')) return 'lantern';
  return null;
}

export function Intro({ step, mode, ghostStatus, demoCount, onNext, onSkip, onRevive, onSubmit, onFinish, startClock = startStepClock }: IntroProps) {
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<{ step: IntroStep; ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogBody = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const clock = useRef<StepClock | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  const tour = step !== 'keep';
  const copy = STEP_COPY[step];
  const shownResult = result?.step === step ? result : null;
  const invite = shownResult?.ok ? null : inviteFor(step, ghostStatus);

  // R1.5 lands focus on the scene later; inside the panel, Next starts with focus.
  useLayoutEffect(() => {
    nextRef.current?.focus();
  }, []);

  // When the focused control disappears (an invitation that was answered or declined), focus goes
  // to Next instead of the page body. The closing question always starts on Keep the demo.
  useEffect(() => {
    if (step === 'keep') {
      keepRef.current?.focus();
      return;
    }
    if (dialogBody.current?.contains(document.activeElement)) return;
    nextRef.current?.focus();
  }, [step, shownResult, invite]);

  // R1.2, R1.4: the step clock exists only in full motion. A paused tour stays paused across steps.
  useEffect(() => {
    if (!tour) return;
    let c: StepClock | null = null;
    try {
      c = startClock(mode, STEP_SECONDS[step], () => onNextRef.current(), barRef.current);
    } catch {
      c = null; // No timer: the tour waits for Next, as in reduced motion.
    }
    if (c && pausedRef.current) c.pause();
    clock.current = c;
    return () => {
      c?.stop();
      clock.current = null;
    };
  }, [step, mode]);

  const togglePause = () => {
    if (paused) clock.current?.resume();
    else clock.current?.pause();
    setPaused(!paused);
  };

  const accept = async (kind: Invite) => {
    setBusy(true);
    const error = await (kind === 'ghost' ? onRevive() : onSubmit());
    setBusy(false);
    setResult({ step, ok: error === null, text: error ?? INVITES[kind].done });
  };

  const titleId = 'intro-kicker intro-title';
  const full = mode === 'full';

  return (
    <Modal titleId={titleId} onClose={() => (tour ? onSkip() : onFinish(false))} className="intro">
      <div ref={dialogBody} class="intro-body" data-step={step}>
        <p class="intro-kicker" id="intro-kicker">
          {tour ? `First visit, step ${stepNumber(step)} of ${TOUR.length}` : 'First visit'}
        </p>
        {full && tour ? (
          <div class="intro-progress" aria-hidden="true">
            <span ref={barRef} key={step} />
          </div>
        ) : null}
        <div class="intro-copy" aria-live="polite">
          <h2 id="intro-title">{copy.title}</h2>
          <p>{step === 'keep' ? keepText(demoCount) : copy.text}</p>
          {shownResult ? <p class={shownResult.ok ? 'success' : 'error'}>{shownResult.text}</p> : null}
        </div>
        {invite ? (
          // Keyed by step, so a new invitation never inherits the focus of the last one's buttons.
          <div key={`invite-${step}`} class="intro-invite panel-actions" role="group" aria-label="Try it on the demo">
            <button type="button" class="btn btn-primary" disabled={busy} onClick={() => void accept(invite)}>
              {INVITES[invite].yes}
            </button>
            <button type="button" class="btn" disabled={busy} onClick={onNext}>
              Not now
            </button>
          </div>
        ) : null}
        {tour ? (
          <>
            {!full ? <p class="hint">Motion is reduced, so each step waits for Next.</p> : null}
            <div key="tour" class="panel-actions intro-controls">
              <button type="button" class="btn" onClick={onSkip}>
                Skip intro
              </button>
              {full ? (
                <button type="button" class="btn" onClick={togglePause}>
                  {paused ? 'Resume the tour' : 'Pause the tour'}
                </button>
              ) : null}
              <button ref={nextRef} type="button" class={invite ? 'btn' : 'btn btn-primary'} onClick={onNext}>
                {nextStep(step) === 'keep' ? 'Finish the tour' : 'Next'}
              </button>
            </div>
          </>
        ) : (
          <div key="keep" class="panel-actions intro-controls">
            <button ref={keepRef} type="button" class="btn btn-primary" onClick={() => onFinish(false)}>
              Keep the demo
            </button>
            <button type="button" class="btn" onClick={() => onFinish(true)} disabled={demoCount === 0}>
              Clear demo
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
