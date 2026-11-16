// The single LLM adapter (capture-and-export R5.1 to R5.5, tech.md hard rule 3). Every feature
// works with `none`, the default, which is rule-based and makes no network calls. Other
// providers are optional helpers whose output is validated and shown as a suggestion.
import { findDateCandidates } from '../capture/dates.ts';
import { normalizeZone, toInstant } from '../domain/time.ts';

export type ProviderId = 'none' | 'gemini' | 'groq' | 'ollama';

export interface DeadlineSuggestion {
  title?: string;
  /** YYYY-MM-DD */
  date?: string;
  /** HH:mm */
  time?: string;
  /** IANA zone */
  zone?: string;
}

/** Input for phrasing a Séance plan. The rule-based plan is complete without it. */
export interface PlanPrompt {
  answers: string[];
  planLines: string[];
}

export interface LlmProvider {
  id: ProviderId;
  extractDeadline(text: string): Promise<DeadlineSuggestion | null>;
  phrasePlan(prompt: PlanPrompt): Promise<string | null>;
}

export const MAX_LLM_INPUT = 8_000;
const TITLE_MAX = 120;

/** R5.4: keeps only fields that parse; anything else is dropped. Null when nothing useful is left. */
export function validateSuggestion(raw: unknown): DeadlineSuggestion | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: DeadlineSuggestion = {};
  if (typeof o.title === 'string' && o.title.trim().length > 0) out.title = o.title.trim().slice(0, TITLE_MAX);
  if (typeof o.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && toInstant({ date: o.date, zone: 'UTC' }).ok) {
    out.date = o.date;
    if (typeof o.time === 'string' && /^\d{2}:\d{2}$/.test(o.time) && toInstant({ date: o.date, time: o.time, zone: 'UTC' }).ok) out.time = o.time;
  }
  if (typeof o.zone === 'string') {
    const zone = normalizeZone(o.zone);
    if (zone) out.zone = zone;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Parses the model's text reply, tolerating a ```json fence around the object. */
export function parseSuggestionText(text: string | undefined): DeadlineSuggestion | null {
  if (typeof text !== 'string') return null;
  const body = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return validateSuggestion(JSON.parse(body) as unknown);
  } catch {
    return null;
  }
}

/** R5.2: the default provider. Rule-based, offline, deterministic. */
export function noneProvider(referenceZone: string): LlmProvider {
  return {
    id: 'none',
    async extractDeadline(text) {
      const [first] = findDateCandidates(text, referenceZone);
      if (!first) return null;
      const s: DeadlineSuggestion = { date: first.date, zone: first.zone };
      if (first.time) s.time = first.time;
      return s;
    },
    async phrasePlan() {
      return null;
    },
  };
}

export function extractionPrompt(text: string): string {
  return [
    'Find the main deadline in this event or application page text.',
    'Reply with only a JSON object with these optional keys:',
    '"title" (short event name), "date" (YYYY-MM-DD), "time" (HH:mm, 24 h), "zone" (IANA time zone such as America/Los_Angeles).',
    'Leave out any key you are not sure about. Do not invent a date that is not in the text.',
    '',
    'Text:',
    text.slice(0, MAX_LLM_INPUT),
  ].join('\n');
}

export function planPrompt(prompt: PlanPrompt): string {
  return [
    'Rewrite this weekly plan as 3 to 6 short, kind, practical lines. Keep every deadline and date exactly as given and do not add new ones.',
    '',
    'Answers:',
    ...prompt.answers.map((a, i) => `${i + 1}. ${a.slice(0, 1_000)}`),
    '',
    'Plan:',
    ...prompt.planLines.map((l) => `- ${l.slice(0, 300)}`),
  ].join('\n');
}

export interface SuggestionOutcome {
  suggestion: DeadlineSuggestion | null;
  /** True when the chosen provider failed and the rule-based result was used instead (R5.4). */
  fellBack: boolean;
}

/** R5.4: asks the provider, falls back to `none` on any error or invalid output. */
export async function suggestDeadline(provider: LlmProvider, text: string, referenceZone: string): Promise<SuggestionOutcome> {
  if (provider.id === 'none') return { suggestion: await noneProvider(referenceZone).extractDeadline(text), fellBack: false };
  try {
    const suggestion = await provider.extractDeadline(text);
    if (suggestion) return { suggestion, fellBack: false };
  } catch {
    // Network, CORS, quota or parse failure: fall through to the rule-based result.
  }
  return { suggestion: await noneProvider(referenceZone).extractDeadline(text), fellBack: true };
}
