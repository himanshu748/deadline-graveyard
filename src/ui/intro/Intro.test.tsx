// @vitest-environment happy-dom
// Validates: first-visit R1.1 to R1.6, R2.1, R2.2, R2.4 to R2.6, R3.1 to R3.3 (UI wiring with a
// memory repository), and the step clock seam behind R1.2 and R1.4.
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY, DUE, makeItem } from '../../domain/test-items.ts';
import { startStepClock, type StepClock } from '../../scene/motion.ts';
import { memoryRepository, type Repository } from '../../storage/repository.ts';
import { App } from '../App.tsx';
import { DEMO_IDS, demoItems, SETTING_INTRO_SEEN } from './demo-seed.ts';
import { Intro, type IntroProps } from './Intro.tsx';
import { STEP_SECONDS } from './steps.ts';

const NOW = DUE - 30 * DAY;
const mine = makeItem({ id: '00000000-0000-4000-8000-000000000401', title: 'My own essay', dueAt: NOW + 3 * DAY, createdAt: NOW - DAY, lastActivityAt: NOW });

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

// Static scene, as in App.test.tsx: happy-dom has no SVG transform lists.
const reducedMotion = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

async function mount(repo: Repository = memoryRepository()) {
  const root = document.createElement('div');
  document.body.append(root);
  let n = 0;
  render(
    <App
      open={async () => ({ repo, persistent: true })}
      clock={() => NOW}
      userZone="UTC"
      locale="en-GB"
      matchMedia={reducedMotion}
      newId={() => `00000000-0000-4000-8000-0000000006${String(n++).padStart(2, '0')}`}
      llmStorage={null}
    />,
    root,
  );
  await flush();
  return { root, repo };
}

function button(root: ParentNode, name: string | RegExp): HTMLButtonElement {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => (typeof name === 'string' ? b.textContent?.trim() === name : name.test(b.textContent ?? '')));
  if (!found) throw new Error(`No button ${String(name)}`);
  return found;
}

/** Presses a button inside the open dialog, or on the page when no dialog is open. */
async function press(root: ParentNode, name: string | RegExp) {
  await act(async () => button(root.querySelector('dialog') ?? root, name).click());
  await flush();
}

const dialogText = (root: ParentNode) => root.querySelector('dialog')?.textContent ?? '';
const kicker = (root: ParentNode) => root.querySelector('dialog .intro-kicker')?.textContent;
const ids = async (repo: Repository) => (await repo.list()).map((i) => i.id).sort();

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('start conditions (R1.1, R2.1, R2.6)', () => {
  it('starts on a fresh visit and saves exactly 3 demo items, shown with Demo badges', async () => {
    const { root, repo } = await mount();
    expect(kicker(root)).toBe('First visit, step 1 of 5');
    expect(root.querySelector('dialog h2')?.textContent).toBe('Welcome to the graveyard');
    const saved = await repo.list();
    expect(saved).toHaveLength(3);
    expect(saved.every((i) => i.demo && i.title.startsWith('Demo:'))).toBe(true);
    const sceneSlots = [...root.querySelectorAll('.scene-slot')];
    expect(root.querySelectorAll('.scene-item')).toHaveLength(3);
    expect(sceneSlots.every((el) => el.querySelector('.scene-item-text')?.textContent?.includes('Demo'))).toBe(true);
    expect(root.querySelectorAll('.list-view .badge-demo')).toHaveLength(3);
    expect(root.querySelector('[data-testid="intro-spotlight"]')).not.toBeNull();
    // Neither banner competes with the intro.
    expect(root.querySelector('[data-testid="seance-invite"]')).toBeNull();
    expect(root.querySelector('[data-testid="demo-note"]')).toBeNull();
    expect(await repo.getSetting(SETTING_INTRO_SEEN)).toBeUndefined();
  });

  it('does not start or seed when the user already has items', async () => {
    const repo = memoryRepository();
    await repo.put(mine);
    const { root } = await mount(repo);
    expect(root.querySelector('dialog')).toBeNull();
    expect(await ids(repo)).toEqual([mine.id]);
  });

  it('does not start again once the intro was seen, even with an empty graveyard', async () => {
    const repo = memoryRepository();
    await repo.putSetting(SETTING_INTRO_SEEN, true);
    const { root } = await mount(repo);
    expect(root.querySelector('dialog')).toBeNull();
    expect(await repo.list()).toEqual([]);
    expect(root.querySelector('svg.scene')?.getAttribute('aria-label')).toMatch(/empty/);
  });
});

describe('skip (R1.3, R1.5)', () => {
  it('Skip intro ends the tour, saves the flag, keeps the demo and focuses the first scene item', async () => {
    const { root, repo } = await mount();
    await press(root, 'Skip intro');
    expect(root.querySelector('dialog')).toBeNull();
    expect(await repo.getSetting(SETTING_INTRO_SEEN)).toBe(true);
    expect(await repo.list()).toHaveLength(3);
    const focused = document.activeElement;
    expect(focused?.classList.contains('scene-item')).toBe(true);
    // The first item in due order is the missed one (C).
    expect(focused?.getAttribute('data-id')).toBe(DEMO_IDS.c);
    expect(root.querySelector('[data-testid="intro-spotlight"]')).toBeNull();
    expect(root.querySelector('[data-testid="demo-note"]')?.textContent).toContain('3 demo deadlines are in the graveyard');
  });

  it('Escape skips at any step', async () => {
    const { root, repo } = await mount();
    await press(root, 'Next');
    expect(kicker(root)).toBe('First visit, step 2 of 5');
    await act(async () => {
      root.querySelector('dialog')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    await flush();
    expect(root.querySelector('dialog')).toBeNull();
    expect(await repo.getSetting(SETTING_INTRO_SEEN)).toBe(true);
    expect(document.activeElement?.getAttribute('data-id')).toBe(DEMO_IDS.c);
  });
});

describe('the tour (R1.2, R2.4, R3.1 to R3.3)', () => {
  it('walks 5 captioned steps with Next and then asks whether to keep the demo', async () => {
    const { root, repo } = await mount();
    const titles: string[] = [];
    for (let step = 1; step <= 5; step++) {
      expect(kicker(root)).toBe(`First visit, step ${step} of 5`);
      titles.push(root.querySelector('dialog h2')?.textContent ?? '');
      await press(root, step === 5 ? 'Finish the tour' : 'Next');
    }
    expect(titles).toEqual(['Welcome to the graveyard', 'Due within 24 hours', 'Missed deadlines become graves', 'Neglected projects haunt you', 'Submitted work lights a lantern']);
    expect(root.querySelector('dialog h2')?.textContent).toBe('Keep the demo?');
    expect(dialogText(root)).toContain('Keep the 3 demo deadlines');
    expect(document.activeElement?.textContent).toBe('Keep the demo');
    await press(root, 'Keep the demo');
    expect(root.querySelector('dialog')).toBeNull();
    expect(await repo.list()).toHaveLength(3);
    expect(await repo.getSetting(SETTING_INTRO_SEEN)).toBe(true);
    expect(document.activeElement?.getAttribute('data-id')).toBe(DEMO_IDS.c);
  });

  it('revives the ghost and then lights its lantern when the user accepts both invitations', async () => {
    const { root, repo } = await mount();
    for (let i = 0; i < 3; i++) await press(root, 'Next');
    expect(root.querySelector('dialog h2')?.textContent).toBe('Neglected projects haunt you');
    expect(root.querySelector(`.scene-item[data-id="${DEMO_IDS.a}"]`)?.getAttribute('data-kind')).toBe('ghost');
    await press(root, 'Revive the ghost');
    expect(dialogText(root)).toContain('Revived. Its candle burns on the ground again.');
    expect(root.querySelector(`.scene-item[data-id="${DEMO_IDS.a}"]`)?.getAttribute('data-kind')).toBe('candle');
    expect((await repo.list()).find((i) => i.id === DEMO_IDS.a)?.lastActivityAt).toBe(NOW);
    // The answered invitation is gone and focus moved to Next instead of the page body.
    expect(() => button(root.querySelector('dialog') ?? root, 'Revive the ghost')).toThrow();
    expect(document.activeElement?.textContent).toBe('Next');

    await press(root, 'Next');
    await press(root, 'Light the lantern');
    expect(dialogText(root)).toContain('Submitted. Its lantern now hangs lit on the fence.');
    expect(root.querySelector(`.scene-item[data-id="${DEMO_IDS.a}"]`)?.getAttribute('data-kind')).toBe('lantern');
    expect((await repo.list()).find((i) => i.id === DEMO_IDS.a)?.resolution).toEqual({ kind: 'submitted', at: NOW });
    // All five states were on screen: ghost, candle (A), due-soon candle (B), tombstone (C), lantern (A).
    expect(root.querySelector(`.scene-item[data-id="${DEMO_IDS.b}"]`)?.getAttribute('data-status')).toBe('due-soon');
    expect(root.querySelector(`.scene-item[data-id="${DEMO_IDS.c}"]`)?.getAttribute('data-kind')).toBe('tombstone');
  });

  it('declining an invitation continues the tour and leaves demo item A unchanged (R3.3)', async () => {
    const { root, repo } = await mount();
    const before = (await repo.list()).find((i) => i.id === DEMO_IDS.a);
    for (let i = 0; i < 3; i++) await press(root, 'Next');
    await press(root, 'Not now');
    expect(root.querySelector('dialog h2')?.textContent).toBe('Submitted work lights a lantern');
    expect(document.activeElement?.textContent).toBe('Finish the tour');
    await press(root, 'Not now');
    expect(root.querySelector('dialog h2')?.textContent).toBe('Keep the demo?');
    expect((await repo.list()).find((i) => i.id === DEMO_IDS.a)).toEqual(before);
    expect(root.querySelector(`.scene-item[data-id="${DEMO_IDS.a}"]`)?.getAttribute('data-kind')).toBe('ghost');
  });

  it('Clear demo at the end empties the graveyard and moves focus to Add deadline (R2.4, R2.5)', async () => {
    const { root, repo } = await mount();
    for (let i = 0; i < 5; i++) await press(root, /^(Next|Finish the tour)$/);
    await press(root, 'Clear demo');
    expect(root.querySelector('dialog')).toBeNull();
    expect(await repo.list()).toEqual([]);
    expect(await repo.getSetting(SETTING_INTRO_SEEN)).toBe(true);
    expect(document.activeElement?.textContent?.trim()).toBe('Add deadline');
    expect(root.querySelector('[data-testid="demo-note"]')).toBeNull();
  });
});

describe('the menu: Clear demo and Replay the intro (R1.6, R2.5, R2.6)', () => {
  async function returning(withDemo: boolean) {
    const repo = memoryRepository();
    await repo.putSetting(SETTING_INTRO_SEEN, true);
    await repo.put(mine);
    if (withDemo) for (const item of demoItems(NOW - 2 * DAY, 'UTC')) await repo.put(item);
    return mount(repo);
  }

  it('Clear demo deletes every demo item and nothing else', async () => {
    const { root, repo } = await returning(true);
    expect(root.querySelector('[data-testid="demo-note"]')).not.toBeNull();
    await press(root, 'Export and settings');
    expect(dialogText(root)).toContain('3 demo deadlines are in the graveyard, each labelled Demo.');
    await press(root, 'Clear demo');
    expect(await ids(repo)).toEqual([mine.id]);
    expect(dialogText(root)).toContain('Cleared 3 demo deadlines. Your own deadlines were not touched.');
    expect(button(root.querySelector('dialog') ?? root, 'Clear demo').disabled).toBe(true);
    expect(document.activeElement?.textContent?.trim()).toBe('Replay the intro');
  });

  it('the Clear demo button in the demo note does the same', async () => {
    const { root, repo } = await returning(true);
    await press(root, 'Clear demo');
    expect(await ids(repo)).toEqual([mine.id]);
    expect(root.querySelector('[data-testid="demo-note"]')).toBeNull();
    expect(document.activeElement?.textContent?.trim()).toBe('Add deadline');
  });

  it('asks before replaying next to stored items, and Not now changes nothing', async () => {
    const { root, repo } = await returning(false);
    await press(root, 'Export and settings');
    await press(root, 'Replay the intro');
    expect(dialogText(root)).toContain('Replay the intro? It adds 3 demo deadlines, labelled Demo, next to yours.');
    expect(document.activeElement?.textContent).toBe('Replay with demo deadlines');
    await press(root, 'Not now');
    expect(await ids(repo)).toEqual([mine.id]);
    expect(root.querySelector('dialog h2')?.textContent).toBe('Export and settings');
  });

  it('replays after the confirmation with fresh demo items that replace old ones, never doubling them', async () => {
    const { root, repo } = await returning(true);
    const oldA = (await repo.list()).find((i) => i.id === DEMO_IDS.a);
    await press(root, 'Export and settings');
    await press(root, 'Replay the intro');
    expect(dialogText(root)).toContain('replaces the demo deadlines already here');
    await press(root, 'Replay with demo deadlines');
    expect(kicker(root)).toBe('First visit, step 1 of 5');
    const all = await repo.list();
    expect(all).toHaveLength(4);
    expect(all.filter((i) => i.demo)).toEqual(demoItems(NOW, 'UTC').sort((a, b) => (a.id < b.id ? -1 : 1)));
    expect(all.find((i) => i.id === DEMO_IDS.a)).not.toEqual(oldA);
    // Clearing at the end of the replay keeps the user's own item.
    for (let i = 0; i < 5; i++) await press(root, /^(Next|Finish the tour)$/);
    await press(root, 'Clear demo');
    expect(await ids(repo)).toEqual([mine.id]);
  });
});

describe('Intro step clock (R1.2, R1.4)', () => {
  function fakeClock() {
    const calls: Array<{ seconds: number; done: () => void; clock: StepClock & { paused: boolean; stopped: boolean } }> = [];
    const start = vi.fn((_mode: 'full' | 'reduced', seconds: number, done: () => void) => {
      const clock = {
        paused: false,
        stopped: false,
        pause() {
          this.paused = true;
        },
        resume() {
          this.paused = false;
        },
        stop() {
          this.stopped = true;
        },
      };
      calls.push({ seconds, done, clock });
      return clock;
    });
    return { start, calls };
  }

  function mountIntro(props: Partial<IntroProps>) {
    const root = document.createElement('div');
    document.body.append(root);
    const onNext = vi.fn();
    const full: IntroProps = {
      step: 'moonrise',
      mode: 'full',
      ghostStatus: 'ghost',
      demoCount: 3,
      onNext,
      onSkip: vi.fn(),
      onRevive: vi.fn(async () => null),
      onSubmit: vi.fn(async () => null),
      onFinish: vi.fn(),
      ...props,
    };
    act(() => render(<Intro {...full} />, root));
    return { root, onNext, rerender: (next: Partial<IntroProps>) => act(() => render(<Intro {...full} {...next} />, root)) };
  }

  it('full motion: each step runs its own timer, which calls Next when it ends', () => {
    const { start, calls } = fakeClock();
    const { root, onNext, rerender } = mountIntro({ startClock: start });
    expect(calls.map((c) => c.seconds)).toEqual([STEP_SECONDS.moonrise]);
    expect(root.querySelector('.intro-progress')).not.toBeNull();
    act(() => calls[0]?.done());
    expect(onNext).toHaveBeenCalledTimes(1);
    rerender({ step: 'flicker', startClock: start });
    expect(calls[0]?.clock.stopped).toBe(true);
    expect(calls.map((c) => c.seconds)).toEqual([STEP_SECONDS.moonrise, STEP_SECONDS.flicker]);
  });

  it('full motion: Pause holds the step and stays paused on the next step until Resume', () => {
    const { start, calls } = fakeClock();
    const { root, rerender } = mountIntro({ startClock: start });
    act(() => button(root, 'Pause the tour').click());
    expect(calls[0]?.clock.paused).toBe(true);
    rerender({ step: 'flicker', startClock: start });
    expect(calls[1]?.clock.paused).toBe(true);
    act(() => button(root, 'Resume the tour').click());
    expect(calls[1]?.clock.paused).toBe(false);
  });

  it('reduced motion: no timer exists, no progress bar, and the panel says steps wait for Next', () => {
    const start = vi.fn(startStepClock);
    const { root, onNext } = mountIntro({ mode: 'reduced', startClock: start });
    expect(start).toHaveBeenCalledWith('reduced', STEP_SECONDS.moonrise, expect.any(Function), null);
    expect(start.mock.results[0]?.value).toBeNull();
    expect(root.querySelector('.intro-progress')).toBeNull();
    expect(() => button(root, 'Pause the tour')).toThrow();
    expect(root.textContent).toContain('Motion is reduced, so each step waits for Next.');
    expect(onNext).not.toHaveBeenCalled();
    act(() => button(root, 'Next').click());
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('offers no invitation when demo item A is gone, but keeps the caption', () => {
    const { root } = mountIntro({ step: 'ghost', ghostStatus: null, mode: 'reduced' });
    expect(root.querySelector('dialog h2')?.textContent).toBe('Neglected projects haunt you');
    expect(() => button(root, 'Revive the ghost')).toThrow();
  });
});


describe('durable demo clearing', () => {
  it('keeps demo visible until every deletion commits, then survives a new mount', async () => {
    const repo = memoryRepository();
    const { root } = await mount(repo);
    await press(root, 'Skip intro');
    const remove = repo.remove.bind(repo);
    let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    repo.remove = async (id) => { await pending; await remove(id); };
    await press(root, 'Clear demo');
    expect(root.querySelectorAll('.scene-item')).toHaveLength(3);
    expect(await repo.list()).toHaveLength(3);
    await act(async () => { release(); });
    await flush();
    expect(root.querySelectorAll('.scene-item')).toHaveLength(0);
    expect(await repo.list()).toHaveLength(0);
    render(null, root);
    const reloaded = await mount(repo);
    expect(reloaded.root.querySelectorAll('.scene-item')).toHaveLength(0);
  });
});
