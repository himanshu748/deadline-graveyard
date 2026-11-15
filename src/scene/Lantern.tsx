// R2.5: a submitted item is a warm, steady lantern hanging from the fence rail.
import { PALETTE } from '../ui/tokens.ts';
import { truncate, type SceneNode } from './layout.ts';
import { LabelPlate } from './parts.tsx';

export function Lantern({ node }: { node: SceneNode }) {
  return (
    <g data-lit="true">
      <line x1="0" y1="0" x2="0" y2="18" stroke={PALETTE['stone-400']} stroke-width="2" />
      <circle cx="0" cy="44" r="40" fill="url(#lantern-glow)" />
      <path d="M-14 22 L14 22 L10 16 L-10 16 Z" fill={PALETTE['stone-400']} />
      <rect x="-15" y="22" width="30" height="38" rx="4" fill={PALETTE['night-700']} stroke={PALETTE['stone-400']} stroke-width="2" />
      <rect x="-10" y="27" width="20" height="28" rx="3" fill={PALETTE['lantern-300']} />
      <ellipse cx="0" cy="42" rx="5" ry="8" fill={PALETTE['candle-400']} />
      <rect x="-12" y="60" width="24" height="5" rx="2" fill={PALETTE['stone-400']} />
      <LabelPlate y={94} width={96} text={truncate(node.title, 8)} small />
    </g>
  );
}
