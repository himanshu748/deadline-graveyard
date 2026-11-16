// Pure HTML metadata extractor (capture-and-export R1.2, R1.6). Reads <title>, Open Graph and
// schema.org JSON-LD Event data with regular expressions and JSON.parse. Nothing is executed and
// no DOM is built, so it runs the same in the Vercel function, the Vite dev proxy and the browser.

export interface Extracted {
  title?: string;
  /** ISO 8601 strings exactly as the page gave them. */
  startDate?: string;
  endDate?: string;
  /** Offset or `Z` carried by the chosen date, for display only. */
  zoneHint?: string;
  /** Where the dates came from, so the UI can say how sure it is. */
  dateSource?: 'json-ld' | 'meta' | 'time-element';
  /** The page URL after redirects. */
  source: string;
}

export const MAX_TITLE_LENGTH = 300;
const MAX_JSON_LD_BLOCKS = 20;
const MAX_JSON_LD_LENGTH = 200_000;

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,8}|#39);/gi, (whole, body: string) => {
    const lower = body.toLowerCase();
    if (lower.startsWith('#x') || (lower.startsWith('#') && lower !== '#39')) {
      const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[lower] ?? whole;
  });
}

function clean(text: string): string {
  const decoded = decodeEntities(text.replace(/<[^>]*>/g, ' '));
  const printable = [...decoded].map((ch) => ((ch.codePointAt(0) ?? 0) < 0x20 || ch === '\u007f' ? ' ' : ch)).join('');
  return printable
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);
}

/** Attributes of one start tag, lower-cased names, entity-decoded values. */
function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const m of tag.matchAll(re)) {
    const name = (m[1] ?? '').toLowerCase();
    if (!(name in out)) out[name] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return out;
}

function metaContent(html: string, keys: string[]): string | undefined {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase();
    if (keys.includes(key) && a.content) return a.content;
  }
  return undefined;
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function isObject(v: Json | undefined): v is { [k: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function typeIncludesEvent(t: Json | undefined): boolean {
  const names = Array.isArray(t) ? t : [t];
  return names.some((n) => typeof n === 'string' && /(^|[/:])(\w*Event|Hackathon)$/.test(n));
}

/** Depth-first search for the first schema.org Event-like node (handles @graph and arrays). */
function findEvent(node: Json | undefined, depth = 0): { [k: string]: Json } | null {
  if (depth > 8 || node === undefined || node === null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findEvent(child, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (!isObject(node)) return null;
  if (typeIncludesEvent(node['@type']) && (typeof node.startDate === 'string' || typeof node.endDate === 'string')) return node;
  for (const key of ['@graph', 'mainEntity', 'subEvent', 'event', 'itemListElement', 'item']) {
    const hit = findEvent(node[key], depth + 1);
    if (hit) return hit;
  }
  return null;
}

function jsonLdBlocks(html: string): Json[] {
  const out: Json[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  for (const m of html.matchAll(re)) {
    if (out.length >= MAX_JSON_LD_BLOCKS) break;
    const type = (attributes(`<x ${m[1] ?? ''}>`).type ?? '').toLowerCase().trim();
    if (type !== 'application/ld+json') continue;
    const body = (m[2] ?? '').trim();
    if (body.length === 0 || body.length > MAX_JSON_LD_LENGTH) continue;
    try {
      out.push(JSON.parse(body) as Json);
    } catch {
      // Broken JSON-LD is common; skip the block.
    }
  }
  return out;
}

const OFFSET_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

function zoneHintOf(value: string | undefined): string | undefined {
  return value === undefined ? undefined : OFFSET_RE.exec(value.trim())?.[1]?.toUpperCase();
}

const ISO_START = /^\d{4}-\d{2}-\d{2}/;

/**
 * R1.2: title from og:title, then <title>, then JSON-LD name; dates from JSON-LD Event
 * startDate/endDate, then event meta tags, then the first <time datetime> elements.
 */
export function extractMeta(html: string, sourceUrl: string): Extracted {
  const out: Extracted = { source: sourceUrl };
  const event = findEvent(jsonLdBlocks(html));

  const og = metaContent(html, ['og:title', 'twitter:title']);
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)?.[1];
  const ldName = event && typeof event.name === 'string' ? event.name : undefined;
  const title = [og, titleTag, ldName].map((t) => (t === undefined ? '' : clean(t))).find((t) => t.length > 0);
  if (title) out.title = title;

  let start: string | undefined;
  let end: string | undefined;
  if (event) {
    if (typeof event.startDate === 'string' && ISO_START.test(event.startDate.trim())) start = event.startDate.trim();
    if (typeof event.endDate === 'string' && ISO_START.test(event.endDate.trim())) end = event.endDate.trim();
    if (start || end) out.dateSource = 'json-ld';
  }
  if (!start && !end) {
    const s = metaContent(html, ['event:start_time', 'startdate', 'event:start_date']);
    const e = metaContent(html, ['event:end_time', 'enddate', 'event:end_date']);
    if (s && ISO_START.test(s.trim())) start = s.trim();
    if (e && ISO_START.test(e.trim())) end = e.trim();
    if (start || end) out.dateSource = 'meta';
  }
  if (!start && !end) {
    const times = [...html.matchAll(/<time\b[^>]*>/gi)]
      .map((m) => attributes(m[0]).datetime?.trim())
      .filter((v): v is string => v !== undefined && ISO_START.test(v));
    // Two times usually mean a start and an end (or a deadline); one means a single date.
    if (times.length > 0) {
      start = times[0];
      if (times.length > 1) end = times[times.length - 1];
      out.dateSource = 'time-element';
    }
  }
  if (start) out.startDate = start;
  if (end) out.endDate = end;
  const hint = zoneHintOf(end ?? start);
  if (hint) out.zoneHint = hint;
  return out;
}

/** Readable text of an HTML page or snippet, for the date finder. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}
