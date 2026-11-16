// Validates: capture-and-export R5.1 to R5.5. No real network calls: providers get a fake fetch.
import { describe, expect, it, vi } from 'vitest';
import { noneProvider, parseSuggestionText, suggestDeadline, validateSuggestion, type LlmProvider } from './provider.ts';
import { createProvider, DEFAULT_MODELS, geminiProvider, groqProvider, normalizeOllamaUrl, ollamaProvider } from './providers.ts';
import { loadLlmSettings, LLM_STORAGE_KEY, saveLlmSettings } from './settings.ts';

const PAGE = 'Spooky Jam closes December 4, 2026 at 2:00 PM PT.';

function fakeFetch(reply: unknown, status = 200) {
  return vi.fn(async (...args: [string | URL | Request, RequestInit?]) => {
    void args;
    return new Response(JSON.stringify(reply), { status, headers: { 'content-type': 'application/json' } });
  });
}

describe('none provider (R5.2)', () => {
  it('extracts with rules only and never touches the network', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    expect(await noneProvider('UTC').extractDeadline(PAGE)).toEqual({ date: '2026-12-04', time: '14:00', zone: 'America/Los_Angeles' });
    expect(await noneProvider('UTC').phrasePlan({ answers: [], planLines: [] })).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('is what createProvider returns by default and when a key is missing', () => {
    expect(createProvider({ provider: 'none' }, 'UTC').id).toBe('none');
    expect(createProvider({ provider: 'gemini' }, 'UTC').id).toBe('none');
    expect(createProvider({ provider: 'groq' }, 'UTC').id).toBe('none');
  });
});

describe('validation (R5.4, R5.5)', () => {
  it('keeps only fields that parse', () => {
    expect(validateSuggestion({ title: ' Jam ', date: '2026-12-04', time: '14:00', zone: 'America/Los_Angeles', extra: 1 })).toEqual({
      title: 'Jam',
      date: '2026-12-04',
      time: '14:00',
      zone: 'America/Los_Angeles',
    });
    expect(validateSuggestion({ date: '2026-02-30', time: '14:00', zone: 'Mars/Base' })).toBeNull();
    expect(validateSuggestion({ date: '2026-12-04', time: '25:00' })).toEqual({ date: '2026-12-04' });
    expect(validateSuggestion('nope')).toBeNull();
  });

  it('parses fenced JSON and rejects prose', () => {
    expect(parseSuggestionText('```json\n{"date":"2026-12-04"}\n```')).toEqual({ date: '2026-12-04' });
    expect(parseSuggestionText('The deadline is soon.')).toBeNull();
  });

  it('falls back to the rule-based result when a provider fails or returns junk (R5.4)', async () => {
    const failing: LlmProvider = { id: 'groq', extractDeadline: async () => Promise.reject(new Error('quota')), phrasePlan: async () => null };
    const junk: LlmProvider = { id: 'gemini', extractDeadline: async () => null, phrasePlan: async () => null };
    for (const p of [failing, junk]) {
      expect(await suggestDeadline(p, PAGE, 'UTC')).toEqual({ suggestion: { date: '2026-12-04', time: '14:00', zone: 'America/Los_Angeles' }, fellBack: true });
    }
  });
});

describe('network providers with a fake fetch (R5.1, R5.3)', () => {
  it('Gemini sends the key only in x-goog-api-key to generativelanguage.googleapis.com', async () => {
    const f = fakeFetch({ candidates: [{ content: { parts: [{ text: '{"title":"Spooky Jam","date":"2026-12-04","time":"14:00","zone":"America/Los_Angeles"}' }] } }] });
    const s = await geminiProvider('test-key-not-real', 'gemini-test', f).extractDeadline(PAGE);
    expect(s).toEqual({ title: 'Spooky Jam', date: '2026-12-04', time: '14:00', zone: 'America/Los_Angeles' });
    const [url, init] = f.mock.calls[0] ?? [];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key-not-real');
    expect(String(init?.body)).not.toContain('test-key-not-real');
    expect(JSON.parse(String(init?.body))).toMatchObject({ generationConfig: { responseMimeType: 'application/json' } });
  });

  it('Groq uses the OpenAI-compatible endpoint with a Bearer key and JSON mode', async () => {
    const f = fakeFetch({ choices: [{ message: { content: '{"date":"2026-12-04"}' } }] });
    expect(await groqProvider('test-key-not-real', 'llama-test', f).extractDeadline(PAGE)).toEqual({ date: '2026-12-04' });
    const [url, init] = f.mock.calls[0] ?? [];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer test-key-not-real');
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'llama-test', response_format: { type: 'json_object' } });
  });

  it('Ollama posts to /api/chat without streaming and needs no key', async () => {
    const f = fakeFetch({ message: { content: 'Line one\nLine two' } });
    expect(await ollamaProvider('http://127.0.0.1:11434/', 'llama3.2', f).phrasePlan({ answers: ['a'], planLines: ['b'] })).toBe('Line one\nLine two');
    const [url, init] = f.mock.calls[0] ?? [];
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(JSON.parse(String(init?.body))).toMatchObject({ stream: false, model: 'llama3.2' });
  });

  it('turns HTTP errors into a fallback', async () => {
    const f = fakeFetch({ error: 'quota' }, 429);
    expect((await suggestDeadline(groqProvider('k', 'm', f), PAGE, 'UTC')).fellBack).toBe(true);
  });

  it('defaults to models listed on each free tier (checked 2026-11-16)', async () => {
    expect(DEFAULT_MODELS).toEqual({ gemini: 'gemini-3.5-flash-lite', groq: 'openai/gpt-oss-20b', ollama: 'llama3.2' });
    const f = fakeFetch({ choices: [{ message: { content: '{}' } }] });
    await createProvider({ provider: 'groq', groqKey: 'test-key-not-real' }, 'UTC', f).extractDeadline(PAGE);
    expect(JSON.parse(String(f.mock.calls[0]?.[1]?.body))).toMatchObject({ model: 'openai/gpt-oss-20b' });
  });

  it('only accepts http(s) Ollama base URLs', () => {
    expect(normalizeOllamaUrl('javascript:alert(1)')).toBe('http://127.0.0.1:11434');
    expect(normalizeOllamaUrl('http://192.168.1.20:11434/x')).toBe('http://192.168.1.20:11434');
  });
});

describe('settings storage (R5.3)', () => {
  it('round-trips through the given storage and defaults to none', () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
    expect(loadLlmSettings(storage)).toEqual({ provider: 'none' });
    saveLlmSettings({ provider: 'groq', groqKey: 'k' }, storage);
    expect(map.has(LLM_STORAGE_KEY)).toBe(true);
    expect(loadLlmSettings(storage)).toEqual({ provider: 'groq', groqKey: 'k' });
    map.set(LLM_STORAGE_KEY, '{"provider":"evil","groqKey":42}');
    expect(loadLlmSettings(storage)).toEqual({ provider: 'none' });
  });
});
