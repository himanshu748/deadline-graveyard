// Validates: seance R2.4, R2.5. Fake providers only: no real network call is made.
import { describe, expect, it, vi } from 'vitest';
import { DAY, HOUR, makeItem } from '../domain/test-items.ts';
import { noneProvider, planPrompt, type LlmProvider, type PlanPrompt } from '../llm/provider.ts';
import { groqProvider } from '../llm/providers.ts';
import { buildPlan, emptyAnswers } from './plan.ts';
import { keepsPlan, phrase, PHRASE_MAX_LENGTH } from './phrase.ts';

const NOW = Date.UTC(2026, 10, 30, 12);
const plan = buildPlan(
  [
    makeItem({ id: 'a', title: 'Grant form', dueAt: NOW + 5 * HOUR, lastActivityAt: NOW }),
    makeItem({ id: 'b', title: 'Essay', dueAt: NOW + 3 * DAY, lastActivityAt: NOW, demo: true }),
  ],
  emptyAnswers(),
  NOW,
  { locale: 'en-GB', zone: 'UTC' },
);

function fake(reply: string | null | Error): LlmProvider & { prompts: PlanPrompt[] } {
  const prompts: PlanPrompt[] = [];
  return {
    id: 'gemini',
    prompts,
    extractDeadline: async () => null,
    async phrasePlan(p) {
      prompts.push(p);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
}

const GOOD = 'First, finish the Grant form today. Then give the Essay (Demo) an hour each evening.';

describe('phrase (R2.5)', () => {
  it('uses the rule-based text with provider none and never calls the network (R2.4)', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await phrase(plan, noneProvider('UTC'))).toEqual({ text: plan.text, source: 'rules' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('accepts a rephrasing that keeps every title in order and the Demo label', async () => {
    const p = fake(`  ${GOOD}  `);
    expect(await phrase(plan, p)).toEqual({ text: GOOD, source: 'llm' });
    expect(p.prompts[0]).toEqual({ answers: [], planLines: plan.text.split('\n').filter((l) => l.trim() !== '') });
  });

  it.each([
    ['drops a title', 'Finish the Grant form today. Then rest.'],
    ['swaps the order', 'Start the Essay (Demo), then the Grant form.'],
    ['drops the Demo label', 'Finish the Grant form, then the Essay.'],
    ['is empty', '   '],
    ['is too long', `${GOOD} ${'x'.repeat(PHRASE_MAX_LENGTH)}`],
  ])('falls back to the rules when the reply %s', async (_why, reply) => {
    expect(await phrase(plan, fake(reply))).toEqual({ text: plan.text, source: 'rules' });
  });

  it('falls back to the rules when the provider fails or returns nothing', async () => {
    expect(await phrase(plan, fake(new Error('quota')))).toEqual({ text: plan.text, source: 'rules' });
    expect(await phrase(plan, fake(null))).toEqual({ text: plan.text, source: 'rules' });
  });

  it('falls back on an HTTP error from a real provider adapter with a fake fetch', async () => {
    const f = vi.fn(async () => new Response('{"error":"quota"}', { status: 429 }));
    expect(await phrase(plan, groqProvider('test-key-not-real', 'm', f))).toEqual({ text: plan.text, source: 'rules' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('keepsPlan checks the length limit exactly', () => {
    const base = 'Grant form Essay Demo ';
    expect(keepsPlan(plan, base.padEnd(PHRASE_MAX_LENGTH - 1, '.'))).toBe(true);
    expect(keepsPlan(plan, base.padEnd(PHRASE_MAX_LENGTH, '.'))).toBe(false);
  });
});

describe('planPrompt', () => {
  it('leaves out the answers block when there are none and asks to keep titles', () => {
    const text = planPrompt({ answers: [], planLines: ['1. Work on Essay (Demo)'] });
    expect(text).not.toContain('Answers:');
    expect(text).toContain('Keep every deadline title exactly as written, including "(Demo)", in the same order.');
    expect(text).toContain('- 1. Work on Essay (Demo)');
    expect(planPrompt({ answers: ['a'], planLines: [] })).toContain('Answers:\n1. a');
  });
});
