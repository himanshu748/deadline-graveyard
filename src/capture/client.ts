// Browser side of "add from URL" (capture-and-export R1.1, R1.7). Calls /api/fetch-meta and treats
// the reply as untrusted input: every field is type-checked and length-capped before use.
import { parseIsoLike, type DateCandidate } from './dates.ts';
import { MAX_TITLE_LENGTH, type Extracted } from './extract.ts';
import { checkUrlSyntax } from './url-guard.ts';

export type CaptureError = 'invalid-url' | 'blocked-address' | 'timeout' | 'too-many-redirects' | 'not-html' | 'http-error' | 'network' | 'unavailable';

export type CaptureResult = { ok: true; value: Extracted } | { ok: false; error: CaptureError };

export const CAPTURE_MESSAGES: Record<CaptureError, string> = {
  'invalid-url': 'That does not look like an http or https link.',
  'blocked-address': 'That link points at a private or local address, so it was not fetched.',
  timeout: 'The page took longer than 5 seconds to answer.',
  'too-many-redirects': 'The page redirected more than 3 times.',
  'not-html': 'The link is not a web page (for example a PDF).',
  'http-error': 'The page answered with an error. Some sites refuse automated readers.',
  network: 'The page could not be reached.',
  unavailable: 'Page fetching is not available here (it needs the hosted app or npm run dev).',
};

const KNOWN = new Set<string>(Object.keys(CAPTURE_MESSAGES));

function str(v: unknown, max: number): string | undefined {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined;
}

/** Parses the function's JSON reply into an Extracted value, dropping anything unexpected. */
export function parseCaptureReply(data: unknown, fallbackSource: string): CaptureResult {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { ok: false, error: 'unavailable' };
  const o = data as Record<string, unknown>;
  if (typeof o.error === 'string') return { ok: false, error: KNOWN.has(o.error) ? (o.error as CaptureError) : 'network' };
  const out: Extracted = { source: str(o.source, 2048) ?? fallbackSource };
  const title = str(o.title, MAX_TITLE_LENGTH);
  const startDate = str(o.startDate, 64);
  const endDate = str(o.endDate, 64);
  const zoneHint = str(o.zoneHint, 8);
  if (title) out.title = title;
  if (startDate) out.startDate = startDate;
  if (endDate) out.endDate = endDate;
  if (zoneHint) out.zoneHint = zoneHint;
  if (o.dateSource === 'json-ld' || o.dateSource === 'meta' || o.dateSource === 'time-element') out.dateSource = o.dateSource;
  return { ok: true, value: out };
}

/** R1.1: GET /api/fetch-meta for a URL that already passed the syntax check (R1.3). */
export async function fetchPageMeta(rawUrl: string, fetchImpl: typeof fetch = fetch, base = `${import.meta.env.BASE_URL}api/fetch-meta`): Promise<CaptureResult> {
  const checked = checkUrlSyntax(rawUrl);
  if (!checked.ok) return { ok: false, error: 'invalid-url' };
  let response: Response;
  try {
    response = await fetchImpl(`${base}?url=${encodeURIComponent(checked.url.toString())}`, { headers: { accept: 'application/json' } });
  } catch {
    return { ok: false, error: 'network' };
  }
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return { ok: false, error: 'unavailable' };
  try {
    return parseCaptureReply(await response.json(), checked.url.toString());
  } catch {
    return { ok: false, error: 'unavailable' };
  }
}

/**
 * The date to prefill: the end date when there is one (for a hackathon or course that is the
 * deadline), else the start date. Returns every parseable date so the user can switch.
 */
export function datesFromMeta(meta: Extracted, userZone: string): DateCandidate[] {
  const out: DateCandidate[] = [];
  for (const value of [meta.endDate, meta.startDate]) {
    if (value === undefined) continue;
    const c = parseIsoLike(value, userZone);
    if (c && !out.some((o) => o.date === c.date && o.time === c.time && o.zone === c.zone)) out.push(c);
  }
  return out;
}
