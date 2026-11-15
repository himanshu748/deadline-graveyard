// The graveyard scene (graveyard-scene R1, R2; accessible-list-view R2, R3.1). One SVG, one Tab stop
// (roving tabindex), items in due order. Accessible names come from the shared view model.
import type { TargetedKeyboardEvent } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ViewEntry } from '../ui/view-model.ts';
import { nextFocusIndex } from '../ui/view-model.ts';
import { BackLayers, FenceLayer, FogLayer, GrassLayer, GroundLayer, SceneDefs } from './Backdrop.tsx';
import { Candle } from './Candle.tsx';
import { Ghost } from './Ghost.tsx';
import { Lantern } from './Lantern.tsx';
import type { SceneKind, SceneLayout, SceneNode } from './layout.ts';
import { animateStatusChange, startAmbient, type MotionMode } from './motion.ts';
import { DemoBadge, FocusRing } from './parts.tsx';
import { Tombstone } from './Tombstone.tsx';
import { PALETTE } from '../ui/tokens.ts';

export interface SceneProps {
  layout: SceneLayout;
  entries: ReadonlyMap<string, ViewEntry>;
  mode: MotionMode;
  /** Opens the detail panel. `opener` gets focus back when the panel closes. */
  onOpen: (id: string, opener: HTMLElement | SVGElement) => void;
}

function Body({ node }: { node: SceneNode }) {
  switch (node.kind) {
    case 'candle':
      return <Candle node={node} />;
    case 'tombstone':
      return <Tombstone node={node} />;
    case 'lantern':
      return <Lantern node={node} />;
    case 'ghost':
      return <Ghost node={node} />;
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
      } catch {
        // Static fallback: the new state is already drawn.
      }
    }
  }, [node.kind, mode]);

  return (
    <g
      ref={ref}
      class="scene-item"
      role="button"
      tabindex={focusable ? 0 : -1}
      aria-label={name}
      data-id={node.id}
      data-kind={node.kind}
      data-status={node.status}
      transform={`translate(${node.x} ${node.y})`}
      onKeyDown={(e) => onKeyDown(e, node.id)}
      onClick={(e) => onActivate(node.id, e.currentTarget)}
    >
      <rect x={-node.w / 2} y="0" width={node.w} height={node.h} fill="transparent" />
      <FocusRing w={node.w} h={node.h} />
      <g ref={animRef}>
        <Body node={node} />
      </g>
      {node.demo ? <DemoBadge x={-node.w / 2 + 6} y={6} /> : null}
    </g>
  );
}

export function Scene({ layout, entries, mode, onOpen }: SceneProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const items = useRef(new Map<string, SVGGElement>());
  const order = layout.nodes.map((n) => n.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const current = activeId !== null && order.includes(activeId) ? activeId : (order[0] ?? null);

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
    </svg>
  );
}
