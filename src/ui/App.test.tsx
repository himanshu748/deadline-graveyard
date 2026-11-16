// @vitest-environment happy-dom
// Validates: accessible-list-view R1.5, R1.6, R2.4; graveyard-scene R3.2, R4.1, R4.2; deadline-engine R5.1 (UI wiring).
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY, DUE, HOUR, makeItem } from '../domain/test-items.ts';
import type { Sound } from '../scene/sound.ts';
import { memoryRepository, type Repository } from '../storage/repository.ts';
import { App, SETTING_MOTION, SETTING_VIEW } from './App.tsx';
import { SETTING_INTRO_SEEN } from './intro/demo-seed.ts';

const NOW = DUE - 3 * DAY;

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

function fakeSound(): Sound & { enableCalls: number } {
  let on = false;
  return {
    enableCalls: 0,
    get enabled() {
      return on;
    },
    async enable() {
      this.enableCalls++;
      on = true;
    },
    disable() {
      on = false;
    },
    chime() {},
  };
}

// happy-dom has no SVG transform lists, so these tests run the static (reduced) scene; motion has its own tests.
const reducedMotion = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

async function mount(repo: Repository = memoryRepository()) {
  // These tests cover a returning visitor, so the "intro seen" flag is set. The first-visit intro
  // and its demo items are tested in intro/Intro.test.tsx.
  await repo.putSetting(SETTING_INTRO_SEEN, true);
  const root = document.createElement('div');
  document.body.append(root);
  const sounds: Array<ReturnType<typeof fakeSound>> = [];
  const makeSound = vi.fn(() => {
    const s = fakeSound();
    sounds.push(s);
    return s;
  });
  let n = 0;
  render(
    <App
      open={async () => ({ repo, persistent: true })}
      clock={() => NOW}
      userZone="UTC"
      locale="en-GB"
      makeSound={makeSound}
      matchMedia={reducedMotion}
      newId={() => `00000000-0000-4000-8000-00000000010${n++}`}
    />,
    root,
  );
  await flush();
  return { root, repo, makeSound, sounds };
}

function button(root: ParentNode, name: string | RegExp): HTMLButtonElement {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    typeof name === 'string' ? b.textContent?.trim() === name : name.test(b.textContent ?? ''),
  );
  if (!found) throw new Error(`No button ${String(name)}`);
  return found;
}

function type(el: HTMLInputElement | null, value: string) {
  if (!el) throw new Error('missing input');
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
});

describe('App', () => {
  it('renders the heading, an empty scene and the list view', async () => {
    const { root } = await mount();
    expect(root.querySelector('h1')?.textContent).toBe('Deadline Graveyard');
    expect(root.querySelector('svg.scene')?.getAttribute('aria-label')).toMatch(/empty/);
    expect(root.querySelector('#list-heading')?.textContent).toBe('Every grave, in words');
  });

  it('renders stored items in both views from the same state', async () => {
    const repo = memoryRepository();
    await repo.put(makeItem({ title: 'Grant form', dueAt: NOW + 2 * HOUR, createdAt: NOW - DAY, lastActivityAt: NOW }));
    const { root } = await mount(repo);
    expect(root.querySelector('.scene-item')?.getAttribute('aria-label')).toMatch(/^Grant form, due soon, due /);
    expect(root.querySelector('[data-group="due-soon"] h4')?.textContent).toBe('Grant form');
  });

  it('adds a deadline from the form and saves it (deadline-engine R5.1)', async () => {
    const { root, repo } = await mount();
    act(() => button(root, 'Add deadline').click());
    const dialog = root.querySelector('dialog');
    expect(dialog).not.toBeNull();
    type(root.querySelector('#f-title'), 'Kiroween submission');
    type(root.querySelector('#f-date'), '2026-12-04');
    type(root.querySelector('#f-time'), '14:00');
    const zone = root.querySelector<HTMLSelectElement>('#f-zone');
    act(() => {
      if (!zone) return;
      zone.value = 'America/Los_Angeles';
      zone.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      root.querySelector('dialog form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await flush();
    expect(root.querySelector('dialog')).toBeNull();
    const saved = await repo.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ title: 'Kiroween submission', dueAt: DUE, zone: 'America/Los_Angeles', demo: false, resolution: null });
    expect(root.querySelector('.scene-item')?.getAttribute('aria-label')).toMatch(/^Kiroween submission, active, due /);
  });

  it('shows a validation error instead of saving a nameless deadline', async () => {
    const { root, repo } = await mount();
    act(() => button(root, 'Add deadline').click());
    await act(async () => {
      root.querySelector('dialog form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(root.querySelector('[role="alert"]')?.textContent).toBe('Give the deadline a name.');
    expect(await repo.list()).toHaveLength(0);
  });

  it('closes a dialog with Escape and returns focus to the opener (R2.4)', async () => {
    const { root } = await mount();
    const add = button(root, 'Add deadline');
    add.focus();
    act(() => add.click());
    const dialog = root.querySelector('dialog');
    act(() => {
      dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    await flush();
    expect(root.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(add);
  });

  it('marks an item submitted from the list and keeps it in storage', async () => {
    const repo = memoryRepository();
    await repo.put(makeItem({ title: 'Essay', dueAt: NOW + 2 * DAY, createdAt: NOW - DAY, lastActivityAt: NOW }));
    const { root } = await mount(repo);
    await act(async () => button(root, /^Mark submitted/).click());
    await flush();
    expect((await repo.list())[0]?.resolution).toEqual({ kind: 'submitted', at: NOW });
    expect(root.querySelector('.scene-item')?.getAttribute('data-kind')).toBe('lantern');
  });

  it('moves focus to the list heading from the skip link (R1.5)', async () => {
    const { root } = await mount();
    act(() => root.querySelector<HTMLAnchorElement>('.skip-link')?.click());
    expect(document.activeElement?.id).toBe('list-heading');
  });

  it('switches to the list only view and saves the choice (R1.6)', async () => {
    const { root, repo } = await mount();
    await act(async () => button(root, 'List only').click());
    expect(root.querySelector('svg.scene')).toBeNull();
    expect(await repo.getSetting(SETTING_VIEW)).toBe('list');
  });

  it('starts from prefers-reduced-motion, then applies and saves the toggle (graveyard-scene R3.1, R3.2)', async () => {
    const { root, repo } = await mount();
    const toggle = button(root, 'Reduce motion');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    await act(async () => toggle.click());
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(root.querySelector('svg.scene')?.getAttribute('data-motion')).toBe('full');
    expect(await repo.getSetting(SETTING_MOTION)).toBe('full');
    await act(async () => toggle.click());
    expect(root.querySelector('svg.scene')?.getAttribute('data-motion')).toBe('reduced');
    expect(await repo.getSetting(SETTING_MOTION)).toBe('reduced');
  });

  it('starts with sound off and creates audio only when the user turns it on (R4.1, R4.2)', async () => {
    vi.stubGlobal('AudioContext', class {});
    const { root, makeSound, sounds } = await mount();
    const toggle = button(root, 'Sound');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(makeSound).not.toHaveBeenCalled();
    await act(async () => toggle.click());
    expect(makeSound).toHaveBeenCalledTimes(1);
    expect(sounds[0]?.enableCalls).toBe(1);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    vi.unstubAllGlobals();
  });
});
