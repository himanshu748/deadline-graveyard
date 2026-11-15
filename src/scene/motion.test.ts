// @vitest-environment happy-dom
// Validates: graveyard-scene R1.2, R1.3, R2.2, R2.3, R3.1, R3.2, R3.4, R5.4.
import fc from 'fast-check';
import { gsap } from 'gsap';
import { afterEach, describe, expect, it } from 'vitest';
import {
  FOG_HALF_LOOP_SECONDS,
  flickerPeriod,
  initialMotion,
  motionPlan,
  parallaxOffset,
  PARALLAX_MAX_PX,
  pauseWhenHidden,
  startAmbient,
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
