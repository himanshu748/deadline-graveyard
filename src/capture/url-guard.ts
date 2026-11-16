// URL and address checks for the page-fetch function (capture-and-export R1.3 to R1.5).
// Pure and dependency-free so the browser, the Vercel function and the tests share it.
// Policy: only http and https on default web ports, no credentials in the URL, and only
// globally routable unicast addresses. Anything we cannot parse is treated as not public.

export type UrlRejection = 'scheme' | 'invalid' | 'credentials' | 'port';

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: UrlRejection };

/** Ports a public event page realistically uses. '' is the scheme default. */
const ALLOWED_PORTS = new Set(['', '80', '443', '8080', '8443']);

export const MAX_URL_LENGTH = 2048;

/** R1.3: syntax and scheme check, before any DNS lookup or request. */
export function checkUrlSyntax(raw: string): UrlCheck {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_URL_LENGTH) return { ok: false, reason: 'invalid' };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, reason: 'scheme' };
  if (url.username !== '' || url.password !== '') return { ok: false, reason: 'credentials' };
  if (!ALLOWED_PORTS.has(url.port)) return { ok: false, reason: 'port' };
  if (url.hostname === '') return { ok: false, reason: 'invalid' };
  return { ok: true, url };
}

/** Host part of a URL without IPv6 brackets. */
export function bareHost(url: URL): string {
  const host = url.hostname;
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

export function parseIPv4(text: string): number[] | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out.push(n);
  }
  return out;
}

/** Eight 16-bit groups, or null. Zone ids (`%eth0`) are rejected. */
export function parseIPv6(text: string): number[] | null {
  if (text.includes('%') || !text.includes(':')) return null;
  let tail: number[] = [];
  let head = text;
  const lastColon = text.lastIndexOf(':');
  const maybeV4 = text.slice(lastColon + 1);
  if (maybeV4.includes('.')) {
    const v4 = parseIPv4(maybeV4);
    if (!v4) return null;
    tail = [((v4[0] ?? 0) << 8) | (v4[1] ?? 0), ((v4[2] ?? 0) << 8) | (v4[3] ?? 0)];
    head = text.slice(0, lastColon + 1);
    if (head.endsWith(':') && !head.endsWith('::')) head = head.slice(0, -1);
  }
  const halves = head.split('::');
  if (halves.length > 2) return null;
  const parse = (s: string): number[] | null => {
    if (s === '') return [];
    const groups = s.split(':');
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };
  const left = parse(halves[0] ?? '');
  const right = halves.length === 2 ? parse(halves[1] ?? '') : [];
  if (!left || !right) return null;
  const known = left.length + right.length + tail.length;
  if (halves.length === 2) {
    if (known > 7) return null;
    return [...left, ...new Array<number>(8 - known).fill(0), ...right, ...tail];
  }
  return known === 8 ? [...left, ...tail] : null;
}

function inV4(ip: number[], base: [number, number, number, number], bits: number): boolean {
  const toInt = (a: number[]) => (((a[0] ?? 0) << 24) >>> 0) + ((a[1] ?? 0) << 16) + ((a[2] ?? 0) << 8) + (a[3] ?? 0);
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return ((toInt(ip) & mask) >>> 0) === ((toInt(base) & mask) >>> 0);
}

/** IANA special-purpose IPv4 blocks (RFC 6890 and updates) plus multicast and reserved. */
const V4_BLOCKED: Array<[[number, number, number, number], number]> = [
  [[0, 0, 0, 0], 8], // "this network"
  [[10, 0, 0, 0], 8], // private
  [[100, 64, 0, 0], 10], // carrier-grade NAT
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link-local, includes cloud metadata 169.254.169.254
  [[172, 16, 0, 0], 12], // private
  [[192, 0, 0, 0], 24], // IETF protocol assignments
  [[192, 0, 2, 0], 24], // documentation
  [[192, 88, 99, 0], 24], // 6to4 relay anycast
  [[192, 168, 0, 0], 16], // private
  [[198, 18, 0, 0], 15], // benchmarking
  [[198, 51, 100, 0], 24], // documentation
  [[203, 0, 113, 0], 24], // documentation
  [[224, 0, 0, 0], 4], // multicast
  [[240, 0, 0, 0], 4], // reserved and broadcast
];

function isPublicV4(ip: number[]): boolean {
  return !V4_BLOCKED.some(([base, bits]) => inV4(ip, base, bits));
}

function embeddedV4(groups: number[], from: number): number[] {
  const hi = groups[from] ?? 0;
  const lo = groups[from + 1] ?? 0;
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

function isPublicV6(g: number[]): boolean {
  const first = g[0] ?? 0;
  const prefixZero = (n: number) => g.slice(0, n).every((x) => x === 0);
  // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d: judge the embedded IPv4.
  if (prefixZero(5) && g[5] === 0xffff) return isPublicV4(embeddedV4(g, 6));
  if (prefixZero(6)) return false; // ::, ::1 and deprecated IPv4-compatible forms
  // NAT64 64:ff9b::/96 and 64:ff9b:1::/48 carry an IPv4 address.
  if (first === 0x64 && g[1] === 0xff9b) return isPublicV4(embeddedV4(g, 6));
  // 6to4 2002::/16 carries an IPv4 address in groups 1 and 2.
  if (first === 0x2002) return isPublicV4(embeddedV4(g, 1));
  // Only global unicast 2000::/3 is public. This drops fc00::/7, fe80::/10, fec0::/10, ff00::/8, 100::/64.
  if ((first & 0xe000) !== 0x2000) return false;
  if (first === 0x2001 && (g[1] ?? 0) < 0x0200) return false; // 2001::/23 IETF protocol assignments, Teredo, ORCHID
  if (first === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (first === 0x3fff && (g[1] ?? 0) < 0x1000) return false; // 3fff::/20 documentation
  return true;
}

/** R1.4: true only for a globally routable unicast IPv4 or IPv6 address literal. */
export function isPublicAddress(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4) return isPublicV4(v4);
  const v6 = parseIPv6(ip);
  if (v6) return isPublicV6(v6);
  return false;
}

/** True when the host is an IP literal rather than a name that needs DNS. */
export function isIpLiteral(host: string): boolean {
  return parseIPv4(host) !== null || parseIPv6(host) !== null;
}
