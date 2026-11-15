---
inclusion: always
---

# Product: Deadline Graveyard

## What it is

A deadline and project tracker where a moonlit graveyard is the interface. Every element in the scene encodes real state, so the spooky UI is the function, not decoration.

| Scene element | Meaning |
|---|---|
| Candle burning down in real time | An active deadline. Wax height is remaining time. The flame flickers faster in the last 24 hours (due-soon). |
| Tombstone with an epitaph | A missed deadline. The user writes what they learned. |
| Lit lantern | A submitted deadline. |
| Ghost drifting toward the viewer | A project with no activity for 7 days. The user revives it or buries it. |
| Séance | A weekly review: 3 questions whose answers become next week's plan. |

Supporting features: add from a URL (title and date pulled from the page when it exposes them, otherwise manual entry), `.ics` export, opt-in browser notifications, offline-first storage in IndexedDB with JSON backup and restore. Sync is a stretch goal and is not started.

## Who it is for

Students and builders who track many overlapping deadlines (hackathons, coursework, internship and grant applications) and lose track of which ones are close and which projects they quietly dropped.

## Why it exists (context for decisions)

- This is a Kiroween 2026 entry in the **Costume Contest** category, which is judged on the UI. Bonus targets: Best Student Project (Costume Contest), Best Demo.
- Judging is 5 criteria at 20% each: Potential Impact, Technological Implementation, Design, Innovation/Idea, Presentation. `PLAN.md` section 4 maps every feature to one criterion. When choosing between two approaches, prefer the one that serves the mapped criterion.
- Judges must be able to test everything for free, with no account and no API key. Every feature works with no network except "add from URL", which always has a manual fallback.

## Product rules

- The first visit seeds exactly 3 demo deadlines, each visibly labelled **Demo** in the scene, the list view and any export. The user can clear or keep them.
- Never fabricate users, statistics or testimonials, in the app or in any document. Demo data is always labelled as demo data.
- Sound is off by default. Motion respects `prefers-reduced-motion` and a manual toggle.
- The screen-reader list view shows the whole scene; nothing is visual-only.
- Times are shown in the user's timezone, with the deadline's own timezone shown when it differs.
- Missing a deadline should produce a lesson (the epitaph), not only a red label. Keep the tone gently spooky, never shaming.

## Out of scope

- Accounts, a backend database, push servers, analytics or tracking.
- Paid services of any kind. Free tiers only.
- Publishing, deploying, posting or submitting anything without the author's explicit go.
