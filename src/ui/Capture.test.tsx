// @vitest-environment happy-dom
// Validates: capture-and-export R1.1, R1.7, R1.8, R1.9, R2.1, R3.1, R4.1, R4.2, R5.2, R5.3 (UI wiring)
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CaptureResult } from '../capture/client.ts';
import { DUE, DAY, makeItem } from '../domain/test-items.ts';
import type { Notifier, PermissionState } from '../notifications/notify.ts';
import { memoryRepository, type Repository } from '../storage/repository.ts';
import { App, SETTING_REMINDERS } from './App.tsx';

const NOW = DUE - 3 * DAY;

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const reducedMotion = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

function fakeNotifier(answer: PermissionState = 'granted'): Notifier & { shown: string[]; requests: number } {
  let state: PermissionState = 'default';
  return {
    shown: [],
    requests: 0,
    permission: () => state,
    async request() {
      this.requests++;
      state = answer;
      return state;
    },
    async show(title) {
      this.shown.push(title);
    },
  };
}

function memoryStorage() {
  const map = new Map<string, string>();
  return { map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
}

async function mount(opts: { repo?: Repository; fetchMeta?: (url: string) => Promise<CaptureResult>; notifier?: Notifier; clock?: () => number } = {}) {
  const repo = opts.repo ?? memoryRepository();
  const root = document.createElement('div');
  document.body.append(root);
  const fetchMeta = vi.fn(opts.fetchMeta ?? (async (): Promise<CaptureResult> => ({ ok: false, error: 'network' })));
  const notifier = opts.notifier ?? fakeNotifier();
  const storage = memoryStorage();
  render(
    <App
      open={async () => ({ repo, persistent: true })}
      clock={opts.clock ?? (() => NOW)}
      userZone="UTC"
      locale="en-GB"
      matchMedia={reducedMotion}
      newId={() => '00000000-0000-4000-8000-000000000201'}
      fetchMeta={fetchMeta}
      notifier={notifier}
      llmStorage={storage}
    />,
    root,
  );
  await flush();
  return { root, repo, fetchMeta, notifier, storage };
}

function button(root: ParentNode, name: string | RegExp): HTMLButtonElement {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => (typeof name === 'string' ? b.textContent?.trim() === name : name.test(b.textContent ?? '')));
  if (!found) throw new Error(`No button ${String(name)}`);
  return found;
}

function type(el: HTMLInputElement | HTMLTextAreaElement | null, value: string) {
  if (!el) throw new Error('missing input');
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const input = (root: ParentNode, sel: string) => root.querySelector<HTMLInputElement>(sel);

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('add from URL', () => {
  it('prefills name, date, time and zone from the page and saves only after the user confirms (R1.1, R1.2)', async () => {
    const { root, repo, fetchMeta } = await mount({
      fetchMeta: async (url) => ({ ok: true, value: { source: url, title: 'Spooky Jam', endDate: '2026-12-04T14:00:00-08:00', startDate: '2026-12-01T09:00:00-08:00', dateSource: 'json-ld' } }),
    });
    act(() => button(root, 'Add deadline').click());
    type(input(root, '#f-url'), 'https://jam.example/');
    await act(async () => button(root, 'Fill in from the link').click());
    await flush();
    expect(fetchMeta).toHaveBeenCalledWith('https://jam.example/');
    expect(input(root, '#f-title')?.value).toBe('Spooky Jam');
    expect(input(root, '#f-date')?.value).toBe('2026-12-04');
    expect(input(root, '#f-time')?.value).toBe('22:00');
    expect(root.querySelector<HTMLSelectElement>('#f-zone')?.value).toBe('UTC');
    expect(root.querySelector('.capture-status')?.textContent).toMatch(/Check every field/);
    expect(button(root, /^Use 2026-12-01 17:00/)).toBeTruthy();
    expect(await repo.list()).toHaveLength(0);

    type(input(root, '#f-title'), 'Spooky Jam (edited)');
    await act(async () => {
      root.querySelector('dialog form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();
    const [saved] = await repo.list();
    expect(saved).toMatchObject({ title: 'Spooky Jam (edited)', dueAt: DUE, url: 'https://jam.example/', zone: 'UTC' });
  });

  it('says when the date came only from a <time> element on the page (R1.2, R1.7)', async () => {
    const { root } = await mount({
      fetchMeta: async (url) => ({ ok: true, value: { source: url, title: 'Example Domains', startDate: '2026-09-27', dateSource: 'time-element' } }),
    });
    act(() => button(root, 'Add deadline').click());
    type(input(root, '#f-url'), 'https://page.example/');
    await act(async () => button(root, 'Fill in from the link').click());
    await flush();
    expect(input(root, '#f-date')?.value).toBe('2026-09-27');
    expect(root.querySelector('.capture-status')?.textContent).toMatch(/may be when it was published rather than the deadline\. Check every field/);
  });

  it('keeps the URL and offers paste text and manual entry when the fetch fails (R1.7, R1.8, R1.9)', async () => {
    const { root } = await mount({ fetchMeta: async () => ({ ok: false, error: 'blocked-address' }) });
    act(() => button(root, 'Add deadline').click());
    type(input(root, '#f-url'), 'http://10.0.0.1/');
    await act(async () => button(root, 'Fill in from the link').click());
    await flush();
    expect(root.querySelector('.capture-status')?.textContent).toMatch(/private or local address.*link is kept/);
    expect(input(root, '#f-url')?.value).toBe('http://10.0.0.1/');
    const paste = root.querySelector<HTMLTextAreaElement>('#f-paste');
    expect(paste).not.toBeNull();
    type(paste, 'Applications close 30 Sep 2026 and results on 15 October 2026 at 9:00 AM ET.');
    act(() => button(root, 'Find dates in the text').click());
    expect(input(root, '#f-date')?.value).toBe('2026-09-30');
    expect(root.querySelector<HTMLInputElement>('#f-date-only')?.checked).toBe(true);
    act(() => button(root, /^Use 2026-10-15 09:00, America\/New_York/).click());
    expect(input(root, '#f-time')?.value).toBe('09:00');
    expect(root.querySelector<HTMLSelectElement>('#f-zone')?.value).toBe('America/New_York');
  });

  it('shows no AI button while the provider is none (R5.2)', async () => {
    const { root } = await mount();
    act(() => button(root, 'Add deadline').click());
    act(() => button(root, 'Paste page text instead').click());
    expect([...root.querySelectorAll('button')].some((b) => /^Ask /.test(b.textContent ?? ''))).toBe(false);
  });

  it('hides the capture helpers when editing', async () => {
    const repo = memoryRepository();
    await repo.put(makeItem({ title: 'Essay' }));
    const { root } = await mount({ repo });
    act(() => button(root, /^Edit deadline/).click());
    await flush();
    expect(root.querySelector('#form-title-edit')).not.toBeNull();
    expect(root.querySelector('.capture')).toBeNull();
  });
});

describe('export and settings', () => {
  it('exports unresolved deadlines as .ics and downloads a backup (R2.1, R4.1)', async () => {
    const repo = memoryRepository();
    await repo.put(makeItem({ id: 'a', title: 'Open one' }));
    await repo.put(makeItem({ id: 'b', title: 'Done one', resolution: { kind: 'submitted', at: NOW - DAY } }));
    const blobs: Blob[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blobs.push(b as Blob);
      return 'blob:test';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { root } = await mount({ repo });
    act(() => button(root, 'Export and settings').click());
    expect(root.querySelector('#tools-title')?.textContent).toBe('Export and settings');
    await act(async () => button(root, 'Export to calendar (.ics)').click());
    await act(async () => button(root, 'Download backup').click());
    await flush();
    expect(blobs).toHaveLength(2);
    const ics = await (blobs[0] as Blob).text();
    expect(ics).toContain('SUMMARY:Open one');
    expect(ics).not.toContain('Done one');
    expect(JSON.parse(await (blobs[1] as Blob).text())).toMatchObject({ format: 'deadline-graveyard-backup', items: [{ id: 'a' }, { id: 'b' }] });
  });

  it('asks before restoring and reports validation errors without changing data (R4.2)', async () => {
    const repo = memoryRepository();
    await repo.put(makeItem({ title: 'Keep me' }));
    const { root } = await mount({ repo });
    act(() => button(root, 'Export and settings').click());
    const file = root.querySelector<HTMLInputElement>('input[type="file"]');
    if (!file) throw new Error('no file input');
    const pick = async (text: string) => {
      Object.defineProperty(file, 'files', { configurable: true, value: [new File([text], 'backup.json', { type: 'application/json' })] });
      await act(async () => {
        file.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await flush();
    };

    await pick('{"format":"nope"}');
    expect(root.querySelector('.confirm')?.textContent).toMatch(/Replace everything in this browser with backup.json/);
    expect(await repo.list()).toHaveLength(1);
    await act(async () => button(root, 'Replace my graveyard').click());
    await flush();
    expect(root.textContent).toMatch(/Nothing was changed\. That file is not a valid backup: format/);
    expect((await repo.list())[0]?.title).toBe('Keep me');

    const other = memoryRepository();
    await other.put(makeItem({ id: 'z', title: 'Restored item' }));
    await pick(JSON.stringify(await other.exportBackup(NOW)));
    await act(async () => button(root, 'Keep what I have').click());
    expect((await repo.list())[0]?.title).toBe('Keep me');
    await pick(JSON.stringify(await other.exportBackup(NOW)));
    await act(async () => button(root, 'Replace my graveyard').click());
    await flush();
    expect(root.textContent).toMatch(/Restored 1 deadline from the backup/);
    expect((await repo.list()).map((i) => i.title)).toEqual(['Restored item']);
    expect(root.querySelector('[data-group] h4')?.textContent).toBe('Restored item');
  });

  it('requests notification permission only when reminders are turned on, then notifies (R3.1, R3.2)', async () => {
    const repo = memoryRepository();
    await repo.put(makeItem({ title: 'Essay', dueAt: NOW + 30 * 60_000 }));
    const notifier = fakeNotifier('granted');
    const { root } = await mount({ repo, notifier });
    expect(notifier.requests).toBe(0);
    act(() => button(root, 'Export and settings').click());
    const toggle = button(root, 'Browser reminders');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(root.textContent).toMatch(/only fire while this app is open in a tab/);
    await act(async () => toggle.click());
    await flush();
    expect(notifier.requests).toBe(1);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(await repo.getSetting(SETTING_REMINDERS)).toBe('on');
    expect(notifier.shown).toEqual(['Essay: less than 1 hour left']);
  });

  it('explains a denied permission and leaves reminders off (R3.4)', async () => {
    const notifier = fakeNotifier('denied');
    const { root } = await mount({ notifier });
    act(() => button(root, 'Export and settings').click());
    await act(async () => button(root, 'Browser reminders').click());
    await flush();
    expect(button(root, 'Browser reminders').getAttribute('aria-checked')).toBe('false');
    expect(root.textContent).toMatch(/Notifications are blocked for this site/);
  });

  it('stores AI settings in the given browser storage only, never in the repository backup (R5.3)', async () => {
    const { root, repo, storage } = await mount();
    act(() => button(root, 'Export and settings').click());
    const select = root.querySelector<HTMLSelectElement>('#llm-provider');
    act(() => {
      if (!select) return;
      select.value = 'groq';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    type(input(root, '#llm-key'), 'test-key-not-real');
    await act(async () => {
      root.querySelector('#llm-key')?.closest('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect([...storage.map.values()].join()).toContain('test-key-not-real');
    expect(JSON.stringify(await repo.exportBackup(NOW))).not.toContain('test-key-not-real');
    act(() => button(root, 'Done').click());
    await flush();
    act(() => button(root, 'Add deadline').click());
    act(() => button(root, 'Paste page text instead').click());
    expect(button(root, 'Ask Groq (sends this text to Groq)')).toBeTruthy();
  });
});
