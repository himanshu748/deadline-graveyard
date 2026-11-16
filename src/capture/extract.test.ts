// Validates: capture-and-export R1.2, R1.6. Fixtures are hand-written for this repo, not copied pages.
import { describe, expect, it } from 'vitest';
import { decodeEntities, extractMeta, htmlToText } from './extract.ts';

const SRC = 'https://events.example.org/spooky-jam';

const TITLE_ONLY = `<!doctype html><html><head>
  <meta charset="utf-8">
  <title>  Spooky Jam &amp; Friends  </title>
</head><body><p>No dates here.</p></body></html>`;

const OPEN_GRAPH = `<html><head>
  <title>Site name | Events</title>
  <meta property="og:title" content="Lantern Hack 2026 &#8211; Online">
  <meta property="event:start_time" content="2026-11-01T09:00:00-07:00">
  <meta property="event:end_time" content="2026-11-03T17:00:00-08:00">
</head></html>`;

const JSON_LD_EVENT = `<html><head>
  <title>Moonlit Makeathon</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "name": "Demo Org" },
      { "@type": "Event", "name": "Moonlit Makeathon", "startDate": "2026-12-01T10:00:00+05:30", "endDate": "2026-12-04T14:00:00-08:00" }
    ]
  }
  </script>
  <script>window.startDate = "2030-01-01"; document.title = "hijacked";</script>
</head></html>`;

const HACKATHON_TYPE = `<script type='application/ld+json'>[{"@type":["Thing","Hackathon"],"name":"Crypt Code","startDate":"2026-10-31"}]</script>`;

const TIME_ELEMENTS = `<html><head><title>Course: Haunted Data</title></head><body>
  <p>Opens <time datetime="2026-09-01">1 Sep</time>, closes <time datetime="2026-09-30T23:59Z">30 Sep</time>.</p>
</body></html>`;

const BROKEN_JSON_LD = `<title>Broken</title><script type="application/ld+json">{ not json </script>`;

describe('extractMeta (R1.2)', () => {
  it('reads a <title> and decodes entities when nothing else is present', () => {
    expect(extractMeta(TITLE_ONLY, SRC)).toEqual({ source: SRC, title: 'Spooky Jam & Friends' });
  });

  it('prefers og:title and reads event meta times', () => {
    const r = extractMeta(OPEN_GRAPH, SRC);
    expect(r.title).toBe('Lantern Hack 2026 \u2013 Online');
    expect(r.startDate).toBe('2026-11-01T09:00:00-07:00');
    expect(r.endDate).toBe('2026-11-03T17:00:00-08:00');
    expect(r.dateSource).toBe('meta');
    expect(r.zoneHint).toBe('-08:00');
  });

  it('finds a schema.org Event inside @graph and ignores ordinary scripts', () => {
    const r = extractMeta(JSON_LD_EVENT, SRC);
    expect(r).toMatchObject({
      title: 'Moonlit Makeathon',
      startDate: '2026-12-01T10:00:00+05:30',
      endDate: '2026-12-04T14:00:00-08:00',
      dateSource: 'json-ld',
      zoneHint: '-08:00',
    });
  });

  it('accepts Event subtypes such as Hackathon given as an array of types', () => {
    const r = extractMeta(HACKATHON_TYPE, SRC);
    expect(r.title).toBe('Crypt Code');
    expect(r.startDate).toBe('2026-10-31');
    expect(r.endDate).toBeUndefined();
  });

  it('falls back to <time datetime> elements', () => {
    const r = extractMeta(TIME_ELEMENTS, SRC);
    expect(r).toMatchObject({ title: 'Course: Haunted Data', startDate: '2026-09-01', endDate: '2026-09-30T23:59Z', dateSource: 'time-element', zoneHint: 'Z' });
  });

  it('returns only the source for a page with no title and no date', () => {
    expect(extractMeta('<html><body>hello</body></html>', SRC)).toEqual({ source: SRC });
  });

  it('survives broken JSON-LD', () => {
    expect(extractMeta(BROKEN_JSON_LD, SRC)).toEqual({ source: SRC, title: 'Broken' });
  });

  it('caps very long titles and strips tags and control characters (R1.6)', () => {
    const r = extractMeta(`<title>${'Boo '.repeat(200)}<b>x</b>\u0007</title>`, SRC);
    expect(r.title?.length).toBeLessThanOrEqual(300);
    expect(r.title).not.toMatch(/[<>]/);
    expect(r.title?.includes('\u0007')).toBe(false);
  });
});

describe('decodeEntities and htmlToText', () => {
  it('decodes named and numeric entities and leaves unknown ones', () => {
    expect(decodeEntities('&lt;a&gt; &#39;x&#39; &#x1F383; &bogus; &#0;')).toBe("<a> 'x' \u{1F383} &bogus; &#0;");
  });

  it('drops scripts and styles and keeps readable text', () => {
    expect(htmlToText('<style>p{}</style><p>Deadline: <b>4 Dec 2026</b></p><script>x()</script>')).toBe('Deadline: 4 Dec 2026');
  });
});
