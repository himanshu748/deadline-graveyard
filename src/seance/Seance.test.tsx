// @vitest-environment happy-dom
// Validates: seance R1.1, R1.2, R1.3, R1.4, R2.5, R2.6, R3.1, R3.2 (UI wiring with a memory repository)
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY, HOUR, makeItem } from '../domain/test-items.ts';
import type { LlmProvider } from '../llm/provider.ts';
import { memoryRepository, type Repository } from '../storage/repository.ts';
import { App } from '../ui/App.tsx';
import { SETTING_INTRO_SEEN } from '../ui/intro/demo-seed.ts';
import { deriveViewModel } from '../ui/view-model.ts';
import { addRecord, parseHistory, SETTING_SEANCE_HISTORY } from './history.ts';
import { buildPlan, emptyAnswers, type SeanceRecord } from './plan.ts';
import { Seance } from './Seance.tsx';

const NOW = Date.UTC(2026, 10, 30, 12);
const ghost = makeItem({ id: '00000000-0000-4000-8000-000000000a01', title: 'Jam game', dueAt: NOW + 2 * DAY, createdAt: NOW - 20 * DAY, lastActivityAt: NOW - 8 * DAY });
const soon = makeItem({ id: '00000000-0000-4000-8000-000000000a02', title: 'Grant form', dueAt: NOW + 5 * HOUR, createdAt: NOW - 3 * DAY, lastActivityAt: NOW - HOUR });
const missed = makeItem({ id: '00000000-0000-4000-8000-000000000a03', title: 'Lab report', dueAt: NOW - 2 * DAY, createdAt: NOW - 9 * DAY, lastActivityAt: NOW - 3 * DAY });

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const reducedMotion = () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

async function mount(repo: Repository) {
  // A returning visitor: without the flag an empty graveyard would start the first-visit intro.
  await repo.putSetting(SETTING_INTRO_SEEN, true);
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
      newId={() => `00000000-0000-4000-8000-0000000005${String(n++).padStart(2, '0')}`}
      llmStorage={null}
    />,
    root,
  );
  await flush();
  return root;
}

async function seeded(extra: (repo: Repository) => Promise<void> = async () => {}) {
  const repo = memoryRepository();
  for (const item of [ghost, soon, missed]) await repo.put(item);
  await extra(repo);
  return { repo, root: await mount(repo) };
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

function pick(root: ParentNode, title: string) {
  const label = [...root.querySelectorAll('dialog label')].find((l) => l.textContent?.startsWith(title));
  const input = label ? root.querySelector<HTMLInputElement>(`#${label.getAttribute('for') ?? ''}`) : null;
  if (!input) throw new Error(`No pick ${title}`);
  act(() => {
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function typeNote(root: ParentNode, value: string) {
  const el = root.querySelector<HTMLTextAreaElement>('dialog textarea');
  if (!el) throw new Error('no note field');
  act(() => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const dialogText = (root: ParentNode) => root.querySelector('dialog')?.textContent ?? '';
const pickTitles = (root: ParentNode) => [...root.querySelectorAll('dialog .seance-picks label')].map((l) => l.childNodes[0]?.textContent);

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
});

describe('Séance flow in the App', () => {
  it('asks one question at a time with its items, and moves focus to each question (R1.1)', async () => {
    const { root } = await seeded();
    await press(root, 'Hold a séance');
    expect(root.querySelector('dialog h2')?.textContent).toBe('The Séance');
    expect(root.querySelector('#seance-question')?.textContent).toBe('Which spirits are restless?');
    expect(document.activeElement?.id).toBe('seance-question');
    expect(pickTitles(root)).toEqual(['Grant form', 'Jam game']);
    await press(root, 'Next question');
    expect(root.querySelector('#seance-question')?.textContent).toBe('What did the graves teach you?');
    expect(document.activeElement?.id).toBe('seance-question');
    expect(pickTitles(root)).toEqual(['Lab report']);
    await press(root, 'Back');
    expect(root.querySelector('#seance-question')?.textContent).toBe('Which spirits are restless?');
  });

  it('skips a question as no answer, builds the plan, saves it and buries a ghost after confirmation (R1.2, R1.3, R2.6, R3.1)', async () => {
    const { root, repo } = await seeded();
    await press(root, 'Hold a séance');
    pick(root, 'Jam game');
    typeNote(root, 'The jam game.');
    await press(root, 'Next question');
    pick(root, 'Lab report');
    typeNote(root, 'This lesson is skipped.');
    await press(root, 'Skip this question');
    expect(root.querySelector('#seance-question')?.textContent).toBe('What will you keep alive next week?');
    await press(root, 'Finish and see the plan');

    expect(root.querySelector('#seance-plan')?.textContent).toBe("Next week's plan");
    expect(document.activeElement?.id).toBe('seance-plan');
    expect(dialogText(root)).toContain('Written by the rules on this device; no AI was used.');
    expect([...root.querySelectorAll('dialog .plan-section h4')].map((h) => h.textContent)).toEqual(['Also due this week', 'Let go']);
    expect(dialogText(root)).not.toContain('Lessons from the graves');

    const saved = parseHistory(await repo.getSetting(SETTING_SEANCE_HISTORY));
    expect(saved).toHaveLength(1);
    expect(saved[0]?.at).toBe(NOW);
    expect(saved[0]?.answers.restless).toEqual({ itemIds: [ghost.id], note: 'The jam game.' });
    expect(saved[0]?.answers.lessons).toEqual({ itemIds: [], note: '' });

    await press(root, /^Bury: Jam game/);
    expect(dialogText(root)).toContain('Bury Jam game? It becomes a tombstone, and this cannot be undone.');
    expect(document.activeElement?.textContent).toBe('Yes, bury it');
    expect((await repo.list()).find((i) => i.id === ghost.id)?.resolution).toBeNull();
    await press(root, 'Yes, bury it');
    expect((await repo.list()).find((i) => i.id === ghost.id)?.resolution).toEqual({ kind: 'buried', at: NOW });
    expect(document.activeElement?.textContent).toBe('Buried. Its tombstone stands in the graveyard.');
    expect(root.querySelector('[data-group="buried"] h4')?.textContent).toBe('Jam game');
  });

  it('offers a lesson as an epitaph and engraves it only after confirmation (R2.3, R2.6)', async () => {
    const { root, repo } = await seeded();
    await press(root, 'Hold a séance');
    await press(root, 'Skip this question');
    pick(root, 'Lab report');
    typeNote(root, 'Start a week early.');
    await press(root, 'Next question');
    await press(root, 'Finish and see the plan');
    expect(dialogText(root)).toContain('Lessons from the graves');
    await press(root, /^Engrave epitaph: Lab report/);
    expect(dialogText(root)).toContain('Engrave "Start a week early." on the tombstone of Lab report?');
    await press(root, 'Not now');
    expect(document.activeElement?.textContent).toMatch(/^Engrave epitaph/);
    expect((await repo.list()).find((i) => i.id === missed.id)?.epitaph).toBeUndefined();
    await press(root, /^Engrave epitaph: Lab report/);
    await press(root, 'Yes, engrave it');
    expect((await repo.list()).find((i) => i.id === missed.id)?.epitaph).toBe('Start a week early.');
  });

  it('keeps the Demo label on picks, plan steps, confirmations and button names', async () => {
    const demoGhost = { ...ghost, id: '00000000-0000-4000-8000-000000000a04', title: 'Spooky jam', demo: true };
    const repo = memoryRepository();
    await repo.put(demoGhost);
    const root = await mount(repo);
    await press(root, 'Hold a séance');
    const label = [...root.querySelectorAll('dialog .seance-picks label')].find((l) => l.textContent?.startsWith('Spooky jam'));
    expect(label?.querySelector('.badge-demo')?.textContent).toBe('Demo');
    pick(root, 'Spooky jam');
    await press(root, 'Next question');
    await press(root, 'Next question');
    await press(root, 'Finish and see the plan');
    expect(root.querySelector('dialog .plan-step-title .badge-demo')?.textContent).toBe('Demo');
    await press(root, /^Bury: Spooky jam \(Demo\)$/);
    expect(dialogText(root)).toContain('Bury Spooky jam (Demo)? It becomes a tombstone');
  });

  it('shows past séances newest first (R3.2)', async () => {
    const old = (id: string, at: number): SeanceRecord => ({ id, at, answers: emptyAnswers(), plan: buildPlan([soon], emptyAnswers(), at, { locale: 'en-GB', zone: 'UTC' }) });
    const { root } = await seeded(async (repo) => {
      await repo.putSetting(SETTING_SEANCE_HISTORY, addRecord(addRecord([], old('a', NOW - 16 * DAY)), old('b', NOW - 9 * DAY)));
    });
    await press(root, 'Hold a séance');
    expect(root.querySelector('dialog summary')?.textContent).toBe('Past séances (2)');
    const dates = [...root.querySelectorAll('dialog .seance-history-date')].map((p) => p.textContent);
    expect(dates[0]).toContain('21 Nov');
    expect(dates[1]).toContain('14 Nov');
  });
});

describe('invitation (R1.4)', () => {
  const record = (at: number): SeanceRecord => ({ id: 'r', at, answers: emptyAnswers(), plan: buildPlan([], emptyAnswers(), at) });

  it('returns focus to Hold a séance when the finished séance removed the invitation', async () => {
    const { root } = await seeded();
    await press(root, 'Begin the séance');
    for (let i = 0; i < 3; i++) await press(root, 'Skip this question');
    expect(root.querySelector('[data-testid="seance-invite"]')).toBeNull();
    await press(root, 'Done');
    expect(root.querySelector('dialog')).toBeNull();
    expect(document.activeElement?.textContent).toBe('Hold a séance');
  });

  it('invites to a first séance without blocking anything, and Not now hides it', async () => {
    const { root } = await seeded();
    const invite = root.querySelector('[data-testid="seance-invite"]');
    expect(invite?.textContent).toContain('ready for your first séance');
    expect(invite?.closest('dialog')).toBeNull();
    expect(root.querySelector('dialog')).toBeNull();
    await press(root, 'Not now');
    expect(root.querySelector('[data-testid="seance-invite"]')).toBeNull();
  });

  it('stays away for 7 x 24 h after a séance and comes back after', async () => {
    const recent = await seeded(async (repo) => repo.putSetting(SETTING_SEANCE_HISTORY, [record(NOW - 7 * DAY + 1)]));
    expect(recent.root.querySelector('[data-testid="seance-invite"]')).toBeNull();
    render(null, document.body);
    document.body.innerHTML = '';
    const due = await seeded(async (repo) => repo.putSetting(SETTING_SEANCE_HISTORY, [record(NOW - 7 * DAY)]));
    expect(due.root.querySelector('[data-testid="seance-invite"]')?.textContent).toContain('A week has passed');
  });

  it('is not shown on an empty graveyard', async () => {
    const root = await mount(memoryRepository());
    expect(root.querySelector('[data-testid="seance-invite"]')).toBeNull();
    expect(button(root, 'Hold a séance').disabled).toBe(false);
  });
});

describe('Séance with an optional LLM (R2.5)', () => {
  async function plan(llm: LlmProvider) {
    const root = document.createElement('div');
    document.body.append(root);
    const items = [soon];
    const vm = deriveViewModel(items, NOW, 'UTC', 'en-GB');
    const onFinish = vi.fn(async (answers: ReturnType<typeof emptyAnswers>) => ({
      record: { id: 'x', at: NOW, answers, plan: buildPlan(items, answers, NOW, { locale: 'en-GB', zone: 'UTC' }) },
      error: null,
    }));
    render(
      <Seance
        items={items}
        now={NOW}
        entries={new Map(vm.entries.map((e) => [e.id, e]))}
        userZone="UTC"
        locale="en-GB"
        history={[]}
        mode="reduced"
        llm={llm}
        llmName="Gemini"
        onFinish={onFinish}
        onApply={async () => null}
        onClose={() => {}}
      />,
      root,
    );
    await flush();
    for (let i = 0; i < 3; i++) await press(root, 'Skip this question');
    return root;
  }

  const fake = (reply: string | null): LlmProvider => ({ id: 'gemini', extractDeadline: async () => null, phrasePlan: async () => reply });

  it('shows a rephrasing that keeps every title, and keeps the rule-based steps and buttons', async () => {
    const root = await plan(fake('Finish the Grant form before tomorrow noon.'));
    await press(root, /^Rephrase with Gemini/);
    expect(root.querySelector('.seance-phrased')?.textContent).toContain('Finish the Grant form before tomorrow noon.');
    expect(dialogText(root)).toContain('Rephrased by Gemini. The steps and buttons below still come from the rules.');
    expect(dialogText(root)).toContain('The steps below were written by the rules on this device.');
    expect(dialogText(root)).not.toContain('no AI was used');
    expect(root.querySelector('.plan-step-title')?.textContent).toBe('Work on Grant form');
  });

  it('falls back to the rules with a visible note when the reply drops a title', async () => {
    const root = await plan(fake('Rest well this week.'));
    await press(root, /^Rephrase with Gemini/);
    expect(root.querySelector('.seance-phrased')).toBeNull();
    expect(dialogText(root)).toContain('Gemini did not give a usable answer, so the plan stays written by the rules.');
    expect(dialogText(root)).not.toContain('no AI was used');
  });

  it('offers no rephrase button with provider none', async () => {
    const root = await plan({ id: 'none', extractDeadline: async () => null, phrasePlan: async () => null });
    expect(() => button(root, /^Rephrase/)).toThrow();
  });
});
