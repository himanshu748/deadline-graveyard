# Design: deadline-engine

## Overview

A pure TypeScript module in `src/domain/` computes status from instants, plus a thin storage layer in `src/storage/` that persists items with `idb`. The UI owns the clock and passes `now` in. Rules: `.kiro/steering/deadline-domain.md`.

## Architecture

```mermaid
flowchart LR
  Clock["UI clock signal (now)"] --> Derive
  Store["storage/repository.ts (idb)"] -->|Item[]| Derive["domain/status.ts deriveStatus(item, now)"]
  Derive --> Scene["scene/* SVG"]
  Derive --> List["ui/ListView"]
  Actions["domain/actions.ts submit | bury | revive | edit | epitaph"] --> Store
  Time["domain/time.ts Temporal helpers"] --> Actions
  Time --> Format["domain/time.ts formatForDisplay"]
  Derive --> Visual["domain/visual.ts wax, flicker, ghost distance"]
```

## Data model

```ts
type EpochMs = number; // integer UTC milliseconds

interface Item {
  id: string;            // crypto.randomUUID() at creation (UI layer)
  title: string;
  url?: string;
  dueAt: EpochMs;
  zone: string;          // IANA zone of the source deadline
  dateOnly: boolean;
  createdAt: EpochMs;
  lastActivityAt: EpochMs;
  resolution: null | { kind: 'submitted' | 'buried'; at: EpochMs };
  epitaph?: string;      // missed or buried only
  notes?: string;
  demo: boolean;
}

type Phase = 'active' | 'due-soon' | 'missed';
type Status = 'active' | 'due-soon' | 'missed' | 'ghost' | 'submitted' | 'buried';
```

Backup file: `{ format: 'deadline-graveyard-backup', version: 1, exportedAt, items: Item[], settings }`.

IndexedDB: database `deadline-graveyard`, version 1, object stores `items` (keyPath `id`, index `dueAt`) and `settings` (keyPath `key`).

## Interfaces

```ts
// domain/status.ts
export const DUE_SOON_MS = 86_400_000;
export const GHOST_AFTER_MS = 7 * DUE_SOON_MS;
export function phaseAt(dueAt: EpochMs, now: EpochMs): Phase;
export function deriveStatus(item: Item, now: EpochMs): Status;

// domain/actions.ts (return new items, never mutate)
type ActionError = { code: 'resolved' | 'past-due' | 'not-ghost' | 'not-missed-or-ghost' | 'not-missed-or-buried' | 'invalid' };
type Result<T> = { ok: true; value: T } | { ok: false; error: ActionError };
export function submit(item: Item, now: EpochMs): Result<Item>;
export function bury(item: Item, now: EpochMs): Result<Item>;
export function revive(item: Item, now: EpochMs): Result<Item>;
export function touch(item: Item, now: EpochMs): Result<Item>;   // R2.12, activity such as a note
export function editDue(item: Item, dueAt: EpochMs, zone: string, dateOnly: boolean, now: EpochMs): Result<Item>;
export function setEpitaph(item: Item, text: string, now: EpochMs): Result<Item>; // trimmed, max 280 chars, empty clears

// domain/visual.ts (pure numbers shared by the scene and the list view)
export function waxFraction(item: Item, now: EpochMs): number;    // graveyard-scene R2.1
export function flicker(item: Item, now: EpochMs): { speed: 'slow' | 'fast'; urgency: number } | null; // R2.2, R2.3
export function ghostDistance(item: Item, now: EpochMs): number;  // graveyard-scene R2.6

// domain/time.ts (temporal-polyfill)
type LocalInput = { date: string /* YYYY-MM-DD */; time?: string /* HH:mm[:ss] */; zone: string };
type Converted = { ok: true; epochMs: EpochMs; dateOnly: boolean; adjustment: 'none' | 'gap-shifted' | 'ambiguous-earlier' }
               | { ok: false; error: 'invalid-zone' | 'invalid-date' | 'invalid-time' };
export function toInstant(input: LocalInput): Converted;
export function toLocal(epochMs: EpochMs, zone: string): { date: string; time: string };
export function formatForDisplay(epochMs: EpochMs, userZone: string, sourceZone: string, locale: string): { primary: string; source?: string };

// storage/repository.ts
export interface Repository {
  list(): Promise<Item[]>;
  put(item: Item): Promise<void>;
  remove(id: string): Promise<void>;
  exportBackup(now: EpochMs): Promise<Backup>;
  importBackup(data: unknown): Promise<Result<number>>;
}
export function openRepository(): Promise<{ repo: Repository; persistent: boolean }>;
```

`adjustment` is computed by converting with `'compatible'` and comparing with `'earlier'` and `'later'`: if they differ and the wall clock of the result differs from the input, it is `gap-shifted`; if they differ and the wall clock matches, it is `ambiguous-earlier`.

## Error handling

- Domain functions never throw for expected cases; they return `Result`. Invalid zones are caught at `toInstant` (`RangeError` from Temporal is mapped to `invalid-zone`).
- Backup import validates with a hand-written schema check (no extra dependency) and returns the first failing path, for example `items[3].dueAt`.
- If `indexedDB.open` fails (private mode, disabled), `openRepository` returns an in-memory repository with `persistent: false` (R5.6).

## Correctness properties

Each property is a fast-check test in `src/domain/*.property.test.ts`. Generators: instants from 1970 to 2100, zones from the list in `deadline-domain.md`, and instants biased to within 2 h of each DST transition of the generated zone (found with `Temporal.ZonedDateTime#getTimeZoneTransition`).

| # | Property | Traces to |
|---|---|---|
| P1 | For any item, `now` and two display zones, `deriveStatus` gives the same status and formatting the instant (whole seconds) in either zone then converting back gives the same `dueAt`, except that a time inside a fall-back overlap comes back as its earlier occurrence, flagged `ambiguous-earlier` (R3.2). | R1.5, R3.1, R3.6 |
| P2 | For any unresolved item and `now1 <= now2` with no action between, `rank(phaseAt(dueAt, now1)) <= rank(phaseAt(dueAt, now2))` with rank active < due-soon < missed. | R1.1, R1.2, R1.3, R1.6 |
| P3 | For any resolved item, any later `now` and any sequence of actions, the status stays `submitted` or `buried`, every state-changing action (`submit`, `bury`, `revive`, `touch`, `editDue`) returns `resolved`, and `setEpitaph` (allowed on buried items by R2.11) never changes the resolution. | R2.1, R2.2, R2.6, R2.10, R2.11 |
| P4 | For any `dueAt` and zone (including instants next to DST transitions), the set of `now` values with phase `due-soon` is exactly `[dueAt - 86,400,000, dueAt)`, checked at both boundaries and 1 ms either side. | R1.2, R1.4 |
| P5 | For any zone and local date-time that exists exactly once in that zone, `toLocal(toInstant(x))` equals `x`; for generated gap times the result is shifted forward by the gap and flagged `gap-shifted`; for generated repeated times the result has the earlier offset and is flagged `ambiguous-earlier`. | R3.2, R3.3, R3.4, R3.5 |
| P6 | For any list of items, parsing the `.ics` produced by export returns the same uid, title, instant, zone and dateOnly for every item. (`.ics` code lives in capture-and-export; the property is listed here because it is a domain round trip.) | capture-and-export R2.1, R2.3; R3.1 |

Additional example tests: ghost threshold at exactly 7 x 24 h (R2.4), revive (R2.9), epitaph (R2.11), date-only end of day (R3.4), invalid zone (R3.7), backup round trip and rejection (R5.3 to R5.5, using `fake-indexeddb` in Node).

A purity check (R4.2) runs as a unit test that scans `src/domain/**/*.ts` (excluding tests) for `Date.now(`, `new Date()`, `performance.now(`, `Temporal.Now`, `document.`, `window.`, `localStorage` and `indexedDB`.

## Testing strategy

- Unit and property tests in Node (Vitest `environment: 'node'`), 500 runs for P1 to P3, 1000 runs for P4 and each P5 case (unique, gap, overlap).
- Storage tests use `fake-indexeddb` (to be added as a dev dependency and listed in README).
- Kiro IDE spec correctness (property extraction) will be run on this spec by the author in the IDE and compared with P1 to P6 in KIRO_USAGE.md.
