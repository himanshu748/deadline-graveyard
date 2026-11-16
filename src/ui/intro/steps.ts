// The first-visit step machine and captions (first-visit R1.2, R3.1, R3.2). Pure data, so the
// order, the step count and the time budget are unit tested without a DOM.
import { DEMO_IDS } from './demo-seed.ts';

export type IntroStep = 'moonrise' | 'flicker' | 'grave' | 'ghost' | 'lantern' | 'keep';
export type TourStep = Exclude<IntroStep, 'keep'>;

/** R1.2: at most 5 captioned steps. `keep` is the closing question (R2.4), not a step. */
export const TOUR: readonly TourStep[] = ['moonrise', 'flicker', 'grave', 'ghost', 'lantern'];

/** R1.2: the whole tour must fit in 60 s for a passive viewer in full motion. */
export const INTRO_MAX_SECONDS = 60;

/** Seconds each step stays up in full motion before it moves on by itself. Sum: 49 s. */
export const STEP_SECONDS: Record<TourStep, number> = { moonrise: 9, flicker: 8, grave: 10, ghost: 11, lantern: 11 };

export function nextStep(step: IntroStep): IntroStep | null {
  if (step === 'keep') return null;
  return TOUR[TOUR.indexOf(step) + 1] ?? 'keep';
}

/** 1-based position for "step 2 of 5". */
export function stepNumber(step: TourStep): number {
  return TOUR.indexOf(step) + 1;
}

export interface StepCopy {
  title: string;
  text: string;
}

export const STEP_COPY: Record<IntroStep, StepCopy> = {
  moonrise: {
    title: 'Welcome to the graveyard',
    text: 'Each candle is a deadline, burning down in real time. These three are demo deadlines, each labelled Demo.',
  },
  flicker: {
    title: 'Due within 24 hours',
    text: 'This candle is nearly out of wax because it is due in a few hours. With motion on, its flame flickers fast.',
  },
  grave: {
    title: 'Missed deadlines become graves',
    text: 'When a deadline passes, its candle becomes a tombstone. Engrave what you learned as its epitaph, like this demo one.',
  },
  ghost: {
    title: 'Neglected projects haunt you',
    text: 'Seven days without activity turns a deadline into a ghost. Revive it to light its candle again, or bury it later.',
  },
  lantern: {
    title: 'Submitted work lights a lantern',
    text: 'Mark a deadline submitted and a lantern lights on the fence. Try it on the demo game jam.',
  },
  keep: {
    title: 'Keep the demo?',
    text: keepText(3),
  },
};

/** R2.4: the closing question, with the number of demo deadlines that are left. */
export function keepText(count: number): string {
  const what = count === 1 ? 'the demo deadline' : `the ${count} demo deadlines`;
  return `Keep ${what} to look around, or clear them and add your own. Export and settings can clear them later and replay this tour.`;
}

export interface StepFocus {
  /** The demo item the camera and pointer aim at. */
  id: string;
  /** A wide view of the whole scene instead of a close spotlight. */
  wide: boolean;
}

/** R3.1, R3.2: where each step points. The closing question shows the whole scene. */
export function stepFocus(step: IntroStep): StepFocus | null {
  switch (step) {
    case 'moonrise':
      return { id: DEMO_IDS.b, wide: true };
    case 'flicker':
      return { id: DEMO_IDS.b, wide: false };
    case 'grave':
      return { id: DEMO_IDS.c, wide: false };
    case 'ghost':
    case 'lantern':
      return { id: DEMO_IDS.a, wide: false };
    case 'keep':
      return null;
  }
}
