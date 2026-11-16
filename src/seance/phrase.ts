// Optional LLM rephrasing of a finished plan (seance R2.5). The provider only ever sees the
// rule-based plan text. Its reply is shown as text only; the steps and their buttons always come
// from the rule-based plan, so an LLM cannot change which items, order or actions are offered.
import type { LlmProvider } from '../llm/provider.ts';
import type { Plan } from './plan.ts';

/** Replies of this length or longer are refused (design.md). */
export const PHRASE_MAX_LENGTH = 2_000;

export interface Phrased {
  text: string;
  source: 'rules' | 'llm';
}

/**
 * True when `reply` is non-empty, under PHRASE_MAX_LENGTH, names every step title in plan
 * order, and still says "Demo" when the plan has demo items.
 */
export function keepsPlan(plan: Plan, reply: string): boolean {
  const text = reply.trim();
  if (text.length === 0 || text.length >= PHRASE_MAX_LENGTH) return false;
  let from = 0;
  for (const step of plan.steps) {
    const at = text.indexOf(step.title, from);
    if (at < 0) return false;
    from = at + step.title.length;
  }
  return !plan.steps.some((s) => s.demo) || text.includes('Demo');
}

/** R2.5: the provider's rephrasing when it keeps the plan, otherwise the rule-based text. */
export async function phrase(plan: Plan, provider: LlmProvider): Promise<Phrased> {
  const rules: Phrased = { text: plan.text, source: 'rules' };
  if (provider.id === 'none') return rules;
  try {
    const reply = await provider.phrasePlan({ answers: [], planLines: plan.text.split('\n').filter((line) => line.trim().length > 0) });
    if (reply !== null && keepsPlan(plan, reply)) return { text: reply.trim(), source: 'llm' };
  } catch {
    // Network, CORS, quota or a malformed reply: keep the rule-based text.
  }
  return rules;
}
