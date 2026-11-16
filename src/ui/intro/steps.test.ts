// Validates: first-visit R1.2 (at most 5 captioned steps within 60 s), R2.4, R3.1, R3.2 (targets).
import { describe, expect, it } from 'vitest';
import { DEMO_IDS } from './demo-seed.ts';
import { INTRO_MAX_SECONDS, keepText, nextStep, STEP_COPY, STEP_SECONDS, stepFocus, stepNumber, TOUR, type IntroStep } from './steps.ts';

describe('intro step machine', () => {
  it('walks moonrise, flicker, grave, ghost, lantern, then the keep question, then ends', () => {
    const seen: IntroStep[] = [];
    let step: IntroStep | null = 'moonrise';
    while (step !== null) {
      seen.push(step);
      step = nextStep(step);
    }
    expect(seen).toEqual(['moonrise', 'flicker', 'grave', 'ghost', 'lantern', 'keep']);
  });

  it('has at most 5 tour steps, numbered 1 to 5 (R1.2)', () => {
    expect(TOUR.length).toBeLessThanOrEqual(5);
    expect(TOUR.map(stepNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('fits the passive tour inside 60 s, with no step shorter than 8 s to read it (R1.2)', () => {
    const total = TOUR.reduce((sum, s) => sum + STEP_SECONDS[s], 0);
    expect(total).toBeLessThanOrEqual(INTRO_MAX_SECONDS);
    expect(INTRO_MAX_SECONDS).toBe(60);
    for (const s of TOUR) expect(STEP_SECONDS[s]).toBeGreaterThanOrEqual(8);
  });

  it('gives every step a caption with a title and text', () => {
    for (const s of [...TOUR, 'keep'] as const) {
      expect(STEP_COPY[s].title.length).toBeGreaterThan(0);
      expect(STEP_COPY[s].text.length).toBeGreaterThan(20);
    }
  });

  it('points the ghost and lantern steps at demo item A, and the others at B and C (R3.1, R3.2)', () => {
    expect(stepFocus('moonrise')).toEqual({ id: DEMO_IDS.b, wide: true });
    expect(stepFocus('flicker')).toEqual({ id: DEMO_IDS.b, wide: false });
    expect(stepFocus('grave')).toEqual({ id: DEMO_IDS.c, wide: false });
    expect(stepFocus('ghost')?.id).toBe(DEMO_IDS.a);
    expect(stepFocus('lantern')?.id).toBe(DEMO_IDS.a);
    expect(stepFocus('keep')).toBeNull();
  });

  it('counts the demo items left in the closing question (R2.4)', () => {
    expect(keepText(3)).toContain('Keep the 3 demo deadlines');
    expect(keepText(1)).toContain('Keep the demo deadline ');
  });
});
