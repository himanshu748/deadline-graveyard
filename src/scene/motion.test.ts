// @vitest-environment happy-dom
// Validates: graveyard-scene R1.2, R1.3, R2.2, R2.3, R3.1, R3.2, R3.4, R5.4.
import fc from 'fast-check';
import { gsap } from 'gsap';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aimSpotlight,
  FOG_HALF_LOOP_SECONDS,
  flickerPeriod,
  initialMotion,
  motionPlan,
  panCameraTo,
  parallaxOffset,
  PARALLAX_MAX_PX,
  pauseWhenHidden,
  spotGeometry,
  startAmbient,
  startStepClock,
} from './motion.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';

function sceneFixture(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const layer = document.createElementNS(SVG_NS, 'g');
  layer.dataset.depth = 'far';
  const fog = document.createElementNS(SVG_NS, 'ellipse');
  fog.dataset.fog = '';
  const flame = document.createElementNS(SVG_NS, 'path');
  flame.dataset.flame = 'fast';
  const ghost = document.createElementNS(SVG_NS, 'g');
  ghost.dataset.ghostBody = '';
  layer.append(fog, flame, ghost);
  svg.append(layer);
  document.body.append(svg);
  return svg;
}

function liveTweens(): number {
  return gsap.globalTimeline.getChildren(true, true, false).filter((t) => t.isActive() || t.repeat() === -1).length;
}

afterEach(() => {
  gsap.globalTimeline.clear();
  document.body.innerHTML = '';
});

describe('initialMotion', () => {
  it('follows prefers-reduced-motion when nothing is saved (R3.1)', () => {
    expect(initialMotion({ matches: true }, null)).toBe('reduced');
    expect(initialMotion({ matches: false }, null)).toBe('full');
    expect(initialMotion(null, null)).toBe('full');
  });

  it('prefers the saved toggle over the media query (R3.2)', () => {
    expect(initialMotion({ matches: true }, 'full')).toBe('full');
    expect(initialMotion({ matches: false }, 'reduced')).toBe('reduced');
  });
});

describe('flicker and loops', () => {
  it('flickers slowly (2 s or longer) when active and fast (0.6 s or shorter) when due soon', () => {
    expect(flickerPeriod('slow')).toBeGreaterThanOrEqual(2);
    expect(flickerPeriod('fast')).toBeLessThanOrEqual(0.6);
  });

  it('never flashes more than 3 times per second (R2.3)', () => {
    expect(1 / flickerPeriod('fast')).toBeLessThanOrEqual(3);
  });

  it('loops fog over at least 20 s (R1.3)', () => {
    expect(2 * FOG_HALF_LOOP_SECONDS).toBeGreaterThanOrEqual(20);
  });
});

describe('reduced motion', () => {
  it('returns a static plan: no parallax, drift, flicker or fog, fades of 200 ms or less (R3.4)', () => {
    expect(motionPlan('reduced')).toEqual({
      parallax: false,
      fogDrift: false,
      flicker: false,
      ghostFloat: false,
      stateChange: 'fade',
      stateChangeSeconds: 0.2,
    });
  });

  it('creates no GSAP tween at all in reduced mode', () => {
    const svg = sceneFixture();
    const before = gsap.globalTimeline.getChildren(true, true, true).length;
    expect(startAmbient('reduced', svg, 1600)).toBeNull();
    expect(gsap.globalTimeline.getChildren(true, true, true).length).toBe(before);
  });

  it('full mode starts endless loops, and the stop function removes every one of them', () => {
    const svg = sceneFixture();
    const stop = startAmbient('full', svg, 1600);
    expect(stop).not.toBeNull();
    expect(liveTweens()).toBeGreaterThanOrEqual(3);
    stop?.();
    expect(liveTweens()).toBe(0);
  });
});

describe('parallax', () => {
  it('never moves a layer further than its maximum; the far layer stays within 12 px (R1.2)', () => {
    expect(PARALLAX_MAX_PX.far).toBe(12);
    expect(PARALLAX_MAX_PX.far).toBeLessThan(PARALLAX_MAX_PX.mid);
    expect(PARALLAX_MAX_PX.mid).toBeLessThan(PARALLAX_MAX_PX.near);
    expect(PARALLAX_MAX_PX.near).toBeLessThan(PARALLAX_MAX_PX.front);
    fc.assert(
      fc.property(fc.double({ noNaN: true }), fc.double({ noNaN: true }), fc.double({ noNaN: true }), (px, py, scroll) => {
        const o = parallaxOffset(px, py, scroll, PARALLAX_MAX_PX.far);
        expect(Math.abs(o.x)).toBeLessThanOrEqual(12);
        expect(Math.abs(o.y)).toBeLessThanOrEqual(12);
      }),
    );
  });
});

describe('visibility', () => {
  it('pauses the global timeline while the tab is hidden and resumes it after (R5.4)', () => {
    const doc = document;
    let hidden = false;
    Object.defineProperty(doc, 'hidden', { configurable: true, get: () => hidden });
    const off = pauseWhenHidden(doc);
    hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(gsap.globalTimeline.paused()).toBe(true);
    hidden = false;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(gsap.globalTimeline.paused()).toBe(false);
    off();
  });
});

describe('first-visit intro motion (first-visit R1.2, R1.4, tasks 2 and 3)', () => {
  const all = () => gsap.globalTimeline.getChildren(true, true, true);

  it('reduced mode: no step clock and no tween, so a step waits for Next (R1.4)', () => {
    const before = all().length;
    let done = 0;
    expect(startStepClock('reduced', 9, () => done++, null)).toBeNull();
    expect(all().length).toBe(before);
    expect(done).toBe(0);
  });

  it('full mode: the step clock calls back once at its end, pauses, resumes and stops', () => {
    let done = 0;
    const bar = document.createElement('span');
    const clock = startStepClock('full', 9, () => done++, bar);
    expect(clock).not.toBeNull();
    const timeline = gsap.globalTimeline.getChildren(false, false, true).at(-1);
    expect(timeline?.duration()).toBe(9);
    clock?.pause();
    expect(timeline?.paused()).toBe(true);
    clock?.resume();
    expect(timeline?.paused()).toBe(false);
    timeline?.progress(1);
    expect(done).toBe(1);
    clock?.stop();
    expect(all()).not.toContain(timeline);
  });

  it('spotGeometry: the ring surrounds the slot and a wide spotlight covers the whole scene', () => {
    const slot = { x: 800, y: 600, w: 120, h: 230, wide: false, ring: true };
    const close = spotGeometry(slot, 1600, 900);
    expect(close.ring.x).toBeLessThan(slot.x - slot.w / 2);
    expect(close.ring.x + close.ring.width).toBeGreaterThan(slot.x + slot.w / 2);
    expect(close.ring.y).toBeLessThan(slot.y);
    expect(close.ring.y + close.ring.height).toBeGreaterThan(slot.y + slot.h);
    expect(close.spot).toEqual({ cx: 800, cy: 715, r: expect.any(Number) });
    expect(close.spot.r).toBeGreaterThanOrEqual(slot.h);
    expect(spotGeometry({ ...slot, wide: true }, 1600, 900).spot.r).toBeGreaterThanOrEqual(1600);
    expect(spotGeometry({ ...slot, ring: false }, 1600, 900).ring.opacity).toBe(0);
  });

  it('aimSpotlight writes the geometry at once in reduced mode or for the first aim, and glides in full mode', () => {
    const gradient = document.createElementNS(SVG_NS, 'radialGradient');
    const ring = document.createElementNS(SVG_NS, 'rect');
    const slot = { x: 400, y: 300, w: 130, h: 170, wide: false, ring: true };
    const before = all().length;
    aimSpotlight('reduced', { gradient, ring }, slot, { width: 1600, height: 900 });
    expect(all().length).toBe(before);
    expect(gradient.getAttribute('cx')).toBe('400');
    expect(ring.getAttribute('width')).toBe('150');
    aimSpotlight('full', { gradient, ring }, { ...slot, x: 900 }, { width: 1600, height: 900 }, true);
    expect(gradient.getAttribute('cx')).toBe('900');
    expect(all().length).toBe(before);
    const stop = aimSpotlight('full', { gradient, ring }, { ...slot, x: 1200 }, { width: 1600, height: 900 });
    expect(all().length).toBe(before + 2);
    stop();
    expect(all().filter((t) => t.isActive()).length).toBe(0);
  });

  it('panCameraTo jumps in reduced mode and glides with one tween in full mode', () => {
    const el = document.createElement('div');
    const calls: Array<[number, number]> = [];
    const win = { scrollX: 0, scrollY: 0, innerHeight: 1000, scrollTo: (x: number, y: number) => calls.push([x, y]) } as unknown as Window;
    el.getBoundingClientRect = () => ({ top: 900, height: 200, left: 0, width: 100 }) as DOMRect;
    panCameraTo('reduced', el, null, win);
    expect(calls).toEqual([[0, 640]]);
    const before = all().length;
    const stop = panCameraTo('full', el, null, win);
    expect(all().length).toBe(before + 1);
    stop();
  });
});
