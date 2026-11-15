// @vitest-environment happy-dom
// Validates: graveyard-scene R1.1, R1.4, R2.1, R2.4 to R2.7, R3.4; accessible-list-view R2.1 to R2.3, R3.1.
import { gsap } from 'gsap';
import { render } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY, DUE, HOUR, makeItem } from '../domain/test-items.ts';
import { deriveViewModel } from '../ui/view-model.ts';
import { waxHeight } from './Candle.tsx';
import { layoutScene } from './layout.ts';
import type { MotionMode } from './motion.ts';
import { Scene } from './Scene.tsx';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const now = DUE - 3 * DAY;
const items = [
  makeItem({ id: id(1), title: 'Active', dueAt: now + 5 * DAY, createdAt: now - 5 * DAY, lastActivityAt: now }),
  makeItem({ id: id(2), title: 'Due soon', dueAt: now + 2 * HOUR, createdAt: now - 2 * DAY, lastActivityAt: now, demo: true }),
  makeItem({ id: id(3), title: 'Missed', dueAt: now - HOUR }),
  makeItem({ id: id(4), title: 'Submitted', dueAt: now + DAY, resolution: { kind: 'submitted', at: now - HOUR } }),
  makeItem({ id: id(5), title: 'Ghost', dueAt: now + 20 * DAY, createdAt: now - 30 * DAY, lastActivityAt: now - 10 * DAY }),
];

function mount(mode: MotionMode = 'reduced', onOpen = vi.fn()) {
  const root = document.createElement('div');
  document.body.append(root);
  const vm = deriveViewModel(items, now, 'UTC', 'en');
  act(() => {
    render(<Scene layout={layoutScene(items, now)} entries={new Map(vm.entries.map((e) => [e.id, e]))} mode={mode} onOpen={onOpen} />, root);
  });
  return { root, vm, onOpen };
}

const sceneItems = (root: HTMLElement) => [...root.querySelectorAll<SVGGElement>('.scene-item')];

afterEach(() => {
  render(null, document.body);
  document.body.innerHTML = '';
  gsap.globalTimeline.clear();
});

describe('Scene rendering', () => {
  it('draws every layer and marks decorative ones aria-hidden (R1.1, R1.4)', () => {
    const { root } = mount();
    const layers = [...root.querySelectorAll('[data-layer]')].map((l) => l.getAttribute('data-layer'));
    expect(layers).toEqual(['sky', 'moon', 'far-hills', 'mid-hills-fence', 'ground', 'fog', 'items', 'grass']);
    for (const layer of root.querySelectorAll('[data-layer]')) {
      if (layer.getAttribute('data-layer') !== 'items') expect(layer.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('draws each status as its element (R2.1, R2.4 to R2.6)', () => {
    const { root } = mount();
    const kinds = Object.fromEntries(sceneItems(root).map((g) => [g.getAttribute('data-status'), g.getAttribute('data-kind')]));
    expect(kinds).toEqual({ active: 'candle', 'due-soon': 'candle', missed: 'tombstone', submitted: 'lantern', ghost: 'ghost' });
    expect(root.querySelector('[data-status="missed"]')?.textContent).toMatch(/No epitaph\s*yet/);
  });

  it('draws wax height from the remaining fraction and a fast flame when due soon', () => {
    const { root } = mount();
    const node = layoutScene(items, now).nodes.find((n) => n.id === id(1));
    const wax = root.querySelector(`[data-id="${id(1)}"] .wax`);
    expect(Number(wax?.getAttribute('height'))).toBe(waxHeight(node?.wax ?? 0));
    expect(root.querySelector(`[data-id="${id(2)}"] [data-flame]`)?.getAttribute('data-flame')).toBe('fast');
    expect(root.querySelector(`[data-id="${id(1)}"] [data-flame]`)?.getAttribute('data-flame')).toBe('slow');
  });

  it('shows a Demo badge on demo items only (R2.7)', () => {
    const { root } = mount();
    expect(root.querySelector(`[data-id="${id(2)}"]`)?.textContent).toContain('Demo');
    expect(root.querySelector(`[data-id="${id(1)}"]`)?.textContent).not.toContain('Demo');
  });

  it('starts no GSAP tween in reduced mode (R3.4)', () => {
    mount('reduced');
    expect(gsap.globalTimeline.getChildren(true, true, true)).toHaveLength(0);
  });

  it('starts ambient loops in full mode', () => {
    mount('full');
    expect(gsap.globalTimeline.getChildren(true, true, false).length).toBeGreaterThan(0);
  });
});

describe('Scene keyboard (accessible-list-view R2)', () => {
  it('is one Tab stop: only the first item in due order has tabindex 0 (R2.1)', () => {
    const { root, vm } = mount();
    const tabbable = sceneItems(root).filter((g) => g.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]?.getAttribute('data-id')).toBe(vm.entries[0]?.id);
  });

  it('names each item like the list view (R3.1)', () => {
    const { root, vm } = mount();
    for (const entry of vm.entries) {
      expect(root.querySelector(`[data-id="${entry.id}"]`)?.getAttribute('aria-label')).toBe(entry.accessibleName);
    }
  });

  it('moves focus in due order with the arrow keys, Home and End (R2.2)', () => {
    const { root, vm } = mount();
    const order = vm.entries.map((e) => e.id);
    const first = root.querySelector<SVGGElement>(`[data-id="${order[0]}"]`);
    first?.focus();
    act(() => {
      first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    });
    expect(document.activeElement?.getAttribute('data-id')).toBe(order[1]);
    expect(document.activeElement?.getAttribute('tabindex')).toBe('0');
    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    });
    expect(document.activeElement?.getAttribute('data-id')).toBe(order.at(-1));
    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    });
    expect(document.activeElement?.getAttribute('data-id')).toBe(order[0]);
  });

  it('opens the detail panel with Enter and Space (R2.3)', () => {
    const { root, onOpen, vm } = mount();
    const first = root.querySelector<SVGGElement>(`[data-id="${vm.entries[0]?.id}"]`);
    act(() => {
      first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      first?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    });
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen.mock.calls[0]?.[0]).toBe(vm.entries[0]?.id);
  });
});
