// R2.1 to R2.3: a candle whose wax is the remaining fraction. The flame path carries
// data-flame so motion.ts can flicker it; in reduced motion it stays still and urgency is
// shown by flame size and colour instead (R3.4).
import { PALETTE } from '../ui/tokens.ts';
import { truncate, type SceneNode } from './layout.ts';
import { LabelPlate } from './parts.tsx';

export const WAX_MAX_HEIGHT = 124;
const BASE_Y = 186;

export function waxHeight(wax: number): number {
  return Math.round(WAX_MAX_HEIGHT * wax * 10) / 10;
}

export function Candle({ node }: { node: SceneNode }) {
  const h = waxHeight(node.wax);
  const top = BASE_Y - h;
  const urgent = node.flicker?.speed === 'fast';
  const urgency = node.flicker?.urgency ?? 0;
  const flameScale = 1 + 0.45 * urgency;
  const flameColour = urgent ? PALETTE['ember-400'] : PALETTE['candle-400'];
  return (
    <g data-wax={node.wax.toFixed(3)} data-flicker={node.flicker?.speed ?? 'none'}>
      {/* glow */}
      <circle cx="0" cy={top - 16} r={34 + 14 * urgency} fill="url(#flame-glow)" />
      {/* holder */}
      <ellipse cx="0" cy={BASE_Y + 4} rx="34" ry="9" fill={PALETTE['stone-500']} />
      <rect x="-34" y={BASE_Y - 2} width="68" height="7" rx="3" fill={PALETTE['stone-400']} />
      {/* wax */}
      <rect class="wax" x="-17" y={top} width="34" height={h} rx="4" fill="url(#wax-fill)" />
      <path d={`M-17 ${top + 6} q4 10 8 0 q3 14 7 0`} fill="none" stroke={PALETTE['mist-300']} stroke-width="3" stroke-linecap="round" />
      {/* wick */}
      <line x1="0" y1={top} x2="0" y2={top - 6} stroke={PALETTE['night-900']} stroke-width="2.5" />
      <g transform={`translate(0 ${top - 5}) scale(${flameScale.toFixed(3)})`}>
        <path data-flame={urgent ? 'fast' : 'slow'} d="M0 0 C 11 -9, 9 -22, 0 -36 C -9 -22, -11 -9, 0 0 Z" fill={flameColour} />
        <path d="M0 -2 C 5 -7, 4 -14, 0 -21 C -4 -14, -5 -7, 0 -2 Z" fill={PALETTE['lantern-300']} />
      </g>
    </g>
  );
}

/** The candle's visible text. Scene.tsx draws it outside the button element (WCAG 2.5.3). */
export function CandleText({ node }: { node: SceneNode }) {
  return <LabelPlate y={198} width={114} text={truncate(node.title, 10)} />;
}
