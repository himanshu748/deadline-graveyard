// Decorative layers (graveyard-scene R1.1, R1.4). Every group here is aria-hidden. Layers that
// move with parallax carry data-depth; fog bands carry data-fog. None has a transform attribute,
// so GSAP owns their transforms in full motion and they stay put in reduced motion.
import type { ComponentChildren } from 'preact';
import { PALETTE } from '../ui/tokens.ts';

/** Deterministic star field so the sky is the same on every render and in screenshots. */
export function stars(count: number, width: number, maxY: number): Array<{ x: number; y: number; r: number; o: number }> {
  let seed = 20261031;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  return Array.from({ length: count }, () => ({
    x: Math.round(next() * width),
    y: Math.round(next() * maxY),
    r: Math.round((0.6 + next() * 1.6) * 10) / 10,
    o: Math.round((0.35 + next() * 0.6) * 100) / 100,
  }));
}

export function SceneDefs() {
  return (
    <defs>
      <linearGradient id="sky-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color={PALETTE['night-900']} />
        <stop offset="1" stop-color="#1b2550" />
      </linearGradient>
      <radialGradient id="moon-halo">
        <stop offset="0" stop-color={PALETTE['moon-100']} stop-opacity="0.35" />
        <stop offset="1" stop-color={PALETTE['moon-100']} stop-opacity="0" />
      </radialGradient>
      <linearGradient id="ground-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#18213a" />
        <stop offset="1" stop-color={PALETTE['night-900']} />
      </linearGradient>
      <radialGradient id="fog-fill">
        <stop offset="0" stop-color={PALETTE['mist-300']} stop-opacity="0.22" />
        <stop offset="1" stop-color={PALETTE['mist-300']} stop-opacity="0" />
      </radialGradient>
      <radialGradient id="flame-glow">
        <stop offset="0" stop-color={PALETTE['candle-400']} stop-opacity="0.45" />
        <stop offset="1" stop-color={PALETTE['candle-400']} stop-opacity="0" />
      </radialGradient>
      <radialGradient id="lantern-glow">
        <stop offset="0" stop-color={PALETTE['lantern-300']} stop-opacity="0.5" />
        <stop offset="1" stop-color={PALETTE['lantern-300']} stop-opacity="0" />
      </radialGradient>
      <radialGradient id="ghost-glow">
        <stop offset="0" stop-color={PALETTE['ghost-200']} stop-opacity="0.3" />
        <stop offset="1" stop-color={PALETTE['ghost-200']} stop-opacity="0" />
      </radialGradient>
      <linearGradient id="wax-fill" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color={PALETTE['mist-300']} />
        <stop offset="0.45" stop-color={PALETTE['moon-100']} />
        <stop offset="1" stop-color={PALETTE['mist-300']} />
      </linearGradient>
    </defs>
  );
}

function Layer({ name, depth, children }: { name: string; depth?: string; children: ComponentChildren }) {
  return (
    <g aria-hidden="true" data-layer={name} data-depth={depth}>
      {children}
    </g>
  );
}

/** Sky, stars, moon and far hills: everything behind the fence. */
export function BackLayers({ width, height, fenceY }: { width: number; height: number; fenceY: number }) {
  const hillY = fenceY - 110;
  return (
    <>
      <Layer name="sky">
        <rect x="-60" y="-60" width={width + 120} height={height + 120} fill="url(#sky-fill)" />
        {stars(90, width, Math.max(120, hillY - 20)).map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={PALETTE['moon-100']} fill-opacity={s.o} />
        ))}
      </Layer>
      <Layer name="moon" depth="far">
        <circle cx={width * 0.82} cy="140" r="190" fill="url(#moon-halo)" />
        <circle cx={width * 0.82} cy="140" r="62" fill={PALETTE['moon-100']} />
        <circle cx={width * 0.82 - 20} cy="124" r="12" fill={PALETTE['mist-300']} fill-opacity="0.35" />
        <circle cx={width * 0.82 + 18} cy="158" r="8" fill={PALETTE['mist-300']} fill-opacity="0.3" />
        <circle cx={width * 0.82 + 24} cy="118" r="5" fill={PALETTE['mist-300']} fill-opacity="0.3" />
      </Layer>
      <Layer name="far-hills" depth="far">
        <path
          d={`M-80 ${hillY + 40} C ${width * 0.15} ${hillY - 50}, ${width * 0.3} ${hillY + 10}, ${width * 0.45} ${hillY - 20} S ${width * 0.75} ${hillY - 60}, ${width + 80} ${hillY + 10} L ${width + 80} ${height + 60} L -80 ${height + 60} Z`}
          fill="#151d38"
        />
      </Layer>
    </>
  );
}

/** Mid hills and the iron fence with one rail per lantern row. */
export function FenceLayer({ width, height, fenceY, groundY }: { width: number; height: number; fenceY: number; groundY: number }) {
  const rails: number[] = [];
  for (let y = fenceY; y < groundY - 20; y += 130) rails.push(y);
  const posts: number[] = [];
  for (let x = 20; x < width; x += 46) posts.push(x);
  return (
    <Layer name="mid-hills-fence" depth="mid">
      <path
        d={`M-80 ${fenceY + 20} C ${width * 0.2} ${fenceY - 40}, ${width * 0.5} ${fenceY + 30}, ${width * 0.7} ${fenceY - 10} S ${width} ${fenceY - 20}, ${width + 80} ${fenceY + 10} L ${width + 80} ${height + 60} L -80 ${height + 60} Z`}
        fill="#111832"
      />
      {posts.map((x) => (
        <g key={x}>
          <line x1={x} y1={fenceY - 26} x2={x} y2={groundY + 24} stroke="#3a4468" stroke-width="4" />
          <path d={`M${x - 6} ${fenceY - 24} L${x} ${fenceY - 38} L${x + 6} ${fenceY - 24} Z`} fill="#3a4468" />
        </g>
      ))}
      {rails.map((y) => (
        <rect key={y} x="0" y={y - 3} width={width} height="6" fill="#3a4468" />
      ))}
      <rect x="0" y={groundY + 6} width={width} height="5" fill="#3a4468" />
    </Layer>
  );
}

export function GroundLayer({ width, height, groundY }: { width: number; height: number; groundY: number }) {
  return (
    <Layer name="ground" depth="mid">
      <path
        d={`M-80 ${groundY + 30} C ${width * 0.25} ${groundY}, ${width * 0.6} ${groundY + 40}, ${width + 80} ${groundY + 14} L ${width + 80} ${height + 60} L -80 ${height + 60} Z`}
        fill="url(#ground-fill)"
      />
    </Layer>
  );
}

/** Fog bands sit behind the items so scene text is never drawn on fog. Wider than the view for drift. */
export function FogLayer({ width, fenceY, groundY }: { width: number; fenceY: number; groundY: number }) {
  return (
    <Layer name="fog" depth="near">
      <ellipse data-fog="" cx={width * 0.3} cy={fenceY - 30} rx={width * 0.45} ry="70" fill="url(#fog-fill)" />
      <ellipse data-fog="" cx={width * 0.72} cy={groundY - 10} rx={width * 0.5} ry="80" fill="url(#fog-fill)" />
      <ellipse data-fog="" cx={width * 0.5} cy={groundY + 60} rx={width * 0.6} ry="60" fill="url(#fog-fill)" />
    </Layer>
  );
}

export function GrassLayer({ width, height }: { width: number; height: number }) {
  const blades: string[] = [];
  for (let x = -20; x < width + 20; x += 18) {
    const h = 14 + ((x * 7) % 19);
    blades.push(`M${x} ${height} L${x + 5} ${height - h} L${x + 10} ${height} Z`);
  }
  return (
    <Layer name="grass" depth="front">
      <rect x="-60" y={height - 18} width={width + 120} height="80" fill="#070b16" />
      <path d={blades.join(' ')} fill="#070b16" />
    </Layer>
  );
}
