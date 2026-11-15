# Tasks: first-visit

- [ ] 1. Demo seed and helpers
  - `src/ui/intro/demo-seed.ts` with `demoItems`, `clearDemo`, `shouldStartIntro`; unit tests and a `clearDemo` property test.
  - _Requirements: R2.1, R2.2, R2.3, R2.5, R2.6, R1.1_

- [ ] 2. Intro step machine and captions
  - `src/ui/intro/Intro.tsx` with `nextStep`, captions, Skip button, Escape, replay from menu, focus to first item at the end.
  - _Requirements: R1.2, R1.3, R1.5, R1.6_

- [ ] 3. Motion and reduced mode
  - GSAP camera and pointer per step through the scene motion helper; reduced mode waits for Next.
  - _Requirements: R1.2, R1.4_

- [ ] 4. Ghost and lantern invitations
  - Revive and submit invitations on demo item A using deadline-engine actions; declining continues.
  - _Requirements: R3.1, R3.2, R3.3_

- [ ] 5. Keep or clear demo
  - End-of-intro choice, plus a permanent "Clear demo" menu action.
  - _Requirements: R2.4, R2.5_

- [ ] 6. E2E
  - Fresh-visit timing, skip, reduced motion, Demo label in list view and `.ics`.
  - _Requirements: R1.2, R1.3, R1.4, R2.2_
