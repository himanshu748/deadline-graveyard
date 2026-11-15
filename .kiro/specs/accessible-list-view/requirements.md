# Requirements: accessible-list-view

## Introduction

Everything in the graveyard scene must be usable with a keyboard and a screen reader. This spec covers keyboard navigation of the scene, a screen-reader list view of the whole scene, focus management and announcements. Judging criterion: Design (PLAN.md F8).

## Requirement 1: list view of the whole scene

**User Story:** As a screen-reader user, I want a list of every deadline with its state, so that I get the same information as sighted users.

#### Acceptance Criteria

- **R1.1** THE SYSTEM SHALL render a list view containing one entry for every item in the scene, built from the same derived status list as the scene.
- **R1.2** THE SYSTEM SHALL group list entries by status under headings in this order: due soon, active, ghosts, missed, buried, submitted.
- **R1.3** THE SYSTEM SHALL give each entry its title, status in words, due time in the user's zone, source zone time when different, "Demo" when demo data, and the epitaph when present.
- **R1.4** THE SYSTEM SHALL offer in each entry the same actions as the scene element (submit, revive, bury, edit, write epitaph).
- **R1.5** WHEN the user activates the skip link THE SYSTEM SHALL move focus to the list view heading.
- **R1.6** THE SYSTEM SHALL let the user switch between scene view and list view, and remember the choice locally.

## Requirement 2: keyboard navigation of the scene

**User Story:** As a keyboard user, I want to move through the graveyard without a mouse.

#### Acceptance Criteria

- **R2.1** THE SYSTEM SHALL make every scene item focusable in due order with Tab, using a roving tabindex so the scene is one Tab stop.
- **R2.2** WHEN a scene item has focus and the user presses Left or Right THE SYSTEM SHALL move focus to the previous or next item, and Home or End to the first or last.
- **R2.3** WHEN a scene item has focus and the user presses Enter or Space THE SYSTEM SHALL open its detail panel.
- **R2.4** WHEN a panel or dialog is open and the user presses Escape THE SYSTEM SHALL close it and return focus to the element that opened it.
- **R2.5** WHILE a modal dialog is open THE SYSTEM SHALL keep focus inside it.
- **R2.6** THE SYSTEM SHALL show a visible focus indicator with at least 3:1 contrast against adjacent colours on every focusable element.

## Requirement 3: names, roles and announcements

**User Story:** As a screen-reader user, I want scene items announced meaningfully.

#### Acceptance Criteria

- **R3.1** THE SYSTEM SHALL give each focusable scene item an accessible name of the form "<title>, <status in words>, due <time>".
- **R3.2** WHEN an item's status changes while the app is open THE SYSTEM SHALL announce it once through a polite live region.
- **R3.3** THE SYSTEM SHALL not announce the ticking clock or wax height changes.
- **R3.4** THE SYSTEM SHALL pass an axe scan with zero violations in both scene view and list view.
- **R3.5** THE SYSTEM SHALL keep text contrast at WCAG AA (4.5:1 normal text, 3:1 large text) in both views.
