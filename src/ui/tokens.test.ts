// Validates: graveyard-scene R5.1; accessible-list-view R2.6, R3.5.
// Recomputes the WCAG ratios of every text pairing in graveyard-design.md and checks the CSS
// custom properties match the token table.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, PALETTE, TYPE_SCALE_REM, type PaletteToken } from './tokens.ts';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

const TEXT_TOKENS: PaletteToken[] = ['moon-100', 'mist-300', 'lantern-300', 'candle-400', 'ghost-200', 'ember-400', 'moss-400', 'stone-400'];
const BACKGROUNDS: PaletteToken[] = ['night-900', 'night-800', 'night-700'];

/** The table in graveyard-design.md, so a palette change that breaks the doc fails here. */
const STEERING_TABLE: Record<string, [number, number, number]> = {
  'moon-100': [16.74, 15.26, 13.01],
  'mist-300': [9.53, 8.68, 7.4],
  'lantern-300': [14.01, 12.77, 10.89],
  'candle-400': [10.67, 9.73, 8.29],
  'ghost-200': [14.45, 13.17, 11.23],
  'ember-400': [8.19, 7.46, 6.36],
  'moss-400': [10.41, 9.49, 8.09],
  'stone-400': [5.97, 5.44, 4.64],
  'stone-500': [4.04, 3.68, 3.14],
};

describe('contrast', () => {
  it('computes known ratios (black on white is 21:1)', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it.each(TEXT_TOKENS.flatMap((fg) => BACKGROUNDS.map((bg) => [fg, bg] as const)))(
    '%s text on %s meets 4.5:1',
    (fg, bg) => {
      expect(contrastRatio(PALETTE[fg], PALETTE[bg])).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('button and badge text meet 4.5:1 (night-900 on candle-400, lantern-300, ghost-200, moon-100)', () => {
    for (const bg of ['candle-400', 'lantern-300', 'ghost-200', 'moon-100'] as const) {
      expect(contrastRatio(PALETTE['night-900'], PALETTE[bg])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('the focus ring (lantern-300) has at least 3:1 against every background', () => {
    for (const bg of BACKGROUNDS) {
      expect(contrastRatio(PALETTE['lantern-300'], PALETTE[bg])).toBeGreaterThanOrEqual(3);
    }
  });

  it('matches the measured table in graveyard-design.md to two decimals', () => {
    for (const [token, expected] of Object.entries(STEERING_TABLE)) {
      BACKGROUNDS.forEach((bg, i) => {
        const ratio = contrastRatio(PALETTE[token as PaletteToken], PALETTE[bg]);
        expect(Math.abs(ratio - (expected[i] ?? 0))).toBeLessThan(0.006);
      });
    }
  });
});

describe('CSS tokens', () => {
  it.each(Object.entries(PALETTE))('--%s in styles.css equals %s', (token, hex) => {
    expect(css).toContain(`--${token}: ${hex};`);
  });

  it('defines --step--1 to --step-5 with the steering sizes (large steps as the clamp maximum)', () => {
    for (const [step, rem] of Object.entries(TYPE_SCALE_REM)) {
      const m = new RegExp(`--step-${step}: ([^;]+);`).exec(css);
      expect(m, `--step-${step}`).not.toBeNull();
      const value = m?.[1] ?? '';
      if (Number(step) <= 2) expect(value).toBe(`${rem}rem`);
      else expect(value).toMatch(new RegExp(`, ${rem}rem\\)$`));
    }
  });

  it('self-hosts the fonts with font-display: swap (graveyard-scene R5.2)', () => {
    const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
    expect(faces.length).toBeGreaterThanOrEqual(2);
    for (const face of faces) {
      expect(face).toContain('font-display: swap');
      expect(face).toMatch(/url\('\/fonts\/[a-z0-9-]+\.woff2'\)/);
    }
  });
});
