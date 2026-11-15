# Tasks: deadline-engine

- [ ] 1. Domain types and constants
  - Create `src/domain/types.ts` with `Item`, `Phase`, `Status`, `Result`, `ActionError`, `EpochMs`.
  - Export `DUE_SOON_MS` and `GHOST_AFTER_MS` from `src/domain/status.ts`.
  - _Requirements: R1.4, R2.4, R3.1, R4.1_

- [ ] 2. Phase and status derivation
  - Implement `phaseAt` and `deriveStatus` with the precedence in design.md.
  - Example tests for every boundary (R1.1 to R1.3, R2.1 to R2.5) and the 7-day ghost threshold.
  - _Requirements: R1.1, R1.2, R1.3, R1.5, R2.1, R2.2, R2.3, R2.4, R2.5_

- [ ] 3. User actions
  - Implement `submit`, `bury`, `revive`, `editDue`, `setEpitaph` returning `Result<Item>` without mutation.
  - Example tests for each allowed and rejected case.
  - _Requirements: R2.6, R2.7, R2.8, R2.9, R2.10, R2.11_

- [ ] 4. Time conversion and formatting with temporal-polyfill
  - Implement `toInstant` (with `adjustment` detection), `toLocal`, `formatForDisplay`, date-only end-of-day rule.
  - Example tests: New York spring-forward gap, fall-back overlap, Lord Howe 30-minute DST, Kathmandu +05:45, invalid zone.
  - _Requirements: R3.2, R3.3, R3.4, R3.6, R3.7_

- [ ] 5. Property-based tests P1 to P5
  - Generators for instants, zones and DST-biased instants in `src/domain/arbitraries.ts`.
  - `src/domain/status.property.test.ts` (P1 to P4) and `src/domain/time.property.test.ts` (P5).
  - _Requirements: R1.2, R1.4, R1.5, R1.6, R2.1, R2.2, R2.10, R3.2, R3.3, R3.5_

- [ ] 6. Purity guard test
  - `tests/domain/purity.test.ts` scans `src/domain/` for forbidden clock, DOM and storage calls.
  - _Requirements: R4.1, R4.2_

- [ ] 7. IndexedDB repository and backup
  - Add `fake-indexeddb` dev dependency (confirm API in its README) and list it in README.
  - Implement `src/storage/repository.ts` with `idb` (`openDB`, upgrade callback creating `items` and `settings`), in-memory fallback, backup export, schema-validated import.
  - Tests: persist then reload, export then import equals, invalid backup rejected with path, fallback when `indexedDB` is undefined.
  - _Requirements: R5.1, R5.2, R5.3, R5.4, R5.5, R5.6_

- [ ] 8. Kiro IDE correctness step (author, in Kiro IDE)
  - Run spec correctness property extraction on this spec and record the extracted properties against P1 to P6 in KIRO_USAGE.md.
  - _Requirements: R1.4, R1.6, R3.5_
