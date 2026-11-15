// Design tokens shared by the SVG scene and the contrast test. The same values are CSS custom
// properties in src/styles.css (graveyard-scene R5.1); tokens.test.ts keeps the two in sync.
// Source of truth: .kiro/steering/graveyard-design.md "Palette and measured contrast".

export const PALETTE = {
  'night-900': '#0b1020',
  'night-800': '#141a2e',
  'night-700': '#1f2742',
  'moon-100': '#eef1f8',
  'mist-300': '#aeb8d0',
  'lantern-300': '#ffd98a',
  'candle-400': '#f5b84a',
  'ghost-200': '#c9e4ff',
  'ember-400': '#ff8a66',
  'moss-400': '#7fd1a3',
  'stone-400': '#8790ad',
  'stone-500': '#6b7390',
} as const;

export type PaletteToken = keyof typeof PALETTE;

/** Type scale, ratio 1.25 from 1.125 rem. Steps 3 to 5 clamp down on narrow screens. */
export const TYPE_SCALE_REM: Record<string, number> = {
  '-1': 0.9,
  '0': 1.125,
  '1': 1.406,
  '2': 1.758,
  '3': 2.197,
  '4': 2.747,
  '5': 3.433,
};

function channel(hex2: string): number {
  const c = parseInt(hex2, 16) / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const [, r = '00', g = '00', b = '00'] = m;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
