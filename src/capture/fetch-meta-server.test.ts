// Validates: capture-and-export R1.1, R1.3, R1.4, R1.5, R1.6 with mocked DNS and HTTP (no network).
import { describe, expect, it, vi } from 'vitest';
import { fetchMeta, handleFetchMeta, pinnedLookup, type FetchDeps, type PageResponse, type ResolvedAddress } from './fetch-meta-server.ts';

const PUBLIC: ResolvedAddress[] = [{ address: '93.184.215.14', family: 4 }];
const PAGE = '<html><head><title>Demo Jam</title><script type="application/ld+json">{"@type":"Event","name":"Demo Jam","endDate":"2026-12-04T14:00:00-08:00"}</script></head></html>';

function body(text: string, chunk = 64): AsyncIterable<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  return {
    async *[Symbol.asyncIterator]() {
      for (let i = 0; i < bytes.length; i += chunk) yield bytes.subarray(i, i + chunk);
    },
  };
}

function page(overrides: Partial<PageResponse> = {}): PageResponse {
  return { status: 200, contentType: 'text/html; charset=utf-8', body: body(PAGE), close: vi.fn(), ...overrides };
}

function deps(map: Record<string, ResolvedAddress[]>, pages: Record<string, PageResponse | (() => Promise<PageResponse>)>, extra: Partial<FetchDeps> = {}): FetchDeps & { requested: string[] } {
  const requested: string[] = [];
  return {
    requested,
    resolve: vi.fn(async (host: string) => {
      const found = map[host];
      if (!found) throw new Error('ENOTFOUND');
      return found;
    }),
    get: vi.fn(async (url: URL) => {
      requested.push(url.toString());
      const p = pages[url.toString()];
      if (!p) throw new Error('ECONNREFUSED');
      return typeof p === 'function' ? p() : p;
    }),
    ...extra,
  };
}

describe('fetchMeta', () => {
  it('returns only the extracted fields for a public HTML page (R1.6)', async () => {
    const d = deps({ 'jam.example': PUBLIC }, { 'https://jam.example/': page() });
    const r = await fetchMeta('https://jam.example/', d);
    expect(r).toEqual({
      ok: true,
      value: { source: 'https://jam.example/', title: 'Demo Jam', endDate: '2026-12-04T14:00:00-08:00', dateSource: 'json-ld', zoneHint: '-08:00' },
    });
  });

  it('rejects non-http schemes before any lookup (R1.3)', async () => {
    const d = deps({}, {});
    for (const raw of ['file:///etc/passwd', 'ftp://jam.example/', 'javascript:alert(1)']) {
      expect(await fetchMeta(raw, d)).toEqual({ ok: false, error: 'invalid-url' });
    }
    expect(d.resolve).not.toHaveBeenCalled();
    expect(d.get).not.toHaveBeenCalled();
  });

  it.each(['http://127.0.0.1/', 'http://10.1.2.3/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'http://[fc00::1]/', 'http://[::ffff:127.0.0.1]/'])(
    'blocks the IP literal %s without a request (R1.4)',
    async (raw) => {
      const d = deps({}, {});
      expect(await fetchMeta(raw, d)).toEqual({ ok: false, error: 'blocked-address' });
      expect(d.get).not.toHaveBeenCalled();
    },
  );

  it('blocks a name that resolves to any private address, even alongside a public one (R1.4)', async () => {
    const d = deps({ 'sneaky.example': [...PUBLIC, { address: '10.0.0.5', family: 4 }], 'meta.example': [{ address: 'fd00::1', family: 6 }] }, {});
    expect(await fetchMeta('https://sneaky.example/', d)).toEqual({ ok: false, error: 'blocked-address' });
    expect(await fetchMeta('https://meta.example/', d)).toEqual({ ok: false, error: 'blocked-address' });
    expect(d.get).not.toHaveBeenCalled();
  });

  it('re-checks every redirect target and blocks a redirect to a private address (R1.5)', async () => {
    const first = page({ status: 302, location: 'http://169.254.169.254/latest/meta-data/' });
    const d = deps({ 'jam.example': PUBLIC }, { 'https://jam.example/': first });
    expect(await fetchMeta('https://jam.example/', d)).toEqual({ ok: false, error: 'blocked-address' });
    expect(d.requested).toEqual(['https://jam.example/']);
    expect(first.close).toHaveBeenCalled();
  });

  it('blocks a redirect to a non-http scheme (R1.5)', async () => {
    const d = deps({ 'jam.example': PUBLIC }, { 'https://jam.example/': page({ status: 301, location: 'file:///etc/passwd' }) });
    expect(await fetchMeta('https://jam.example/', d)).toEqual({ ok: false, error: 'blocked-address' });
  });

  it('follows up to 3 relative redirects and refuses the 4th (R1.5)', async () => {
    const pages: Record<string, PageResponse> = {
      'https://jam.example/a': page({ status: 301, location: '/b' }),
      'https://jam.example/b': page({ status: 302, location: '/c' }),
      'https://jam.example/c': page({ status: 307, location: '/d' }),
      'https://jam.example/d': page(),
    };
    const ok = await fetchMeta('https://jam.example/a', deps({ 'jam.example': PUBLIC }, pages));
    expect(ok.ok && ok.value.source).toBe('https://jam.example/d');

    const loop = deps({ 'jam.example': PUBLIC }, {
      'https://jam.example/a': page({ status: 301, location: '/b' }),
      'https://jam.example/b': page({ status: 301, location: '/c' }),
      'https://jam.example/c': page({ status: 301, location: '/d' }),
      'https://jam.example/d': page({ status: 301, location: '/e' }),
    });
    expect(await fetchMeta('https://jam.example/a', loop)).toEqual({ ok: false, error: 'too-many-redirects' });
    expect(loop.requested).toHaveLength(4);
  });

  it('reads at most maxBytes of the body (R1.5)', async () => {
    let yielded = 0;
    const endless: AsyncIterable<Uint8Array> = {
      async *[Symbol.asyncIterator]() {
        const head = new TextEncoder().encode('<title>Huge page</title>');
        yielded += head.length;
        yield head;
        for (;;) {
          yielded += 1024;
          yield new Uint8Array(1024).fill(32);
        }
      },
    };
    const r = await fetchMeta('https://jam.example/', deps({ 'jam.example': PUBLIC }, { 'https://jam.example/': page({ body: endless }) }, { maxBytes: 10_000 }));
    expect(r.ok && r.value.title).toBe('Huge page');
    expect(yielded).toBeLessThan(12_000);
  });

  it('times out slow servers (R1.5)', async () => {
    const never = () => new Promise<PageResponse>(() => {});
    const r = await fetchMeta('https://jam.example/', deps({ 'jam.example': PUBLIC }, { 'https://jam.example/': never }, { timeoutMs: 30 }));
    expect(r).toEqual({ ok: false, error: 'timeout' });
  });

  it('refuses non-HTML responses and HTTP errors', async () => {
    const d = deps({ 'jam.example': PUBLIC }, {
      'https://jam.example/pdf': page({ contentType: 'application/pdf' }),
      'https://jam.example/missing': page({ status: 404 }),
    });
    expect(await fetchMeta('https://jam.example/pdf', d)).toEqual({ ok: false, error: 'not-html' });
    expect(await fetchMeta('https://jam.example/missing', d)).toEqual({ ok: false, error: 'http-error' });
  });

  it('reports DNS failures as network errors', async () => {
    expect(await fetchMeta('https://nowhere.example/', deps({}, {}))).toEqual({ ok: false, error: 'network' });
  });
});

describe('pinnedLookup (DNS rebinding defence)', () => {
  const addresses: ResolvedAddress[] = [
    { address: '93.184.215.14', family: 4 },
    { address: '2606:2800:21f:cb07:6820:80da:af6b:8b2c', family: 6 },
  ];

  it('answers single lookups with the first checked address of the wanted family', () => {
    const cb = vi.fn();
    pinnedLookup(addresses)('jam.example', { family: 6 }, cb);
    expect(cb).toHaveBeenCalledWith(null, '2606:2800:21f:cb07:6820:80da:af6b:8b2c', 6);
  });

  it('answers all: true lookups with the full checked list', () => {
    const cb = vi.fn();
    pinnedLookup(addresses)('jam.example', { all: true }, cb);
    expect(cb).toHaveBeenCalledWith(null, addresses);
  });

  it('fails instead of falling back to a fresh DNS answer', () => {
    const cb = vi.fn();
    pinnedLookup([addresses[0] as ResolvedAddress])('jam.example', { family: 6 }, cb);
    expect(cb.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});

describe('handleFetchMeta', () => {
  it('serves JSON with no-store and maps errors to status codes (R1.1)', async () => {
    const d = deps({ 'jam.example': PUBLIC }, { 'https://jam.example/': page() });
    const ok = await handleFetchMeta(new Request('https://app.example/api/fetch-meta?url=https%3A%2F%2Fjam.example%2F'), d);
    expect(ok.status).toBe(200);
    expect(ok.headers.get('cache-control')).toBe('no-store');
    expect(await ok.json()).toMatchObject({ title: 'Demo Jam' });

    const blocked = await handleFetchMeta(new Request('https://app.example/api/fetch-meta?url=http%3A%2F%2F127.0.0.1%2F'), d);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: 'blocked-address' });

    expect((await handleFetchMeta(new Request('https://app.example/api/fetch-meta'), d)).status).toBe(400);
    expect((await handleFetchMeta(new Request('https://app.example/api/fetch-meta?url=x', { method: 'POST' }), d)).status).toBe(405);
  });
});
