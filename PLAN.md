# Deadline Graveyard: Plan

Kiroween 2026 entry. **Category:** Costume Contest. **Bonus targets:** Best Student Project (Costume Contest), Best Demo, Bonus Blog, Social Blitz.

**Status:** awaiting your approval. Nothing below the "Phase 0" line has been started.

**Hard deadline:** Fri 4 Dec 2026, 2:00 PM PT (Sat 5 Dec 2026, 03:30 IST). The rules say no extensions and no late submissions.

---

## 1. What we are building

Deadline Graveyard is a deadline and project tracker for people juggling many hackathons, courses and applications. The spooky scene is the interface: every visual element encodes real state.

| Scene element | Meaning |
|---|---|
| Candle burning down in real time | An active deadline. Wax height = remaining time. Flame flicker rate rises in the last 24 h. |
| Tombstone with your epitaph | A missed deadline. You write what you learned. |
| Lit lantern | A submitted deadline. |
| Ghost drifting toward you | A project with no activity for 7 days. Revive it or bury it. |
| Séance | A weekly review: 3 questions, answers become next week's plan. |

Supporting features: add from a URL (title and date pulled from the page when it exposes them, otherwise manual), `.ics` export, browser notifications, offline-first storage in IndexedDB, and optional sync (AWS free tier, or none).

**Who it is for:** students and builders who track many overlapping deadlines (hackathons, coursework, internship and grant applications) and lose track of which ones are close and which projects they quietly dropped.

## 2. Facts from the official rules that shape this plan

Source: [Kiroween 2026 Official Rules](https://kiroween.devpost.com/rules), read 15 Nov 2026.

- **Submission period:** 30 Oct 2026, 9:00 AM PT to 4 Dec 2026, 2:00 PM PT. All work must be built inside it. This repo's first commit is dated 15 Nov 2026, so the history fits.
- **Pre-existing work:** frameworks, libraries and starter templates are allowed but must be disclosed. README will have a "Pre-existing work" section listing every dependency, font and sound source.
- **Repo:** public GitHub (not GitLab/Bitbucket), an open-source license detectable in the About section, and `/.kiro` at the repo root. Adding `/.kiro` or any sub-folder to `.gitignore` "could disqualify your submission".
- **Working app URL** is required, free of charge and unrestricted for judges until the judging period ends (29 Jan 2027). Hosting must therefore stay up until then. **Decided:** Vercel free tier (section 5), deployed only when you say go.
- **Video:** under 3 minutes, real footage of the app running, public on YouTube, no third-party trademarks or copyrighted music without permission.
- **Kiro write-up questions** (KIRO_USAGE.md must answer all of them): Kiro IDE/CLI/Web/Crew and how they differed, custom agents, agent hooks, spec-driven vs vibe coding, steering strategy, MCP, property-based testing, Kiro powers.
- **Judging:** Stage One is pass/fail on theme fit and "insufficient use of Kiro" can disqualify. Stage Two is 5 criteria at 20% each (table in section 4).
- **Prize stacking:** a project can win one Overall prize OR one Category prize, plus any number of Bonus prizes.
- **Best Student Project:** you must name the category (Costume Contest) and provide your LinkedIn, student email, year, degree and school. Proof of enrolment may be requested. All team members must be students.
- **Best Demo:** awarded on the Presentation score, but only among submissions in the top 10% overall. Every criterion matters for it.
- **Bonus Blog:** published publicly during the submission period on a third-party platform, must say it was written as part of the Kiroween 2026 hackathon.
- **Social Blitz:** the post must start with `#KiroweenHackathon26`, be posted during the submission period, and share your favourite thing about Kiro and how it changed your approach. Judged partly on "original thoughts vs AI writing", which is why that part stays a TODO for you.
- **Kiro credits:** up to 4,000 credits via the Credit Request Form. Request deadline 1 Dec 2026, 12:00 PM PT; redeem by 4 Dec. **Status:** you have already received your credits, so no action is pending.
- **Eligibility:** age of majority where you live. India is not on the excluded list.
- **Multiple submissions** are allowed only if each is "substantially different". I found earlier plan folders for other Kiroween ideas in `.agents/tasks/` (Stitchform, Fagan's Ghost). If you enter more than one, they must stay distinct.

## 3. Repo location

**Decision: a dedicated git repo at `/Users/himanshujha/.t3/projects/kiro/deadline-graveyard/`**, published later as a GitHub repo named `deadline-graveyard`. `.kiro/` will sit at the root of this folder.

Why:
- The outer workspace repo (`/Users/himanshujha/.t3/projects/kiro`) is shared by other Kiroween plans (Stitchform, Fagan's Ghost) that write and commit their own root `PLAN.md`. While this plan was being written, another session committed this file under its own commit message. One repo per project prevents that and keeps the public repo's history and `/.kiro` about Deadline Graveyard only.
- Kiro CLI loads `.kiro/` (steering, hooks, agents, specs, MCP config) from the session's workspace root. **For hooks and steering to fire, the Kiro session must start in `deadline-graveyard/`.** The simplest way is to add `deadline-graveyard/` as its own T3 Code project (or run `kiro-cli` from inside it, and open that folder in Kiro IDE for the IDE steps).
- The repo starts fresh on 15 Nov 2026, inside the submission period. Its first commit is this plan.

Housekeeping in the first spec-phase commit:
- Add a `.gitignore` (never listing `.kiro`). The commit guard hook (section 6) checks this on every commit.
- Add `LICENSE` and a real `README.md`.

## 4. Feature to judging-criterion map

Each feature is listed under the one criterion it mainly serves.

| # | Feature | Criterion | Why it scores there |
|---|---|---|---|
| F1 | Deadline engine: state machine (active, due-soon, missed, submitted), ghost/abandoned rule, timezone and DST handling | **Potential Impact** | The core problem: "what is due, when, in my timezone". Correctness here is what makes it usable. |
| F2 | Offline-first storage (IndexedDB) with JSON backup/restore | **Potential Impact** | Works without an account or network, so judges and real users can use it immediately. |
| F3 | Add from URL (page metadata extraction via a Vercel function, manual fallback) | **Potential Impact** | Removes the friction of retyping hackathon deadlines. |
| F4 | `.ics` export | **Potential Impact** | Plays well with calendars people already use. |
| F5 | Browser notifications (opt-in) | **Potential Impact** | Reminders before a candle burns out. |
| F6 | Moonlit graveyard scene: SVG layers, parallax, fog, candles, tombstones, lanterns, ghosts | **Design** | The category is judged on the UI. One art direction, every element encodes state. |
| F7 | Design system: custom type scale, palette with WCAG AA contrast, GSAP motion, `prefers-reduced-motion` | **Design** | Polished and intentional, accessible by construction. |
| F8 | Accessibility: keyboard navigation of the scene and a screen-reader list view of the whole scene | **Design** | A complete product, not only a visual demo. Also supports Impact ("accessible"). |
| F9 | Sound (off by default, licensed or self-synthesised) | **Design** | Atmosphere without surprising anyone. |
| F10 | Séance weekly review (3 questions to a next-week plan) | **Innovation/Idea** | Turns reflection into a ritual. Rule-based by default, optional LLM via one adapter. |
| F11 | Epitaphs and ghosts as reflection on missed and abandoned work | **Innovation/Idea** | Missing a deadline produces a lesson, not just a red label. |
| F12 | 60-second first visit with 3 clearly labelled demo deadlines | **Presentation** | The video and a judge's first minute both start here. Also the backbone of the Best Demo attempt. |
| F13 | `/.kiro`: specs, steering, hooks, custom agents, MCP, PBT; KIRO_USAGE.md | **Technological Implementation** | Judges read `/.kiro`. Section 6. |
| F14 | Property-based tests for state transitions across timezones and DST, plus `.ics` round trip | **Technological Implementation** | Shows Kiro spec correctness and PBT in real use. |
| F15 | Optional sync (AWS free tier) | **Technological Implementation** | Stretch goal. Only if F1 to F12 are done and polished. |
| F16 | README, DEVPOST_STORY, VIDEO_SHOTLIST, BLOG_DRAFT, SOCIAL_POST, SUBMISSION_CHECKLIST | **Presentation** | Clear story of the problem, the audience and the build. |

## 5. Technical approach

All choices below get confirmed against official docs during the spec phase (through MCP docs servers where available). Versions and API names are not final until then.

### Stack (proposed)

- **Vite + TypeScript**, static single-page app hosted on Vercel free tier. No server required for the core experience; the only server code is the optional URL-fetch Vercel function (F3).
- **UI layer:** Preact (small, React-style components) for panels, forms and the list view. The scene itself is hand-written SVG driven by the same state. Alternative: Svelte. See open questions.
- **Motion:** GSAP. Every timeline checks `prefers-reduced-motion` and a manual "reduce motion" toggle; reduced mode swaps animation for static states and opacity changes.
- **Time:** Luxon or the Temporal polyfill for IANA timezones and DST. Picked in the spec phase after checking docs. All instants stored as UTC epoch milliseconds plus the source IANA zone.
- **Storage:** IndexedDB via a small wrapper (`idb` or Dexie, decided in spec phase).
- **Tests:** Vitest for unit tests, fast-check for property-based tests, Playwright for end-to-end, `@axe-core/playwright` for accessibility, Lighthouse CLI for performance/accessibility/best-practice scores.
- **Fonts:** SIL Open Font License fonts, self-hosted, listed in "Pre-existing work".
- **Sound:** synthesised in the browser with the Web Audio API (no third-party audio files, so no licensing risk). If any recorded sound is used it will be CC0 with the source URL and license recorded in README.

### Deadline state rules (F1, basis for PBT)

- `active`: now is before `due - 24h`.
- `due-soon`: `due - 24h` <= now < `due`. The 24 h window is absolute elapsed time, so a DST change does not stretch or shrink it.
- `missed`: now >= `due` and not submitted. Shown as a tombstone; epitaph optional and editable.
- `submitted`: marked submitted before `due`. Terminal. Shown as a lantern.
- `abandoned` (ghost): a non-terminal project with no activity for 7 days (absolute 7 x 24 h). Revive resets activity; bury converts it to a tombstone.
- Date-only deadlines are interpreted as 23:59:59 in the deadline's own timezone and flagged in the UI.
- Display is always in the user's timezone, with the source timezone shown when it differs.

Properties to test with fast-check (generated instants, IANA zones, and DST-boundary-biased times):
1. State depends only on instants, never on the display timezone.
2. As time moves forward with no user action, state never moves backwards (active -> due-soon -> missed).
3. `submitted` and buried states are terminal.
4. The due-soon window is exactly 24 h of elapsed time across DST transitions.
5. Formatting then parsing a local time round-trips, with a documented policy for non-existent (spring-forward) and repeated (fall-back) local times.
6. `.ics` export then parse returns the same deadlines.

### Add from URL (F3)

Browsers block cross-origin page reads (CORS), so the static app cannot fetch arbitrary pages directly. Plan:
- A pure, tested extractor reads `<title>`, Open Graph tags and schema.org JSON-LD `Event` dates from HTML.
- In local dev, a Vite dev-server proxy fetches the page.
- When hosted, a single Vercel function (free tier, under `api/`) does the fetch, deployed together with the static app. It accepts only `http`/`https` URLs, rejects private and loopback addresses, caps response size and timeout, and returns only the extracted fields. Exact Vercel function APIs and free-tier limits get confirmed in official docs during the spec phase. If the function fails or is unavailable, the app offers "paste page text" plus manual entry. The manual path always works.
- Optional LLM extraction for messy pages goes through the LLM adapter below.

### LLM adapter (optional, never required)

One `LlmProvider` interface with implementations for Gemini free tier, Groq free tier and local Ollama, plus a `none` provider that uses rule-based logic. Default is `none`, so judges can test everything with no key. Used only for (a) extracting a date from messy page text and (b) phrasing the Séance plan. Keys are entered by the user and stored locally, never committed.

### Notifications (F5)

Opt-in Notification API with a service worker. Without a push server, reminders are reliable only while the app or its service worker is running. The UI and README will say this plainly. No push server is planned (it would need a backend).

### Optional sync (F15, stretch)

Default is "none" plus JSON export/import. AWS free-tier sync is considered only after everything else is polished, and only after you approve and log in yourself. I will stop and give you the exact login command when that point comes.

## 6. Kiro usage plan

### Kiro CLI vs Kiro IDE

Checked against the official Kiro docs ([CLI](https://kiro.dev/docs/cli), [Specs](https://kiro.dev/docs/specs), [Correctness](https://kiro.dev/docs/specs/correctness), [Hook types](https://kiro.dev/docs/hooks/types), [Custom agents](https://kiro.dev/docs/custom-agents), [Steering](https://kiro.dev/docs/steering), [MCP](https://kiro.dev/docs/mcp), [Powers](https://kiro.dev/docs/powers)). Installed CLI: `kiro-cli 3.2.1`, which defaults to the V3 harness.

| Kiro feature | Kiro CLI (V3) | Where we run it |
|---|---|---|
| Feature and bugfix specs (requirements, design, tasks) | Yes | CLI |
| Spec "Analyze Requirements" | Yes | CLI |
| **Spec correctness (property extraction and PBT generation from EARS requirements)** | **No, IDE only** | **You, in Kiro IDE** |
| Markdown Review (comment on spec passages) | Documented with an IDE button | Optional, Kiro IDE |
| Steering files and inclusion modes | Yes (full in V3) | CLI |
| "Generate Steering Docs" button | No, IDE only | Not needed; files are written directly |
| Hooks: PostFileSave, FileCreate, Pre/PostToolUse, Pre/PostTaskExecution, SessionStart, Stop | Yes in V3 | CLI |
| Manual hooks | Listed but cannot be invoked in CLI | Not used |
| Prompt Submit hook blocking a prompt | IDE only | Not used |
| Custom agents (`.kiro/agents/`) | Yes | CLI |
| MCP servers (local and remote) | Yes | CLI |
| Powers (install and use) | Yes in V3 | CLI |

Steps you will need to run in the Kiro IDE:
1. **Spec correctness / PBT for the deadline-engine spec.** Open this repo in Kiro IDE, open `.kiro/specs/deadline-engine/`, run the design phase's property extraction and the generated property tests. I will write fast-check tests from the CLI regardless; this step lets KIRO_USAGE.md honestly describe Kiro's own PBT feature and compare it with the hand-specified properties.
2. Optional: try Markdown Review on one spec so KIRO_USAGE.md can compare IDE and CLI.

One thing to verify early: T3 Code drives Kiro CLI over ACP. Kiro's docs say file hooks fire on agent saves in CLI V3; the first spec-phase task adds a trivial hook and confirms it actually fires in your T3 Code session before we rely on it.

### `/.kiro` layout

```
.kiro/
  steering/
    product.md            (always) audience, problem, judging goals
    tech.md               (always) stack, free-tier and no-guessing rules
    structure.md          (always) folders, naming, test placement
    deadline-domain.md    (fileMatch src/domain/**) state rules, timezone/DST policy
    graveyard-design.md   (fileMatch src/scene/**, src/ui/**) art direction, type scale, motion, a11y
  specs/
    deadline-engine/      requirements.md (EARS), design.md, tasks.md
    graveyard-scene/
    accessible-list-view/
    capture-and-export/   add from URL, .ics, notifications
    seance/
    first-visit/
    sync/                 (only if F15 goes ahead)
  hooks/
    tests-on-save.json
    commit-guard.json
    a11y-lighthouse-on-build.json
    doc-sync.json
  agents/
    design-review.md
    spec-keeper.md
  settings/
    mcp.json
```

### Hooks (at least 3 doing real work)

| Hook | Trigger | Action |
|---|---|---|
| `tests-on-save` | PostFileSave, matcher `src/.*\.(ts|tsx)$` | Command: run Vitest on tests related to the saved file; failures go back to the agent. |
| `commit-guard` | PreToolUse, matcher `shell` | Command script reads the tool input from STDIN. If it is a `git commit`, it runs typecheck, lint and tests, fails if `.gitignore` mentions `.kiro`, fails if `LICENSE` is missing, and scans staged files for secret patterns. A non-zero exit blocks the tool call (documented behaviour for PreToolUse). |
| `a11y-lighthouse-on-build` | PostToolUse, matcher `shell` | Command script acts only when the command was `npm run build`: serves `dist/`, runs axe (via Playwright) and Lighthouse, writes `reports/` JSON and appends scores to the agent context. |
| `doc-sync` | PostTaskExecution | Agent prompt: update KIRO_USAGE.md and README sections affected by the finished spec task. |

### Custom agents

- **`design-review`**: read-only file access plus the Playwright MCP server. Loads `graveyard-design.md` and `product.md` as resources (the docs say custom agents do not load steering automatically). Opens the running app, screenshots both motion modes, checks contrast, focus order and the list view, and writes a dated review to `docs/design-reviews/`.
- **`spec-keeper`**: checks that every EARS requirement has a task and a test, and that tasks.md checkboxes match the code. Runs before each phase ends.

### MCP servers (at least 1 that genuinely helps)

- **Playwright MCP**: lets the design-review agent drive and screenshot the real app.
- **A docs server** for confirming APIs (for example Context7 for GSAP, Luxon, fast-check, Vite; AWS Documentation MCP only if F15 goes ahead). Exact servers and their free usage terms get confirmed in the spec phase.

### Powers

Browse the Kiro powers registry in the spec phase for anything relevant (testing, accessibility, hosting). Install only with your approval, and record in KIRO_USAGE.md which ones were used and what they changed, or that none fitted.

### KIRO_USAGE.md

Created in the spec phase and updated after every task (enforced by the `doc-sync` hook). It answers every write-up question from the rules, and reports Lighthouse and axe scores exactly as measured, including bad ones.

## 7. Phases, order and commits

Every task ends with a commit. Nothing is pushed, deployed, posted or submitted without your explicit "go".

| Phase | Target dates (IST) | Work |
|---|---|---|
| 0. Plan | 15 Nov | This file. **Stop for approval.** |
| 1. Spec | 16 to 18 Nov | `.gitignore`, LICENSE, steering (4+1 files), hooks (with the ACP smoke test), custom agents, MCP config, all specs with EARS requirements, designs and tasks. **IDE step:** spec correctness for deadline-engine. |
| 2. Implementation | 19 to 28 Nov | deadline-engine and storage (19 to 21), graveyard scene and design system (22 to 25), accessible list view and keyboard nav (25), capture and export and notifications (26), Séance (27), first visit (28). |
| 3. Tests | alongside phase 2, hardening 29 Nov | Unit, property-based and end-to-end tests; axe and Lighthouse runs recorded. |
| 4. Polish | 29 Nov to 1 Dec | design-review agent passes, reduced-motion pass, performance. (Kiro credits already received, so the 1 Dec credit request deadline needs no action.) |
| 5. Docs | 1 to 2 Dec | README, KIRO_USAGE, DEVPOST_STORY, VIDEO_SHOTLIST, BLOG_DRAFT, SOCIAL_POST, SUBMISSION_CHECKLIST. |
| 6. Your steps | 2 to 4 Dec | You say go for the Vercel deploy (and log in to Vercel yourself), record the video, publish blog and social post, fill the Devpost form. I prepare everything; you submit. |

F15 (sync) is attempted only if phases 2 to 4 finish early.

## 8. Deliverables

- **README.md**: what it is, who it is for, how to run, how to test, working app URL placeholder (Vercel), how to run the URL-fetch function locally, "Pre-existing work" section.
- **KIRO_USAGE.md**: every write-up question from the rules, honest scores.
- **DEVPOST_STORY.md**: honest story, demo data labelled as demo data, no invented users or stats.
- **VIDEO_SHOTLIST.md**: under 3:00, real footage, no copyrighted music.
- **BLOG_DRAFT.md**: states it was written for the Kiroween 2026 hackathon.
- **SOCIAL_POST.md**: starts with `#KiroweenHackathon26`; your favourite thing about Kiro left as a TODO for you.
- **SUBMISSION_CHECKLIST.md**: Costume Contest, Best Student Project (Costume Contest) details to provide, Best Demo, Bonus Blog, Social Blitz, Kiro credits (already received), Vercel deployment kept reachable for judges until 29 Jan 2027, and everything from section 2.
- **LICENSE**: OSI license (MIT proposed).

## 9. Guardrails

- Brand-new code only; every library, font and sound source listed under "Pre-existing work".
- Free tiers only. LLM use is optional, behind one adapter, with a no-LLM default.
- Demo data is labelled "Demo" in the UI, in exports and in the video.
- No fabricated users, stats or testimonials anywhere.
- Every API confirmed in official docs before use.
- Any login (GitHub, AWS, Vercel) stops work and I hand you the exact command.

## 10. Open questions for you

1. **Repo location:** OK with the dedicated `deadline-graveyard/` repo (section 3)? If yes, please add that folder as its own T3 Code project so Kiro sessions start there, or tell me if you prefer it somewhere else.
2. **License:** MIT, or Apache-2.0?
3. **UI layer:** Preact (proposed) or Svelte?
4. ~~**Hosting when you say go:**~~ **Resolved:** Vercel free tier, with the URL-fetch Vercel function. Deploy still waits for your go, and it must stay up until 29 Jan 2027.
5. **Sync:** keep it as a stretch goal, or drop it and ship "none plus JSON export"?
6. **Student details:** you will need your LinkedIn, student email, year, degree and school for Best Student. Do you have all of these, and is everyone on the team a student?
7. ~~**Kiro credits:**~~ **Resolved:** you have already received your credits.
8. ~~**Kiroween 2025:**~~ **Resolved:** you did not register for Kiroween 2025, so Best Ghost of Kiroween Past is not targeted.
9. **Other entries:** are you also submitting Stitchform or Fagan's Ghost? They must stay substantially different from this one.
