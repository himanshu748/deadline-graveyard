# Tasks: graveyard-scene

- [x] 1. Design tokens and fonts
  - CSS custom properties for the palette and `--step--1` to `--step-5` in `src/styles.css`, mirrored in `src/ui/tokens.ts`; `tokens.test.ts` recomputes every WCAG ratio.
  - Download IM Fell English and Atkinson Hyperlegible Next from their OFL sources into `public/fonts/`, add `@font-face` with `font-display: swap`, list both in README with license.
  - _Requirements: R5.1, R5.2_

- [x] 2. Pure scene layout
  - `src/scene/layout.ts` with `layoutScene` (reading `waxFraction`, `flicker`, `ghostDistance` from `src/domain/visual.ts`), unit tests and a fast-check no-overlap property.
  - _Requirements: R2.1, R2.6, R2.9, R1.5_

- [x] 3. Static SVG layers and state elements
  - `Scene.tsx` with sky, moon, hills, fence, ground, fog, grass layers (decorative layers `aria-hidden`).
  - `Candle.tsx`, `Tombstone.tsx`, `Lantern.tsx`, `Ghost.tsx`, demo badge.
  - happy-dom tests for each kind.
  - _Requirements: R1.1, R1.4, R2.1, R2.4, R2.5, R2.6, R2.7_

- [x] 4. Motion system
  - Confirm GSAP APIs in gsap.com docs. `src/scene/motion.ts` with `initialMotion`, `createTimeline`, toggle persisted locally, media query listener.
  - Flicker, fog drift, parallax, status-change animation, visibility pause.
  - Unit tests for `initialMotion` and `flickerPeriod`; e2e check for reduced mode.
  - _Requirements: R1.2, R1.3, R2.2, R2.3, R2.8, R3.1, R3.2, R3.3, R3.4, R5.4_

- [x] 5. Sound
  - Confirm Web Audio APIs on MDN. `src/scene/sound.ts` synthesised wind and chime, toggle off by default.
  - Unit test: no `AudioContext` is created before `enable()`.
  - _Requirements: R4.1, R4.2, R4.3, R4.4, R4.5_

- [x] 6. Performance pass
  - Measure with 50 generated items (labelled as test data, never shown to users). Pause off-screen loops if below 60 fps.
  - Measured 17 November by `scripts/measure-scene.mjs`: 50 synthetic items, roughly 60 fps at 1280×800 and 390×844 in local Chromium, p95 frame interval 16.7 ms. See `docs/design-reviews/2026-11-17/measurements.json`; no physical-device guarantee.
  - _Requirements: R5.3_

- [ ] 7. Design review
  - Run the `design-review` agent; fix findings; commit the dated review in `docs/design-reviews/`.
  - Manual Codex review and screenshots completed in `docs/design-reviews/2026-11-17.md`. This checkbox remains open because the specifically requested Kiro custom-agent invocation has not run (Kiro quota interruption).
  - _Requirements: R3.4, R5.1_
