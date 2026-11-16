// R2.4: missed and buried items. Title and epitaph are engraved in moon-100 on a night-700
// plate (stone-500 is for the shape only). Buried stones get an earth mound as a shape cue.
import { PALETTE } from '../ui/tokens.ts';
import { truncate, wrapText, type SceneNode } from './layout.ts';
import { LabelPlate } from './parts.tsx';

export const NO_EPITAPH = 'No epitaph yet';

export function Tombstone({ node }: { node: SceneNode }) {
  const buried = node.status === 'buried';
  return (
    <g data-epitaph={node.epitaph ? 'yes' : 'none'}>
      <path
        d="M-50 190 L-50 72 Q-50 34 0 34 Q50 34 50 72 L50 190 Z"
        fill={PALETTE['stone-500']}
        stroke={PALETTE['stone-400']}
        stroke-width="3"
      />
      <rect x="-42" y="62" width="84" height="120" rx="6" fill={PALETTE['night-700']} />
      <line x1="-28" y1="93" x2="28" y2="93" stroke={PALETTE['stone-400']} stroke-width="1.5" />
      {buried ? (
        <path d="M-58 196 Q0 168 58 196 Z" fill="#2a2418" stroke={PALETTE['stone-500']} stroke-width="2" />
      ) : (
        <path d="M30 40 L22 58 L30 66 L24 84" fill="none" stroke={PALETTE['night-900']} stroke-width="2.5" />
      )}
    </g>
  );
}

/**
 * The engraved title and epitaph and the state plate. Scene.tsx draws them outside the button
 * element, so the button's name (which has no epitaph) still contains its visible label (WCAG 2.5.3).
 */
export function TombstoneText({ node }: { node: SceneNode }) {
  const buried = node.status === 'buried';
  const lines = wrapText(node.epitaph ?? NO_EPITAPH, 11, 3);
  return (
    <g>
      <text x="0" y="84" text-anchor="middle" class="scene-engraving" style={{ fontSize: '18px' }}>
        {truncate(node.title, 9)}
      </text>
      {lines.map((line, i) => (
        <text key={i} x="0" y={114 + i * 20} text-anchor="middle" class="scene-engraving" style={{ fontSize: '15px' }}>
          {line}
        </text>
      ))}
      <LabelPlate y={198} width={100} text={buried ? 'Buried' : 'Missed'} />
    </g>
  );
}
