# Requirements: seance

## Introduction

The Séance is a weekly review. The user answers 3 questions and the app turns the answers plus the current graveyard into next week's plan. It is rule-based by default; an LLM provider may only rephrase the plan. Judging criterion: Innovation/Idea (PLAN.md F10, F11).

The 3 questions:
1. "Which spirits are restless?" (what is due or neglected that worries you)
2. "What did the graves teach you?" (lessons from missed or buried items)
3. "What will you keep alive next week?" (what you commit to)

## Requirement 1: running a séance

**User Story:** As a student, I want a short weekly ritual, so that I reflect and plan instead of drifting.

#### Acceptance Criteria

- **R1.1** WHEN the user opens the Séance THE SYSTEM SHALL show the 3 questions one at a time, each with the relevant items listed (due in the next 7 days and ghosts for Q1, missed and buried in the last 7 days for Q2, all unresolved for Q3).
- **R1.2** THE SYSTEM SHALL let the user skip any question.
- **R1.3** WHEN the user finishes THE SYSTEM SHALL build a plan for the next 7 days from the answers and the items.
- **R1.4** WHEN 7 days have passed since the last séance THE SYSTEM SHALL show a gentle in-app invitation, never a blocking dialog.

## Requirement 2: the plan

**User Story:** As a user, I want a concrete plan, so that I know what to do first.

#### Acceptance Criteria

- **R2.1** THE SYSTEM SHALL list items picked in Q3 first, then the rest of the unresolved items due within 7 days, in due order.
- **R2.2** THE SYSTEM SHALL suggest for each ghost picked in Q1 either "revive" (if picked in Q3) or "bury" (if not).
- **R2.3** THE SYSTEM SHALL include the Q2 lessons as a "Lessons from the graves" section, and offer to save each lesson as the epitaph of a missed item that has none.
- **R2.4** WHEN the plan is built with provider `none` THE SYSTEM SHALL produce it with rule-based templates only and no network calls.
- **R2.5** WHERE an LLM provider is selected THE SYSTEM SHALL only rephrase the rule-based plan text and SHALL keep the same items, order and actions.
- **R2.6** THE SYSTEM SHALL let the user apply the plan's actions (revive, bury, set epitaph) one by one with confirmation.

## Requirement 3: history

**User Story:** As a user, I want to see past séances.

#### Acceptance Criteria

- **R3.1** WHEN a séance is completed THE SYSTEM SHALL save the answers, the plan and the date locally, and include them in backups.
- **R3.2** THE SYSTEM SHALL show past séances newest first.
