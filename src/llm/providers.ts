// Optional network providers behind the LlmProvider interface (capture-and-export R5.1, R5.3).
// Endpoints and request shapes confirmed in official docs on 2026-11-16 (full list in design.md):
// - Gemini: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent,
//   header x-goog-api-key, generationConfig.responseMimeType application/json
//   (https://aistudio.google.com/api-reference/generate-content; ai.google.dev now redirects there).
//   gemini-3.5-flash-lite is listed as Stable in https://aistudio.google.com/docs/models and its
//   input and output are "Free of charge" on the free tier in https://aistudio.google.com/docs/pricing
//   (free-tier content is "Used to improve our products": Yes).
// - Groq: OpenAI-compatible POST https://api.groq.com/openai/v1/chat/completions with a Bearer key,
//   response_format json_object, which works on all models (https://console.groq.com/docs/openai,
//   /docs/structured-outputs). openai/gpt-oss-20b is in the Free Plan table of
//   https://console.groq.com/docs/rate-limits; llama-3.1-8b-instant is not (Enterprise only in /docs/models).
// - Ollama: POST {base}/api/chat with stream false and format json
//   (https://github.com/ollama/ollama/blob/main/docs/api.md). Browser origins other than
//   localhost, 127.0.0.1 and 0.0.0.0 need OLLAMA_ORIGINS (https://docs.ollama.com/faq).
// Browser CORS: OPTIONS preflights and keyless POSTs to the Gemini and Groq endpoints were answered
// with Access-Control-Allow-Origin on 2026-11-16 (checked with curl), so both can be called from the page.
// Keys are passed in by the caller from browser storage and sent only to their own provider.
import { extractionPrompt, noneProvider, parseSuggestionText, planPrompt, type LlmProvider, type ProviderId } from './provider.ts';

export interface ProviderSettings {
  provider: ProviderId;
  geminiKey?: string;
  geminiModel?: string;
  groqKey?: string;
  groqModel?: string;
  ollamaUrl?: string;
  ollamaModel?: string;
}

export const DEFAULT_MODELS = {
  gemini: 'gemini-3.5-flash-lite',
  groq: 'openai/gpt-oss-20b',
  ollama: 'llama3.2',
} as const;

export const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const TIMEOUT_MS = 20_000;

type Fetch = typeof fetch;

async function postJson(fetchImpl: Fetch, url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`provider answered ${response.status}`);
  return response.json() as Promise<unknown>;
}

function dig(value: unknown, path: Array<string | number>): unknown {
  let v = value;
  for (const key of path) {
    if (typeof v !== 'object' || v === null) return undefined;
    v = (v as Record<string | number, unknown>)[key];
  }
  return v;
}

const text = (v: unknown) => (typeof v === 'string' ? v : undefined);

export function geminiProvider(key: string, model: string = DEFAULT_MODELS.gemini, fetchImpl: Fetch = fetch): LlmProvider {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const call = async (prompt: string, json: boolean) => {
    const body: Record<string, unknown> = { contents: [{ parts: [{ text: prompt }] }] };
    if (json) body.generationConfig = { responseMimeType: 'application/json' };
    const reply = await postJson(fetchImpl, url, { 'x-goog-api-key': key }, body);
    return text(dig(reply, ['candidates', 0, 'content', 'parts', 0, 'text']));
  };
  return {
    id: 'gemini',
    async extractDeadline(t) {
      return parseSuggestionText(await call(extractionPrompt(t), true));
    },
    async phrasePlan(p) {
      return (await call(planPrompt(p), false))?.trim() || null;
    },
  };
}

interface ChatShape {
  id: ProviderId;
  url: string;
  headers: Record<string, string>;
  model: string;
  /** Sent on every call. */
  base: Record<string, unknown>;
  /** Added when a JSON reply is wanted. */
  json: Record<string, unknown>;
  pick: (reply: unknown) => unknown;
}

/** Chat-style providers: Groq (OpenAI-compatible) and Ollama /api/chat share one request shape. */
function chatProvider({ id, url, headers, model, base, json: jsonBody, pick }: ChatShape, fetchImpl: Fetch): LlmProvider {
  const call = async (prompt: string, json: boolean) => {
    const body: Record<string, unknown> = { model, messages: [{ role: 'user', content: prompt }], ...base, ...(json ? jsonBody : {}) };
    return text(pick(await postJson(fetchImpl, url, headers, body)));
  };
  return {
    id,
    async extractDeadline(t) {
      return parseSuggestionText(await call(extractionPrompt(t), true));
    },
    async phrasePlan(p) {
      return (await call(planPrompt(p), false))?.trim() || null;
    },
  };
}

export function groqProvider(key: string, model: string = DEFAULT_MODELS.groq, fetchImpl: Fetch = fetch): LlmProvider {
  return chatProvider(
    {
      id: 'groq',
      url: 'https://api.groq.com/openai/v1/chat/completions',
      headers: { authorization: `Bearer ${key}` },
      model,
      base: {},
      json: { response_format: { type: 'json_object' } },
      pick: (r) => dig(r, ['choices', 0, 'message', 'content']),
    },
    fetchImpl,
  );
}

/** Only http(s) base URLs; the user's own machine is the expected target. */
export function normalizeOllamaUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim() || DEFAULT_OLLAMA_URL;
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return DEFAULT_OLLAMA_URL;
    return u.origin;
  } catch {
    return DEFAULT_OLLAMA_URL;
  }
}

export function ollamaProvider(baseUrl: string = DEFAULT_OLLAMA_URL, model: string = DEFAULT_MODELS.ollama, fetchImpl: Fetch = fetch): LlmProvider {
  return chatProvider(
    {
      id: 'ollama',
      url: `${normalizeOllamaUrl(baseUrl)}/api/chat`,
      headers: {},
      model,
      // Ollama streams by default; every call here wants one JSON object back.
      base: { stream: false },
      json: { format: 'json' },
      pick: (r) => dig(r, ['message', 'content']),
    },
    fetchImpl,
  );
}

/** Builds the selected provider. Missing keys fall back to `none` (R5.2). */
export function createProvider(settings: ProviderSettings, referenceZone: string, fetchImpl: Fetch = fetch): LlmProvider {
  switch (settings.provider) {
    case 'gemini':
      return settings.geminiKey ? geminiProvider(settings.geminiKey, settings.geminiModel || DEFAULT_MODELS.gemini, fetchImpl) : noneProvider(referenceZone);
    case 'groq':
      return settings.groqKey ? groqProvider(settings.groqKey, settings.groqModel || DEFAULT_MODELS.groq, fetchImpl) : noneProvider(referenceZone);
    case 'ollama':
      return ollamaProvider(settings.ollamaUrl, settings.ollamaModel || DEFAULT_MODELS.ollama, fetchImpl);
    default:
      return noneProvider(referenceZone);
  }
}
