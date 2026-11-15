// Motion system (graveyard-scene R1.2, R1.3, R2.2, R2.3, R2.8, R3.1 to R3.4, R5.4).
// One setting, `full` or `reduced`, decides whether any GSAP loop exists. In `reduced` mode
// no ambient tween is ever created, so nothing can run continuously.
// GSAP APIs used, confirmed on gsap.com/docs v3: gsap.context() (collects tweens so revert()
// kills them all), gsap.to(), gsap.fromTo(), gsap.quickTo(), gsap.globalTimeline.pause()/resume().
// gsap.matchMedia() is a wrapper around gsap.context(); it is not used because the manual toggle
// must override the media query, so the mode is resolved here and passed in.
import { gsap } from 'gsap';

export type MotionMode = 'full' | 'reduced';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** R3.1, R3.2: a saved toggle wins; otherwise follow the media query. */
export function initialMotion(mq: { matches: boolean } | null, saved: MotionMode | null): MotionMode {
  if (saved === 'full' || saved === 'reduced') return saved;
  return mq?.matches ? 'reduced' : 'full';
}

/** R2.2, R2.3: seconds per flicker cycle. One cycle is one flash, so `fast` is 2 flashes per second. */
export function flickerPeriod(speed: 'slow' | 'fast'): number {
  return speed === 'fast' ? 0.5 : 2.4;
}

export interface MotionPlan {
  parallax: boolean;
  fogDrift: boolean;
  flicker: boolean;
  ghostFloat: boolean;
  /** How a status change is shown (R2.8): grow in, or an opacity fade only. */
  stateChange: 'grow' | 'fade';
  stateChangeSeconds: number;
}

/** The whole motion configuration for a mode. `reduced` turns every loop off (R3.4). */
export function motionPlan(mode: MotionMode): MotionPlan {
  if (mode === 'reduced') {
    return { parallax: false, fogDrift: false, flicker: false, ghostFloat: false, stateChange: 'fade', stateChangeSeconds: 0.2 };
  }
  return { parallax: true, fogDrift: true, flicker: true, ghostFloat: true, stateChange: 'grow', stateChangeSeconds: 0.6 };
}

/** Largest shift per layer in CSS pixels, growing from back to front. Far layer at most 12 px (R1.2). */
export const PARALLAX_MAX_PX = { far: 12, mid: 20, near: 28, front: 36 } as const;
export type Depth = keyof typeof PARALLAX_MAX_PX;

/** Fog drift: half a loop in seconds (yoyo), so a full loop is 48 s or more (R1.3). */
export const FOG_HALF_LOOP_SECONDS = 24;

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Parallax offset for one layer. `px` and `py` are the pointer position mapped to -1..1,
 * `scroll` is how far the page is scrolled, 0..1. The result never exceeds `maxPx` on either axis.
 */
export function parallaxOffset(px: number, py: number, scroll: number, maxPx: number): { x: number; y: number } {
  const s = Math.max(0, Math.min(1, scroll));
  return { x: clamp1(px) * maxPx, y: (0.5 * clamp1(py) + 0.5 * s) * maxPx };
}

/**
 * Starts the ambient loops (flicker, fog drift, ghost float, parallax) inside `root`.
 * Returns a stop function, or null in `reduced` mode, where nothing is created.
 * Elements opt in with data attributes: `data-flame="slow|fast"`, `data-fog`, `data-ghost-body`,
 * `data-depth="far|mid|near|front"`. Animated elements never carry a `transform` attribute
 * of their own, so GSAP does not fight the layout.
 */
export function startAmbient(mode: MotionMode, root: SVGSVGElement, viewWidth: number): (() => void) | null {
  const plan = motionPlan(mode);
  if (!plan.flicker && !plan.fogDrift && !plan.ghostFloat && !plan.parallax) return null;

  const listeners: Array<() => void> = [];
  const ctx = gsap.context(() => {
    if (plan.flicker) {
      root.querySelectorAll<SVGElement>('[data-flame]').forEach((el, i) => {
        const speed = el.dataset.flame === 'fast' ? 'fast' : 'slow';
        const half = flickerPeriod(speed) / 2;
        gsap.to(el, {
          scaleY: speed === 'fast' ? 0.78 : 0.9,
          scaleX: speed === 'fast' ? 1.08 : 1.03,
          opacity: 0.82,
          duration: half,
          delay: (i % 7) * 0.13,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
          transformOrigin: '50% 100%',
        });
      });
    }
    if (plan.fogDrift) {
      root.querySelectorAll<SVGElement>('[data-fog]').forEach((el, i) => {
        gsap.to(el, {
          x: i % 2 === 0 ? 140 : -110,
          duration: FOG_HALF_LOOP_SECONDS + i * 8,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
      });
    }
    if (plan.ghostFloat) {
      root.querySelectorAll<SVGElement>('[data-ghost-body]').forEach((el, i) => {
        gsap.to(el, { y: -12, duration: 3.2 + (i % 3) * 0.6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      });
    }
    if (plan.parallax) {
      const layers = [...root.querySelectorAll<SVGElement>('[data-depth]')].map((el) => {
        const depth = (el.dataset.depth ?? 'far') as Depth;
        return {
          max: PARALLAX_MAX_PX[depth] ?? PARALLAX_MAX_PX.far,
          xTo: gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power2.out' }),
          yTo: gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power2.out' }),
        };
      });
      let px = 0;
      let py = 0;
      const apply = () => {
        const rendered = root.getBoundingClientRect().width || viewWidth;
        const unitsPerPx = viewWidth / rendered;
        const scroll = window.innerHeight > 0 ? window.scrollY / window.innerHeight : 0;
        for (const layer of layers) {
          const o = parallaxOffset(px, py, scroll, layer.max);
          layer.xTo(o.x * unitsPerPx);
          layer.yTo(o.y * unitsPerPx);
        }
      };
      const onPointer = (e: PointerEvent) => {
        px = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
        py = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
        apply();
      };
      window.addEventListener('pointermove', onPointer, { passive: true });
      window.addEventListener('scroll', apply, { passive: true });
      listeners.push(() => window.removeEventListener('pointermove', onPointer));
      listeners.push(() => window.removeEventListener('scroll', apply));
    }
  }, root);

  return () => {
    for (const off of listeners) off();
    ctx.revert();
  };
}

/** R2.8: show a status change on `el` (an inner group without its own transform attribute). */
export function animateStatusChange(mode: MotionMode, el: SVGElement): void {
  const plan = motionPlan(mode);
  if (plan.stateChange === 'fade') {
    gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: plan.stateChangeSeconds, ease: 'none' });
    return;
  }
  gsap.fromTo(
    el,
    { opacity: 0, scale: 0.6, transformOrigin: '50% 100%' },
    { opacity: 1, scale: 1, duration: plan.stateChangeSeconds, ease: 'power2.out' },
  );
}

/** R5.4: pause every GSAP animation while the tab is hidden. Returns an unsubscribe function. */
export function pauseWhenHidden(doc: Document): () => void {
  const onChange = () => {
    if (doc.hidden) gsap.globalTimeline.pause();
    else gsap.globalTimeline.resume();
  };
  doc.addEventListener('visibilitychange', onChange);
  return () => doc.removeEventListener('visibilitychange', onChange);
}
