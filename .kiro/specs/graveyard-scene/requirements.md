# Requirements: graveyard-scene

## Introduction

The graveyard scene is the main interface: a layered SVG moonlit graveyard where every element encodes deadline state from the deadline-engine. Art direction, palette, type and motion rules are in `.kiro/steering/graveyard-design.md`. Judging criterion: Design (PLAN.md F6, F7, F9).

## Requirement 1: scene layers and atmosphere

**User Story:** As a user, I want a calm moonlit graveyard, so that checking deadlines feels like a ritual rather than a chore.

#### Acceptance Criteria

- **R1.1** THE SYSTEM SHALL render the scene as one SVG with ordered layers: sky and stars, moon and halo, far hills, mid hills with fence, ground, fog, foreground grass.
- **R1.2** WHILE motion is `full` THE SYSTEM SHALL shift layers with pointer position and scroll by an amount that grows from back to front, with the far layer moving at most 12 px.
- **R1.3** WHILE motion is `full` THE SYSTEM SHALL drift the fog layers slowly across the scene in a loop of at least 20 s.
- **R1.4** THE SYSTEM SHALL mark decorative layers `aria-hidden="true"`.
- **R1.5** WHEN the viewport is narrower than 640 px THE SYSTEM SHALL keep every item visible by wrapping the ground into rows or scrolling horizontally with visible scroll affordance.

## Requirement 2: state elements

**User Story:** As a user, I want each deadline to look like its state, so that I understand my week at a glance.

#### Acceptance Criteria

- **R2.1** WHEN an item's status is `active` or `due-soon` THE SYSTEM SHALL draw a candle whose wax height is the remaining fraction `(dueAt - now) / (dueAt - createdAt)`, clamped to [0.05, 1].
- **R2.2** WHILE an item is `active` and motion is `full` THE SYSTEM SHALL flicker its flame with a period of 2 s or longer.
- **R2.3** WHILE an item is `due-soon` and motion is `full` THE SYSTEM SHALL flicker its flame with a period of 0.6 s or shorter, and never more than 3 flashes per second.
- **R2.4** WHEN an item's status is `missed` or `buried` THE SYSTEM SHALL draw a tombstone engraved with its title and epitaph, or "No epitaph yet" when empty.
- **R2.5** WHEN an item's status is `submitted` THE SYSTEM SHALL draw a lit lantern on the fence.
- **R2.6** WHEN an item's status is `ghost` THE SYSTEM SHALL draw a ghost whose distance toward the viewer grows with days of inactivity beyond 7, capped at 30 days.
- **R2.7** WHEN an item is demo data THE SYSTEM SHALL show a visible "Demo" badge on its scene element.
- **R2.8** WHEN an item changes status while the app is open THE SYSTEM SHALL animate the change (for example a candle guttering into a tombstone) within 700 ms in `full` motion, or switch instantly or with a fade of 200 ms or less in `reduced` motion.
- **R2.9** THE SYSTEM SHALL render the scene from the same derived status list as the accessible list view.

## Requirement 3: reduced motion

**User Story:** As a user who is sensitive to motion, I want a still version of the scene, so that I can use the app comfortably.

#### Acceptance Criteria

- **R3.1** WHEN the page loads THE SYSTEM SHALL set motion to `reduced` if `prefers-reduced-motion: reduce` matches, otherwise `full`.
- **R3.2** WHEN the user changes the motion toggle THE SYSTEM SHALL apply the choice immediately, save it locally and prefer it over the media query.
- **R3.3** WHEN the `prefers-reduced-motion` media query changes and the user has not set the toggle THE SYSTEM SHALL follow the new value.
- **R3.4** WHILE motion is `reduced` THE SYSTEM SHALL run no parallax, drift, flicker or fog animation, and SHALL still encode urgency with flame size and colour and neglect with ghost position.

## Requirement 4: sound

**User Story:** As a user, I want optional atmosphere sound that never surprises me.

#### Acceptance Criteria

- **R4.1** THE SYSTEM SHALL start with sound off on first visit.
- **R4.2** WHEN the user turns sound on THE SYSTEM SHALL create the Web Audio context in that click handler and play synthesised ambience at low volume.
- **R4.3** WHEN a lantern lights while sound is on THE SYSTEM SHALL play one short synthesised chime.
- **R4.4** THE SYSTEM SHALL use only sounds synthesised in the browser, with no recorded audio files.
- **R4.5** WHEN the user turns sound off THE SYSTEM SHALL stop all audio within 200 ms and save the choice.

## Requirement 5: design tokens and performance

**User Story:** As a judge, I want the scene to be polished and fast.

#### Acceptance Criteria

- **R5.1** THE SYSTEM SHALL define palette colours and type scale steps as CSS custom properties matching `graveyard-design.md`.
- **R5.2** THE SYSTEM SHALL self-host its OFL fonts with `font-display: swap`.
- **R5.3** WHEN 50 items are shown THE SYSTEM SHALL keep animation at 60 fps or degrade by pausing ambient loops of off-screen elements.
- **R5.4** WHEN the tab is hidden THE SYSTEM SHALL pause all GSAP timelines and resume them when visible.
