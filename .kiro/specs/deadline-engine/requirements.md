# Requirements: deadline-engine

## Introduction

The deadline engine is the pure core of Deadline Graveyard. It decides, for any item and any instant `now`, whether the item is a candle (active or due-soon), a tombstone (missed or buried), a lantern (submitted) or a ghost (abandoned). It also handles timezones, DST, date-only deadlines and local persistence. Rules come from `.kiro/steering/deadline-domain.md`. Judging criterion: Potential Impact (PLAN.md F1, F2) and Technological Implementation (F14).

Glossary: **item** is a tracked deadline or project; **now** is an instant passed in by the caller; **phase** is the time-only state (active, due-soon, missed); **status** is the displayed state; **resolution** is a user decision (submitted or buried).

## Requirement 1: time phase

**User Story:** As a student juggling many deadlines, I want each deadline's urgency computed exactly, so that I can trust the scene.

#### Acceptance Criteria

- **R1.1** WHEN `now` is earlier than `dueAt - 24h` THE SYSTEM SHALL report phase `active`.
- **R1.2** WHEN `now` is at or after `dueAt - 24h` and earlier than `dueAt` THE SYSTEM SHALL report phase `due-soon`.
- **R1.3** WHEN `now` is at or after `dueAt` THE SYSTEM SHALL report phase `missed`.
- **R1.4** THE SYSTEM SHALL measure the 24 h due-soon window as exactly 86,400,000 ms of elapsed time, including when a DST transition in the item's zone falls inside the window.
- **R1.5** THE SYSTEM SHALL compute phase and status from instants only, so that the same inputs give the same result whatever the display timezone.
- **R1.6** WHILE no user action occurs THE SYSTEM SHALL never move an item's phase backwards as `now` increases.

## Requirement 2: displayed status and resolutions

**User Story:** As a user, I want submitted and buried items to stay settled, so that my history is reliable.

#### Acceptance Criteria

- **R2.1** WHEN an item has resolution `submitted` THE SYSTEM SHALL report status `submitted` for every later `now`.
- **R2.2** WHEN an item has resolution `buried` THE SYSTEM SHALL report status `buried` for every later `now`.
- **R2.3** WHEN an unresolved item's phase is `missed` THE SYSTEM SHALL report status `missed`.
- **R2.4** WHEN an unresolved, not-missed item has had no activity for at least 7 x 24 h of elapsed time THE SYSTEM SHALL report status `ghost`.
- **R2.5** WHEN none of R2.1 to R2.4 apply THE SYSTEM SHALL report the phase (`active` or `due-soon`) as the status.
- **R2.6** IF the user submits an item that is resolved or whose `dueAt` has passed THEN THE SYSTEM SHALL reject the action with a typed error and leave the item unchanged.
- **R2.7** WHEN the user submits an unresolved item before `dueAt` THE SYSTEM SHALL set resolution `submitted` at `now`.
- **R2.8** WHEN the user buries a ghost or a missed item with no resolution THE SYSTEM SHALL set resolution `buried` at `now`.
- **R2.9** WHEN the user revives a ghost THE SYSTEM SHALL set `lastActivityAt` to `now`.
- **R2.10** IF any action targets a resolved item THEN THE SYSTEM SHALL reject it with a typed error and leave the item unchanged.
- **R2.11** WHEN the user writes or edits an epitaph on a missed or buried item THE SYSTEM SHALL store it without changing the status.
- **R2.12** WHEN the user records activity (for example a note) on an unresolved item THE SYSTEM SHALL set `lastActivityAt` to `now`.
- **R2.13** WHEN the user edits the due instant of an unresolved item THE SYSTEM SHALL store the new `dueAt`, zone and `dateOnly` flag and set `lastActivityAt` to `now`.

## Requirement 3: timezones, DST and date-only deadlines

**User Story:** As someone entering a hackathon in another timezone, I want the deadline stored in its own timezone and shown in mine, so that I never misread it.

#### Acceptance Criteria

- **R3.1** THE SYSTEM SHALL store each deadline as UTC epoch milliseconds plus the source IANA zone.
- **R3.2** WHEN a local date-time is converted to an instant in a zone THE SYSTEM SHALL use Temporal disambiguation `'compatible'`: a non-existent (spring-forward) time shifts forward by the gap, and a repeated (fall-back) time takes the earlier offset.
- **R3.3** WHEN a converted local time was shifted or was ambiguous THE SYSTEM SHALL report that in the conversion result so the UI can warn the user.
- **R3.4** WHEN a deadline has a date and no time THE SYSTEM SHALL use 23:59:59 on that date in the deadline's zone and mark it `dateOnly`.
- **R3.5** WHEN a local date-time that exists exactly once in its zone is converted to an instant and formatted back in the same zone THE SYSTEM SHALL return the original local date-time.
- **R3.6** THE SYSTEM SHALL format instants for display in a caller-supplied zone, and include the source zone time when it differs.
- **R3.7** IF a zone identifier is not a valid IANA zone THEN THE SYSTEM SHALL return a typed validation error.

## Requirement 4: purity

**User Story:** As the developer, I want the engine to be pure, so that property-based tests can drive time.

#### Acceptance Criteria

- **R4.1** THE SYSTEM SHALL take `now` as a parameter in every domain function that depends on time.
- **R4.2** THE SYSTEM SHALL NOT read the system clock, the DOM or storage from `src/domain/`.

## Requirement 5: offline storage, backup and restore

**User Story:** As a user without an account, I want my graveyard saved in the browser and exportable, so that I never lose it.

#### Acceptance Criteria

- **R5.1** WHEN an item is created, changed or deleted THE SYSTEM SHALL persist it to IndexedDB before reporting success.
- **R5.2** WHEN the app starts offline THE SYSTEM SHALL load all items from IndexedDB.
- **R5.3** WHEN the user exports a backup THE SYSTEM SHALL produce a versioned JSON file containing every item and setting.
- **R5.4** IF an imported backup fails schema validation THEN THE SYSTEM SHALL reject the whole file, keep current data unchanged and show which field failed.
- **R5.5** WHEN a valid backup is imported THE SYSTEM SHALL restore it so that a following export equals the imported data.
- **R5.6** IF IndexedDB is unavailable THEN THE SYSTEM SHALL keep working in memory and tell the user that data will not persist.
