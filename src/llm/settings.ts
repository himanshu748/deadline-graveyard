// LLM settings live in localStorage, not in IndexedDB, so API keys never end up in a JSON backup
// or an .ics export (capture-and-export R5.3). Nothing here logs a key.
import type { ProviderId } from './provider.ts';
import type { ProviderSettings } from './providers.ts';

export const LLM_STORAGE_KEY = 'deadline-graveyard:llm';
const IDS: ProviderId[] = ['none', 'gemini', 'groq', 'ollama'];
const FIELDS = ['geminiKey', 'geminiModel', 'groqKey', 'groqModel', 'ollamaUrl', 'ollamaModel'] as const;

export function loadLlmSettings(storage: Pick<Storage, 'getItem'> | null = safeStorage()): ProviderSettings {
  try {
    const raw = storage?.getItem(LLM_STORAGE_KEY);
    if (!raw) return { provider: 'none' };
    const o = JSON.parse(raw) as Record<string, unknown>;
    const provider = IDS.includes(o.provider as ProviderId) ? (o.provider as ProviderId) : 'none';
    const out: ProviderSettings = { provider };
    for (const f of FIELDS) {
      const v = o[f];
      if (typeof v === 'string' && v.length > 0 && v.length <= 500) out[f] = v;
    }
    return out;
  } catch {
    return { provider: 'none' };
  }
}

export function saveLlmSettings(settings: ProviderSettings, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(LLM_STORAGE_KEY, JSON.stringify(settings));
    return storage !== null;
  } catch {
    return false;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
