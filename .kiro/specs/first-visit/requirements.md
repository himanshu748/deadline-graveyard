# Requirements: first-visit

## Introduction

A judge's first minute and the demo video both start here. The first visit is a short intro of at most 60 seconds that seeds 3 clearly labelled demo deadlines and shows each kind of scene element. Judging criterion: Presentation (PLAN.md F12), and the backbone of the Best Demo attempt.

## Requirement 1: intro sequence

**User Story:** As a first-time visitor or judge, I want to understand the app within a minute.

#### Acceptance Criteria

- **R1.1** WHEN the app opens with no stored items and no "intro seen" flag THE SYSTEM SHALL start the intro.
- **R1.2** THE SYSTEM SHALL complete the intro in 60 s or less, in at most 5 short steps, each with a caption.
- **R1.3** THE SYSTEM SHALL let the user skip the intro at any time with a visible button and with Escape.
- **R1.4** WHILE motion is `reduced` THE SYSTEM SHALL show the intro as static captioned steps that advance only on user input.
- **R1.5** WHEN the intro ends or is skipped THE SYSTEM SHALL set the "intro seen" flag and move focus to the first scene item.
- **R1.6** THE SYSTEM SHALL let the user replay the intro from the menu.

## Requirement 2: demo deadlines

**User Story:** As a judge, I want sample data I can trust to be sample data.

#### Acceptance Criteria

- **R2.1** WHEN the intro starts THE SYSTEM SHALL seed exactly 3 demo items relative to `now`: A, due in about 5 days with `lastActivityAt` 8 days before `now` (so it starts as a ghost); B, due-soon (due in about 6 hours); C, missed (due about 1 day ago) with a sample epitaph.
- **R2.2** THE SYSTEM SHALL label every demo item "Demo" in the scene, the list view, the detail panel and every export.
- **R2.3** THE SYSTEM SHALL give demo items generic titles that do not name real events, people or organisations.
- **R2.4** WHEN the intro ends THE SYSTEM SHALL ask whether to keep or clear the demo items.
- **R2.5** WHEN the user chooses "Clear demo" at any time THE SYSTEM SHALL delete every item with `demo = true` and no other item.
- **R2.6** IF the user already has stored items THEN THE SYSTEM SHALL not seed demo items again unless the user replays the intro and confirms.

## Requirement 3: ghost and lantern preview

**User Story:** As a judge, I want to see every state without waiting a week.

#### Acceptance Criteria

- **R3.1** WHEN the intro reaches the ghost step THE SYSTEM SHALL point at demo item A as a ghost and invite the user to revive it, which turns it into an active candle.
- **R3.2** WHEN the intro reaches the lantern step THE SYSTEM SHALL invite the user to submit demo item A and show the lantern lighting, so the 3 demo items show all five states (ghost, candle, due-soon candle, tombstone, lantern).
- **R3.3** IF the user declines an invitation in R3.1 or R3.2 THEN THE SYSTEM SHALL continue the intro without changing the item.
