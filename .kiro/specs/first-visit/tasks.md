# Tasks: first-visit

- [x] 1. Demo seed and helpers
  - `src/ui/intro/demo-seed.ts` with `demoItems`, `clearDemo`, `shouldStartIntro`; unit tests and a `clearDemo` property test.
  - Done: also `withDemo` (replay replaces, never doubles) and `SETTING_INTRO_SEEN`. Tests: `demo-seed.test.ts`, `demo-seed.property.test.ts`.
  - _Requirements: R2.1, R2.2, R2.3, R2.5, R2.6, R1.1_

- [x] 2. Intro step machine and captions
  - `src/ui/intro/Intro.tsx` with `nextStep`, captions, Skip button, Escape, replay from menu, focus to first item at the end.
  - Done: the pure step machine and captions live in `src/ui/intro/steps.ts`; replay is in Export and settings. Tests: `steps.test.ts`, `Intro.test.tsx`.
  - _Requirements: R1.2, R1.3, R1.5, R1.6_

- [x] 3. Motion and reduced mode
  - GSAP camera and pointer per step through the scene motion helper; reduced mode waits for Next.
  - Done: `startStepClock`, `aimSpotlight` and `panCameraTo` in `src/scene/motion.ts`; tests in `motion.test.ts` and `Scene.test.tsx`.
  - _Requirements: R1.2, R1.4_

- [x] 4. Ghost and lantern invitations
  - Revive and submit invitations on demo item A using deadline-engine actions; declining continues.
  - _Requirements: R3.1, R3.2, R3.3_

- [x] 5. Keep or clear demo
  - End-of-intro choice, plus a permanent "Clear demo" menu action.
  - Done: Clear demo is in Export and settings and in the demo note shown while demo items exist.
  - _Requirements: R2.4, R2.5_

- [x] 6. E2E
  - Fresh-visit timing, skip, reduced motion, Demo label in list view and `.ics`.
  - Done: `e2e/first-visit.spec.ts` (5 tests) plus an axe scan of the intro; the other specs start from an empty graveyard through `e2e/helpers.ts`.
  - _Requirements: R1.2, R1.3, R1.4, R2.2_
