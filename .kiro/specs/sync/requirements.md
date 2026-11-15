# Requirements: sync (stretch, not started)

**Status: not started, stretch.** Nothing in this spec is implemented or claimed. It is attempted only if every other spec is done and polished (PLAN.md F15), and only after the author approves and logs in to AWS personally. Until then the app ships with "none" plus JSON backup and restore (deadline-engine R5.3 to R5.5).

## Introduction

Optional sync of the graveyard between the author's own devices using the AWS free tier. Judging criterion: Technological Implementation.

## Requirement 1: opt-in only

**User Story:** As a user, I want sync to be optional, so that the app stays account-free by default.

#### Acceptance Criteria

- **R1.1** THE SYSTEM SHALL default to sync mode `none`.
- **R1.2** WHEN sync mode is `none` THE SYSTEM SHALL make no network calls for storage.
- **R1.3** WHERE sync is enabled THE SYSTEM SHALL keep IndexedDB as the source of truth and work fully offline.

## Requirement 2: conflict handling

**User Story:** As a user with two devices, I want edits merged predictably.

#### Acceptance Criteria

- **R2.1** WHEN the same item changed on two devices THE SYSTEM SHALL keep the change with the later `lastActivityAt` and keep resolutions (submitted, buried) over unresolved states.
- **R2.2** IF a sync request fails THEN THE SYSTEM SHALL retry later and show the last successful sync time.

## Requirement 3: cost and secrets

**User Story:** As the author, I want no bills and no leaked keys.

#### Acceptance Criteria

- **R3.1** THE SYSTEM SHALL use only AWS free-tier services, confirmed in AWS documentation (via the AWS Documentation MCP server) before any design is written.
- **R3.2** THE SYSTEM SHALL never commit AWS credentials; the commit-guard hook blocks AWS access key patterns.

Design and tasks contain only open questions and placeholder tasks until this stretch goal is approved.
