// The séance circle: three candles on the ground, one per question. A candle lights when its
// question is reached, so the picture encodes progress; the same progress is always in words
// next to it ("Question 2 of 3"), so the SVG is decorative and aria-hidden. Hand-written SVG.
// Motion: only a 200 ms opacity fade when a flame lights, and none in reduced mode
// (graveyard-design.md "Motion").
import type { MotionMode } from '../scene/motion.ts';
import { PALETTE } from '../ui/tokens.ts';

const SPOTS = [
  { x: 64, y: 92 },
  { x: 120, y: 70 },
  { x: 176, y: 92 },
] as const;

export function CandleCircle({ lit, mode }: { lit: number; mode: MotionMode }) {
  return (
    <svg class="candle-circle" viewBox="0 0 240 132" aria-hidden="true" data-motion={mode} data-lit={lit}>
      <ellipse cx="120" cy="100" rx="104" ry="26" fill={PALETTE['night-900']} stroke={PALETTE['stone-400']} stroke-width="2" stroke-dasharray="5 7" />
      <ellipse cx="120" cy="100" rx="40" ry="10" fill={PALETTE['night-700']} />
      {SPOTS.map((spot, i) => {
        const on = i < lit;
        return (
          <g key={i} transform={`translate(${spot.x} ${spot.y})`}>
            <circle class="cc-flame" cx="0" cy="-40" r="20" fill="url(#cc-glow)" opacity={on ? 1 : 0} />
            <rect x="-8" y="-28" width="16" height="30" rx="3" fill={PALETTE['moon-100']} />
            <ellipse cx="0" cy="2" rx="14" ry="4" fill={PALETTE['stone-500']} />
            <line x1="0" y1="-28" x2="0" y2="-33" stroke={PALETTE['night-900']} stroke-width="2" />
            <g class="cc-flame" opacity={on ? 1 : 0}>
              <path d="M0 -32 C 7 -38, 6 -46, 0 -55 C -6 -46, -7 -38, 0 -32 Z" fill={PALETTE['candle-400']} />
              <path d="M0 -34 C 3 -37, 3 -41, 0 -46 C -3 -41, -3 -37, 0 -34 Z" fill={PALETTE['lantern-300']} />
            </g>
          </g>
        );
      })}
      <defs>
        <radialGradient id="cc-glow">
          <stop offset="0" stop-color={PALETTE['candle-400']} stop-opacity="0.55" />
          <stop offset="1" stop-color={PALETTE['candle-400']} stop-opacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}
