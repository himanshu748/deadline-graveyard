// Server side of "add from URL" (capture-and-export R1.1, R1.3 to R1.6). Node only: used by the
// Vercel function api/fetch-meta.ts and by the Vite dev middleware in vite.config.ts, never by
// the browser bundle.
//
// SSRF defences, in order, for the first URL and for every redirect hop:
// 1. checkUrlSyntax: http or https, default web ports, no credentials.
// 2. Resolve the host once and refuse if ANY address is not public (isPublicAddress).
// 3. Connect with a custom `lookup` that returns only those checked addresses, so a second DNS
//    answer (DNS rebinding) cannot point the socket somewhere else.
// 4. One 5 s budget for the whole chain, at most 3 redirects, at most 1 MB of body read,
//    text/html only, and only the extracted fields go back to the caller.
import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import { extractMeta, type Extracted } from './extract.ts';
import { bareHost, checkUrlSyntax, isIpLiteral, isPublicAddress } from './url-guard.ts';

export const FETCH_LIMITS = { timeoutMs: 5_000, maxBytes: 1_000_000, maxRedirects: 3 } as const;

export type FetchMetaError = 'invalid-url' | 'blocked-address' | 'timeout' | 'too-many-redirects' | 'not-html' | 'http-error' | 'network';

export type FetchMetaResult = { ok: true; value: Extracted } | { ok: false; error: FetchMetaError };

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface PageResponse {
  status: number;
  location?: string;
  contentType?: string;
  body: AsyncIterable<Uint8Array>;
  /** Stops reading and frees the socket. */
  close(): void;
}

export interface FetchDeps {
  resolve(host: string): Promise<ResolvedAddress[]>;
  /** Performs one GET without following redirects, connecting only through `lookup`. */
  get(url: URL, options: { lookup: LookupFunction; signal: AbortSignal }): Promise<PageResponse>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

class Stop extends Error {
  constructor(readonly code: FetchMetaError) {
    super(code);
  }
}

/** A `net` lookup function that only ever answers with pre-checked addresses. */
export function pinnedLookup(addresses: ResolvedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const family = typeof options === 'object' && options !== null ? options.family : undefined;
    const wanted = family === 4 || family === 6 ? addresses.filter((a) => a.family === family) : addresses;
    if (wanted.length === 0) {
      const error = Object.assign(new Error('no checked address'), { code: 'ENOTFOUND' });
      callback(error, '', 0);
      return;
    }
    if (typeof options === 'object' && options !== null && options.all === true) {
      (callback as unknown as (err: null, list: ResolvedAddress[]) => void)(null, wanted);
      return;
    }
    const first = wanted[0] as ResolvedAddress;
    callback(null, first.address, first.family);
  };
}

async function checkedAddresses(url: URL, deps: FetchDeps): Promise<ResolvedAddress[]> {
  const host = bareHost(url);
  if (isIpLiteral(host)) {
    if (!isPublicAddress(host)) throw new Stop('blocked-address');
    return [{ address: host, family: host.includes(':') ? 6 : 4 }];
  }
  let addresses: ResolvedAddress[];
  try {
    addresses = await deps.resolve(host);
  } catch {
    throw new Stop('network');
  }
  if (addresses.length === 0) throw new Stop('network');
  if (addresses.some((a) => !isPublicAddress(a.address))) throw new Stop('blocked-address');
  return addresses;
}

async function readCapped(body: AsyncIterable<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of body) {
    const room = maxBytes - total;
    chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
    total += Math.min(chunk.length, room);
    // Pages bigger than the cap are cut, not refused: the title and JSON-LD live in <head>.
    if (total >= maxBytes) break;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function isHtml(contentType: string | undefined): boolean {
  if (contentType === undefined) return false;
  const type = contentType.split(';')[0]?.trim().toLowerCase();
  return type === 'text/html' || type === 'application/xhtml+xml';
}

/** Fetches a public page and returns only its extracted metadata. Never throws. */
export async function fetchMeta(rawUrl: string, deps: FetchDeps): Promise<FetchMetaResult> {
  const timeoutMs = deps.timeoutMs ?? FETCH_LIMITS.timeoutMs;
  const maxBytes = deps.maxBytes ?? FETCH_LIMITS.maxBytes;
  const maxRedirects = deps.maxRedirects ?? FETCH_LIMITS.maxRedirects;
  const signal = AbortSignal.timeout(timeoutMs);
  const deadline = new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(new Stop('timeout')), { once: true });
  });
  deadline.catch(() => {});

  const run = async (): Promise<Extracted> => {
    let current = rawUrl;
    for (let hop = 0; ; hop++) {
      const checked = checkUrlSyntax(current);
      if (!checked.ok) throw new Stop(hop === 0 ? 'invalid-url' : 'blocked-address');
      const url = checked.url;
      const addresses = await checkedAddresses(url, deps);
      let response: PageResponse;
      try {
        response = await deps.get(url, { lookup: pinnedLookup(addresses), signal });
      } catch (error) {
        throw error instanceof Stop ? error : new Stop(signal.aborted ? 'timeout' : 'network');
      }
      if (response.status >= 300 && response.status < 400 && response.location !== undefined) {
        response.close();
        if (hop >= maxRedirects) throw new Stop('too-many-redirects');
        try {
          current = new URL(response.location, url).toString();
        } catch {
          throw new Stop('network');
        }
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        response.close();
        throw new Stop('http-error');
      }
      if (!isHtml(response.contentType)) {
        response.close();
        throw new Stop('not-html');
      }
      let bytes: Uint8Array;
      try {
        bytes = await readCapped(response.body, maxBytes);
      } finally {
        response.close();
      }
      const html = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return extractMeta(html, url.toString());
    }
  };

  const work = run();
  work.catch(() => {}); // the deadline may win the race; the loser must not reject unhandled
  try {
    return { ok: true, value: await Promise.race([work, deadline]) };
  } catch (error) {
    if (error instanceof Stop) return { ok: false, error: error.code };
    return { ok: false, error: signal.aborted ? 'timeout' : 'network' };
  }
}

const USER_AGENT = 'DeadlineGraveyard/0.1 (reads page title and date for one user request)';

/** Real DNS and HTTP(S) for production and the dev server. */
export const nodeDeps: FetchDeps = {
  async resolve(host) {
    const found = await dnsLookup(host, { all: true, verbatim: true });
    return found.map((a) => ({ address: a.address, family: a.family === 6 ? 6 : 4 }));
  },
  get(url, { lookup, signal }) {
    return new Promise<PageResponse>((resolve, reject) => {
      const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
      const req = send(
        url,
        {
          method: 'GET',
          lookup,
          signal,
          headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml;q=0.9', 'accept-encoding': 'identity' },
        },
        (res: IncomingMessage) => {
          const location = res.headers.location;
          const contentType = res.headers['content-type'];
          const page: PageResponse = {
            status: res.statusCode ?? 0,
            body: res,
            close: () => {
              res.destroy();
              req.destroy();
            },
          };
          if (typeof location === 'string') page.location = location;
          if (typeof contentType === 'string') page.contentType = contentType;
          resolve(page);
        },
      );
      req.on('error', reject);
      req.end();
    });
  },
};

const STATUS: Record<FetchMetaError, number> = {
  'invalid-url': 400,
  'blocked-address': 403,
  'not-html': 415,
  'too-many-redirects': 502,
  'http-error': 502,
  network: 502,
  timeout: 504,
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
}

/** GET /api/fetch-meta?url=... as a Web standard handler (Vercel `fetch` export and dev proxy). */
export async function handleFetchMeta(request: Request, deps: FetchDeps = nodeDeps): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'method-not-allowed' }, 405);
  const target = new URL(request.url).searchParams.get('url');
  if (target === null) return json({ error: 'invalid-url' }, 400);
  const result = await fetchMeta(target, deps);
  return result.ok ? json(result.value, 200) : json({ error: result.error }, STATUS[result.error]);
}
