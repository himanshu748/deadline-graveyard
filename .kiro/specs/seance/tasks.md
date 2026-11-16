# Tasks: seance

- [x] 1. Plan builder
  - `src/seance/plan.ts` with `candidatesFor`, `buildPlan`, `renderPlanText`, `isSeanceDue`; unit and property tests.
  - _Requirements: R1.1, R1.3, R1.4, R2.1, R2.2, R2.3, R2.4_

- [x] 2. LLM phrasing guard
  - `phrase` using the capture-and-export `LlmProvider`; fallback tests with a fake provider.
  - _Requirements: R2.5_

- [x] 3. Question flow UI
  - `src/seance/Seance.tsx`: one question per step, skip, item pickers, plan view, apply actions with confirmation.
  - _Requirements: R1.1, R1.2, R2.6_

- [x] 4. History and invitation
  - Save `SeanceRecord` in IndexedDB settings store, include in backups, list newest first, non-blocking invitation after 7 days.
  - _Requirements: R1.4, R3.1, R3.2_

- [x] 5. E2E
  - Keyboard-only séance and axe scan.
  - _Requirements: R1.1, R1.2, R1.3_
