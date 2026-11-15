# Tasks: accessible-list-view

- [ ] 1. View model
  - `src/ui/view-model.ts` with `deriveViewModel`, `allowedActions`, status words, accessible names.
  - Unit tests and a fast-check parity property (scene ids equal list ids).
  - _Requirements: R1.1, R1.2, R1.3, R1.4, R3.1_

- [ ] 2. List view component
  - `src/ui/ListView.tsx`: grouped `<ul>` with headings, actions, Demo label, epitaphs; skip link target; view toggle saved locally.
  - happy-dom tests for structure and skip link.
  - _Requirements: R1.1, R1.2, R1.3, R1.4, R1.5, R1.6_

- [ ] 3. Scene keyboard navigation
  - Roving tabindex with `nextFocusIndex`; Enter and Space open the detail panel.
  - Unit tests for `nextFocusIndex`; happy-dom test for key handling.
  - _Requirements: R2.1, R2.2, R2.3_

- [ ] 4. Dialogs and focus return
  - Detail panel and forms as modal dialogs; Escape closes and refocuses the opener; focus stays inside while open.
  - _Requirements: R2.4, R2.5_

- [ ] 5. Announcer
  - One polite live region; `diffStatuses` drives messages; no clock announcements.
  - _Requirements: R3.2, R3.3_

- [ ] 6. Focus styles and contrast
  - Focus ring per `graveyard-design.md`; check contrast numbers against the steering table.
  - _Requirements: R2.6, R3.5_

- [ ] 7. E2E keyboard and axe
  - `e2e/a11y.spec.ts`: keyboard-only flow in both views, axe zero violations in both.
  - _Requirements: R2.1, R2.2, R2.3, R2.4, R3.4_
