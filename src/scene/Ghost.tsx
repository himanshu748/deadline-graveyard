// R2.6: a ghost that is lower and larger (closer to the viewer) the longer the project is inactive.
// The distance is static layout; the inner data-ghost-body group only floats in full motion.
import { PALETTE } from '../ui/tokens.ts';
import { truncate, type SceneNode } from './layout.ts';
import { LabelPlate } from './parts.tsx';

/** Ghost position inside its slot for a drift distance 0..1. */
export function ghostPose(distance: number): { offsetY: number; scale: number } {
  const d = Math.max(0, Math.min(1, distance));
  return { offsetY: Math.round((14 + 26 * d) * 10) / 10, scale: Math.round((0.55 + 0.35 * d) * 1000) / 1000 };
}

export function Ghost({ node }: { node: SceneNode }) {
  const pose = ghostPose(node.ghostDistance);
  return (
    <g data-distance={node.ghostDistance.toFixed(3)}>
      <g transform={`translate(0 ${pose.offsetY}) scale(${pose.scale})`}>
        <g data-ghost-body="">
          <circle cx="0" cy="50" r="62" fill="url(#ghost-glow)" />
          <path
            d="M-40 100 L-40 42 A40 40 0 0 1 40 42 L40 100 L27 88 L13 100 L0 88 L-13 100 L-27 88 Z"
            fill={PALETTE['ghost-200']}
            fill-opacity="0.9"
          />
          <ellipse cx="-14" cy="44" rx="6" ry="9" fill={PALETTE['night-900']} />
          <ellipse cx="14" cy="44" rx="6" ry="9" fill={PALETTE['night-900']} />
          <ellipse cx="0" cy="66" rx="7" ry="5" fill={PALETTE['night-900']} />
        </g>
      </g>
    </g>
  );
}

/** The ghost's visible text. Scene.tsx draws it outside the button element (WCAG 2.5.3). */
export function GhostText({ node }: { node: SceneNode }) {
  return <LabelPlate y={140} width={124} text={truncate(node.title, 11)} small />;
}
