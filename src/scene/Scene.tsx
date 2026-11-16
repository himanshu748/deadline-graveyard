// The graveyard scene (graveyard-scene R1, R2; accessible-list-view R2, R3.1). One SVG, one Tab stop
// (roving tabindex), items in due order. Accessible names come from the shared view model.
import type { TargetedKeyboardEvent } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ViewEntry } from '../ui/view-model.ts';
import { nextFocusIndex } from '../ui/view-model.ts';
import { BackLayers, FenceLayer, FogLayer, GrassLayer, GroundLayer, SceneDefs } from './Backdrop.tsx';
import { Candle, CandleText } from './Candle.tsx';
import { Ghost, GhostText } from './Ghost.tsx';
import { Lantern, LanternText } from './Lantern.tsx';
import type { SceneKind, SceneLayout, SceneNode } from './layout.ts';
import { aimSpotlight, animateStatusChange, panCameraTo, startAmbient, type MotionMode, type SpotTarget } from './motion.ts';
import { DemoBadge, FocusRing } from './parts.tsx';
import { Tombstone, TombstoneText } from './Tombstone.tsx';
import { PALETTE } from '../ui/tokens.ts';

/** first-visit: the slot the intro points at. `wide` opens the spotlight over the whole scene. */
export interface SceneSpotlight {
  id: string;
  wide: boolean;
}

export interface SceneProps {
  layout: SceneLayout;
  entries: ReadonlyMap<string, ViewEntry>;
  mode: MotionMode;
  /** Opens the detail panel. `opener` gets focus back when the panel closes. */
  onOpen: (id: string, opener: HTMLElement | SVGElement) => void;
  /**
   * first-visit tasks 2 and 3: while the intro runs, a spotlight and a pointer ring follow this
   * slot and the camera pans to it. `null` lights the whole scene; `undefined` means no intro.
   */
  spotlight?: SceneSpotlight | null | undefined;
}

function Body({ node }: { node: SceneNode }) {
  switch (node.kind) {
    case 'candle':
      return <Candle node={node} />;
    case 'tombstone':
      return <Tombstone node={node} />;
    case 'lantern':
      return <Lantern />;
    case 'ghost':
      return <Ghost node={node} />;
  }
}

function BodyText({ node }: { node: SceneNode }) {
  switch (node.kind) {
    case 'candle':
      return <CandleText node={node} />;
    case 'tombstone':
      return <TombstoneText node={node} />;
    case 'lantern':
      return <LanternText node={node} />;
    case 'ghost':
      return <GhostText node={node} />;
  }
}

interface ItemProps {
  node: SceneNode;
  name: string;
  focusable: boolean;
  mode: MotionMode;
  register: (id: string, el: SVGGElement | null) => void;
  onKeyDown: (e: TargetedKeyboardEvent<SVGGElement>, id: string) => void;
  onActivate: (id: string, el: SVGGElement) => void;
}

function SceneItem({ node, name, focusable, mode, register, onKeyDown, onActivate }: ItemProps) {
  const ref = useRef<SVGGElement>(null);
  const animRef = useRef<SVGGElement>(null);
  const textRef = useRef<SVGGElement>(null);
  const prevKind = useRef<SceneKind | null>(null);

  useLayoutEffect(() => {
    register(node.id, ref.current);
    return () => register(node.id, null);
  }, [node.id, register]);

  // R2.8: animate a change of kind (a candle guttering into a tombstone, a lantern lighting).
  useLayoutEffect(() => {
    const before = prevKind.current;
    prevKind.current = node.kind;
    if (before !== null && before !== node.kind && animRef.current) {
      try {
        animateStatusChange(mode, animRef.current);
        if (textRef.current) animateStatusChange(mode, textRef.current);
      } catch {
        // Static fallback: the new state is already drawn.
      }
    }
  }, [node.kind, mode]);

  // The button holds shapes only. Its visible text (title plate, epitaph, Demo badge) is drawn in an
  // aria-hidden sibling on top, so the button's name always contains every word of its visible
  // label (WCAG 2.5.3, axe label-content-name-mismatch); clicks pass through the text to the button.
  return (
    <g class="scene-slot" data-slot={node.id} transform={`translate(${node.x} ${node.y})`}>
      <g
        ref={ref}
        class="scene-item"
        role="button"
        tabindex={focusable ? 0 : -1}
        aria-label={name}
        data-id={node.id}
        data-kind={node.kind}
        data-status={node.status}
        onKeyDown={(e) => onKeyDown(e, node.id)}
        onClick={(e) => onActivate(node.id, e.currentTarget)}
      >
        <rect x={-node.w / 2} y="0" width={node.w} height={node.h} fill="transparent" />
        <FocusRing w={node.w} h={node.h} />
        <g ref={animRef}>
          <Body node={node} />
        </g>
      </g>
      <g ref={textRef} class="scene-item-text" aria-hidden="true" pointer-events="none">
        <BodyText node={node} />
        {node.demo ? <DemoBadge x={-node.w / 2 + 6} y={6} /> : null}
      </g>
    </g>
  );
}

export function Scene({ layout, entries, mode, onOpen, spotlight }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const items = useRef(new Map<string, SVGGElement>());
  const gradientRef = useRef<SVGRadialGradientElement>(null);
  const ringRef = useRef<SVGRectElement>(null);
  const aimed = useRef(false);
  const order = layout.nodes.map((n) => n.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const current = activeId !== null && order.includes(activeId) ? activeId : (order[0] ?? null);

  const intro = spotlight !== undefined;
  const target = spotlight ? layout.nodes.find((n) => n.id === spotlight.id) : undefined;
  const spot: SpotTarget = target
    ? { x: target.x, y: target.y, w: target.w, h: target.h, wide: spotlight?.wide ?? false, ring: true }
    : { x: layout.width / 2, y: 0, w: 0, h: layout.height, wide: true, ring: false };
  const spotKey = intro ? `${target?.id ?? ''}:${spot.x}:${spot.y}:${spot.w}:${spot.h}:${spot.wide}:${layout.width}:${layout.height}` : '';

  // first-visit task 3: aim the spotlight and pan the camera when the target or its slot changes
  // (a revived ghost moves down to the candles). The first aim of an intro jumps, later ones glide.
  useLayoutEffect(() => {
    if (!intro) {
      aimed.current = false;
      return;
    }
    const gradient = gradientRef.current;
    const ring = ringRef.current;
    if (!gradient || !ring) return;
    let stopAim = () => {};
    let stopPan = () => {};
    try {
      stopAim = aimSpotlight(mode, { gradient, ring }, spot, layout, !aimed.current);
      aimed.current = true;
      const el = target ? items.current.get(target.id) : undefined;
      if (el) stopPan = panCameraTo(mode, el, svgRef.current?.parentElement ?? null);
    } catch {
      // GSAP or scrolling failed: the captions still explain every step.
    }
    return () => {
      stopAim();
      stopPan();
    };
  }, [spotKey, mode]);

  const register = useMemo(
    () => (id: string, el: SVGGElement | null) => {
      if (el) items.current.set(id, el);
      else items.current.delete(id);
    },
    [],
  );

  // Rebuild the ambient loops only when the set of animated elements changes, not every tick.
  const signature = layout.nodes.map((n) => `${n.id}:${n.kind}:${n.flicker?.speed ?? ''}`).join('|');
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let stop: (() => void) | null = null;
    try {
      stop = startAmbient(mode, svg, layout.width);
    } catch {
      stop = null; // GSAP failed: the scene stays static, like reduced motion.
    }
    return () => stop?.();
  }, [mode, signature, layout.width]);

  const onKeyDown = (e: TargetedKeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(id, e.currentTarget);
      return;
    }
    const index = order.indexOf(id);
    const next = nextFocusIndex(index, e.key, order.length);
    if (next === index || next < 0) return;
    e.preventDefault();
    const nextId = order[next];
    if (nextId === undefined) return;
    setActiveId(nextId);
    items.current.get(nextId)?.focus();
  };

  const onActivate = (id: string, el: SVGGElement) => {
    setActiveId(id);
    onOpen(id, el);
  };

  const count = layout.nodes.length;
  const label =
    count === 0
      ? 'Graveyard scene, empty. Add a deadline to light a candle.'
      : `Graveyard scene, ${count} deadline${count === 1 ? '' : 's'} in due order. Use the arrow keys to move between them and Enter to open one.`;

  return (
    <svg
      ref={svgRef}
      class="scene"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      role="group"
      aria-label={label}
      data-motion={mode}
      preserveAspectRatio="xMidYMin meet"
    >
      <SceneDefs />
      <BackLayers width={layout.width} height={layout.height} fenceY={layout.fenceY} />
      <FenceLayer width={layout.width} height={layout.height} fenceY={layout.fenceY} groundY={layout.groundY} />
      <GroundLayer width={layout.width} height={layout.height} groundY={layout.groundY} />
      <FogLayer width={layout.width} fenceY={layout.fenceY} groundY={layout.groundY} />
      {/* One group for every item so a status change keeps the same element (R2.8). */}
      <g data-layer="items" data-depth="mid">
        {layout.nodes.map((n) => (
          <SceneItem
            key={n.id}
            node={n}
            name={entries.get(n.id)?.accessibleName ?? n.title}
            focusable={n.id === current}
            mode={mode}
            register={register}
            onKeyDown={onKeyDown}
            onActivate={onActivate}
          />
        ))}
      </g>
      {count === 0 ? (
        <g aria-hidden="true">
          <rect x={layout.width / 2 - 300} y={layout.groundY + 90} width="600" height="56" rx="10" fill={PALETTE['night-800']} fill-opacity="0.94" />
          <text x={layout.width / 2} y={layout.groundY + 126} text-anchor="middle" class="scene-label" style={{ fontSize: '24px' }}>
            The graveyard is quiet. Add a deadline to light a candle.
          </text>
        </g>
      ) : null}
      <GrassLayer width={layout.width} height={layout.height} />
      {intro ? (
        <g class="intro-overlay" aria-hidden="true" data-testid="intro-spotlight" pointer-events="none">
          <defs>
            {/* Clear in the middle, then night-900 at 72% beyond the radius (spread pad). */}
            <radialGradient id="intro-spot" ref={gradientRef} gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color={PALETTE['night-900']} stop-opacity="0" />
              <stop offset="0.6" stop-color={PALETTE['night-900']} stop-opacity="0" />
              <stop offset="1" stop-color={PALETTE['night-900']} stop-opacity="0.72" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width={layout.width} height={layout.height} fill="url(#intro-spot)" />
          {/* Geometry is written by aimSpotlight only, so Preact never fights GSAP over it. */}
          <rect ref={ringRef} class="intro-ring" rx="16" fill="none" stroke={PALETTE['lantern-300']} stroke-width="4" stroke-dasharray="14 10" />
        </g>
      ) : null}
    </svg>
  );
}
