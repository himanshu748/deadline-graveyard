---
inclusion: fileMatch
fileMatchPattern: ["src/domain/**", "src/storage/**", "tests/domain/**", "**/*.property.test.ts"]
---

# Deadline domain rules

These rules are the source of truth for `src/domain/` and its tests. The deadline-engine spec (`.kiro/specs/deadline-engine/`) derives its EARS requirements and correctness properties from this file. Change the rule here first, then the spec, then the code.

## Data model

- An **item** is a deadline (a hackathon, an assignment, an application) that may also be a project with activity.
- `dueAt`: UTC epoch milliseconds (integer). `zone`: the IANA zone the deadline was published in (for example `America/Los_Angeles`). `dateOnly`: true when the source gave a date without a time.
- `lastActivityAt`: UTC epoch ms of the last user action on the item (create, edit, note, revive).
- `resolution`: `null`, `{ kind: 'submitted', at }` or `{ kind: 'buried', at }`. Resolutions are set only by user actions.
- `demo`: true for seeded demo items. Demo items follow the same rules and are always labelled.

## Derived state (pure functions of item + now)

Constants: `DUE_SOON_MS = 24 * 60 * 60 * 1000`, `GHOST_AFTER_MS = 7 * 24 * 60 * 60 * 1000`. Both are absolute elapsed time, never calendar days, so DST cannot stretch or shrink them.

Time phase, from `now` and `dueAt` only:

| Phase | Condition |
|---|---|
| `active` | `now < dueAt - DUE_SOON_MS` |
| `due-soon` | `dueAt - DUE_SOON_MS <= now < dueAt` |
| `missed` | `now >= dueAt` |

Displayed status, in precedence order:

1. `submitted` if `resolution.kind === 'submitted'` (lantern). Terminal.
2. `buried` if `resolution.kind === 'buried'` (tombstone). Terminal.
3. `missed` if phase is `missed` (tombstone with an optional, editable epitaph).
4. `ghost` if `now - lastActivityAt >= GHOST_AFTER_MS` (ghost drifting closer).
5. `due-soon` (candle with fast flicker) or `active` (candle).

Transitions caused by user actions:

- **Submit** is allowed only when there is no resolution and `now < dueAt`. Sets `submitted`.
- **Bury** is allowed for a ghost or a missed item with no resolution. Sets `buried`.
- **Revive** is allowed for a ghost. Sets `lastActivityAt = now`, which returns it to `active` or `due-soon`.
- **Edit** of `dueAt` on an unresolved item is allowed and counts as activity. Terminal items cannot change state.

Invariants (these become fast-check properties):

1. State depends only on instants (`now`, `dueAt`, `lastActivityAt`, `resolution`), never on the display zone.
2. With no user action, as `now` increases the phase never moves backwards (`active` to `due-soon` to `missed`).
3. `submitted` and `buried` are terminal: no later `now` and no action changes them.
4. The due-soon window is exactly `DUE_SOON_MS` of elapsed time, including across DST transitions in the item's zone.
5. Formatting a local wall-clock time in a zone and parsing it back round-trips, under the DST policy below.
6. `.ics` export then parse returns the same deadlines (uid, title, instant, zone, dateOnly).

## Timezone and DST policy

Implemented with `temporal-polyfill` 1.0.8. The default disambiguation for converting a local wall-clock time to an instant is `'compatible'`, verified on 15 Nov 2026:

- **Non-existent local time (spring forward):** shifts forward by the length of the gap. `2026-03-08T02:30` in `America/New_York` becomes `03:30-04:00`.
- **Repeated local time (fall back):** takes the earlier offset. `2026-11-01T01:30` in `America/New_York` becomes `01:30-04:00` (EDT, the first occurrence).
- The UI warns when a typed time was shifted by the gap rule, and offers the later occurrence when a typed time is ambiguous. Round-trip property 5 is stated for times that exist exactly once; gap and overlap cases have their own example tests.

## Date-only rule

A date without a time means **23:59:59 local time in the deadline's own zone** on that date, converted with the same `'compatible'` policy, and `dateOnly = true` so the UI can say "end of day (assumed)".

## Display rule

Display every instant in the user's zone (`Temporal.Now.timeZoneId()` is read once in the UI layer, never in the domain). When the deadline's `zone` differs from the user's, also show the time in the source zone.

## Purity rule: no `Date.now()` in the domain

- `src/domain/**` must not call `Date.now()`, `new Date()` with no arguments, `performance.now()` or `Temporal.Now.*`. `now` is always a function parameter.
- The UI owns the clock (one ticking `now` signal) and passes it down. This is what lets fast-check drive time freely.
- The domain must not read the DOM, `navigator`, `localStorage` or IndexedDB.

## Testing notes

- Property tests generate instants across 1970 to 2100, a set of IANA zones that includes DST zones in both hemispheres and half-hour or 45-minute offsets (`America/New_York`, `Europe/London`, `Australia/Sydney`, `America/Santiago`, `Asia/Kolkata`, `Asia/Kathmandu`, `Australia/Lord_Howe`, `UTC`), and times biased toward DST transitions.
- Keep property tests deterministic in CI by logging the fast-check seed on failure.
