// Small shared SVG pieces. Text always sits on a solid night-800 plate (graveyard-design.md rules).
import { PALETTE } from '../ui/tokens.ts';

/** R2.7: visible "Demo" badge, top left of the slot. */
export function DemoBadge({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="54" height="24" rx="6" fill={PALETTE['ghost-200']} />
      <text x="27" y="17" text-anchor="middle" class="scene-small" style={{ fill: PALETTE['night-900'], fontWeight: 700 }}>
        Demo
      </text>
    </g>
  );
}

/** A label on an opaque plate, centred on x = 0. */
export function LabelPlate({ y, width, text, small }: { y: number; width: number; text: string; small?: boolean }) {
  const h = small ? 26 : 30;
  return (
    <g>
      <rect x={-width / 2} y={y} width={width} height={h} rx="6" fill={PALETTE['night-800']} fill-opacity="0.94" />
      <text x="0" y={y + (small ? 19 : 22)} text-anchor="middle" class={small ? 'scene-small' : 'scene-label'}>
        {text}
      </text>
    </g>
  );
}

/** Two-tone focus ring around the whole slot: 2 px night-900 then lantern-300 (R2.6). */
export function FocusRing({ w, h }: { w: number; h: number }) {
  return (
    <g class="focus-ring">
      <rect x={-w / 2 + 3} y="3" width={w - 6} height={h - 6} rx="12" fill="none" stroke={PALETTE['night-900']} stroke-width="8" />
      <rect x={-w / 2 + 3} y="3" width={w - 6} height={h - 6} rx="12" fill="none" stroke={PALETTE['lantern-300']} stroke-width="4" />
    </g>
  );
}
