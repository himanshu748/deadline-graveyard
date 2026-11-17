# How Kiro was used

This file answers the Kiro write-up questions from the [Kiroween 2026 rules](https://kiroween.devpost.com/rules). It is updated after every task. Anything marked "not yet" has not happened; nothing here is claimed before it is done.

Everything Kiro reads lives in [`/.kiro`](.kiro) at the repo root, and `.gitignore` never mentions it (the commit-guard hook enforces this).

## Kiro surfaces used (IDE, CLI, Web, Crew)

- **Kiro CLI** (`kiro-cli 3.2.1`, V3 harness), driven from T3 Code over ACP. Used for the plan (`PLAN.md`), the scaffold, and the whole `/.kiro` directory: steering, specs, hooks, custom agents and MCP config. The CLI also validated both custom agents (`kiro-cli agent validate --path ...`) and listed them (`kiro-cli agent list`).
- **Kiro IDE:** not yet. Needed for spec correctness (property extraction from EARS requirements), which the docs list as IDE only. See [Steps for the user](#steps-for-the-user).
- **Kiro Web and Crew:** not used.

How the CLI and IDE differ for this project, from the docs pages listed at the end:

| Feature | CLI V3 | IDE | Used here |
|---|---|---|---|
| Feature specs (requirements, design, tasks) | Yes | Yes | CLI |
| Spec correctness (PBT extraction) | No | Yes | IDE step, not yet done |
| Steering inclusion modes (always, fileMatch, manual, auto) | Yes (full in V3) | Yes | CLI |
| File hooks (PostFileSave, PostFileCreate), task hooks (PostTaskExec), tool hooks, SessionStart | Yes in V3 | Yes | Hook files written; firing under ACP not yet verified |
| Custom agents in `.kiro/agents/` | Yes | Yes | CLI |
| Workspace MCP (`.kiro/settings/mcp.json`) | Yes | Yes | CLI |
| Powers | Install by name or path (`kiro-cli powers install`) | Install and browse | Checked, none installed |

## Spec-driven vs vibe coding

The plan came first and was approved before any code. Then, in the spec phase, every feature got a spec in [`.kiro/specs/`](.kiro/specs) before implementation:

| Spec | Requirements (EARS) | Judging criterion |
|---|---|---|
| [deadline-engine](.kiro/specs/deadline-engine) | 34 (state machine, ghosts, timezones and DST, purity, storage) | Potential Impact, Technological Implementation |
| [graveyard-scene](.kiro/specs/graveyard-scene) | 27 (SVG layers, parallax, fog, candles, tombstones, lanterns, ghosts, GSAP, reduced motion, sound) | Design |
| [accessible-list-view](.kiro/specs/accessible-list-view) | 17 (keyboard navigation, list view of the whole scene, focus, announcements) | Design |
| [capture-and-export](.kiro/specs/capture-and-export) | 24 (add from URL with SSRF guards, paste text, manual entry, `.ics`, notifications, backup UI, LLM adapter) | Potential Impact |
| [seance](.kiro/specs/seance) | 12 (3 questions to next week's plan, rule-based by default) | Innovation/Idea |
| [first-visit](.kiro/specs/first-visit) | 15 (60-second intro, 3 labelled Demo deadlines showing all five states) | Presentation |
| [sync](.kiro/specs/sync) | 7, marked **not started, stretch** | Technological Implementation |

Each `requirements.md` has user stories and numbered EARS acceptance criteria (`R1.1` ...). Each `design.md` has architecture, data model, interfaces, error handling and a testing strategy. Each `tasks.md` lists checkbox tasks that cite requirement IDs; every requirement ID is cited by at least one task (checked by counting IDs in both files). The deadline-engine design lists six correctness properties (P1 to P6), each traced to requirement IDs.

How the specs were made, honestly: the agent wrote the three files per spec directly from the approved `PLAN.md` and the steering files, in Kiro's spec format, in one CLI session. Kiro's interactive spec workflow with approval gates and "Analyze Requirements" has not been run on them yet.

Implementing deadline-engine tasks 1 to 7 against the spec showed three gaps, fixed in the spec in the same commits as the code: the steering file says notes and due-date edits count as activity but the requirements had no criterion for it (added R2.12 `touch` and R2.13 `editDue`); a bare `Result<number>` for backup import could not carry the failing field path that R5.4 asks for (now `Result<number, BackupError>` with `path`); and P3 said every action on a resolved item is rejected, which contradicted R2.11 (epitaphs on buried items), so P3 now covers state-changing actions only. Task 8 (Kiro IDE Correctness) is still open.

Implementing graveyard-scene tasks 1 to 5 and accessible-list-view tasks 1 to 7 also changed both designs, in the same commits: `layoutScene` returns a `SceneLayout` (the scene grows taller instead of overlapping items, which a fast-check property checks), `createTimeline` became `startAmbient` / `motionPlan` because `gsap.matchMedia` cannot be overridden by a manual toggle, narrow screens scroll the scene sideways (one of the two options R1.5 allows), and the Playwright reduced-motion check samples the flame's `transform` attribute because the page cannot reach the bundled GSAP instance. A happy-dom test found that Preact writes SVG attributes verbatim, so the roving `tabIndex` attribute on SVG `<g>` items was ignored; it is now the lowercase `tabindex`, and the design notes why. Graveyard-scene tasks 6 (50-item performance pass) and 7 (design-review agent) are left for the polish phase.

Implementing capture-and-export tasks 1 to 8 changed that design too, each change written into its design.md as "Change from the first draft": timed `.ics` events use the UTC `DTSTART` form and carry the zone in `X-DG-TZID`, because RFC 5545 says a `TZID` parameter must point at a `VTIMEZONE` in the same file and the app does not write those; the page fetch uses `node:http` with a lookup pinned to the already-checked addresses instead of global `fetch`, which closes the DNS-rebinding gap the first draft listed as a known limit; a page over 1 MB is cut at 1 MB instead of refused (title and JSON-LD sit in `<head>`), so the `too-large` error was dropped; the Groq default model moved from `llama-3.1-8b-instant` to `openai/gpt-oss-20b` because Groq's models page now lists the former as Enterprise; and a local `vercel build` (no login, no deploy) showed the function only loads on Vercel with `rewriteRelativeImportExtensions` on, so `tsconfig.json` sets it. Task 4's tabs became buttons inside the add form so the manual fields never hide.

Implementing seance tasks 1 to 5 changed its design as well, written into [seance design.md](.kiro/specs/seance/design.md) as "Change from the first draft": plan steps carry a `demo` flag and a section (keep, due, let-go, lessons) so the Demo label survives into every view and the plan text; the LLM guard checks that the titles appear in plan order, and the rephrased text is shown beside the rule-based steps instead of replacing them, so the buttons always come from the rules; and the whole history is one settings value, so backups carry it with no new code.

Implementing first-visit tasks 1 to 6 changed its design too, written into [first-visit design.md](.kiro/specs/first-visit/design.md) as "Change from the first draft": the step machine and captions moved to a pure `steps.ts`; the steps take 9, 8, 10, 11 and 11 s (49 s) and a Pause button holds them, because auto-advancing content needs a way to stop it (WCAG 2.2.2); the "camera" is a GSAP spotlight, a pointer ring and a page scroll rather than a zoom; Skip keeps the demo items and a note with **Clear demo** stays above the scene while they exist; and the first axe scan with the demo titles found a real label-in-name problem in the scene (see [Lighthouse and axe scores](#lighthouse-and-axe-scores)), fixed by moving the scene's visible text out of its button elements.

Vibe coding so far: only the scaffold (config files and a placeholder page) was written without a spec.

## Steering strategy

Five files in [`.kiro/steering/`](.kiro/steering), using the front-matter syntax from the steering docs:

| File | Inclusion | What it does |
|---|---|---|
| [product.md](.kiro/steering/product.md) | `always` | Audience, what each scene element means, judging goals, product rules (Demo labels, no fabrication, sound off, reduced motion). |
| [tech.md](.kiro/steering/tech.md) | `always` | Stack and why each library was chosen (for example Temporal over Luxon for explicit DST disambiguation), and hard rules: confirm APIs in docs, free tiers only, one LLM adapter with a no-LLM default, no secrets, never ignore `.kiro`, never deploy or publish without a go. |
| [structure.md](.kiro/steering/structure.md) | `always` | Folder layout, naming, import direction, test placement, requirement-ID convention in tests. |
| [deadline-domain.md](.kiro/steering/deadline-domain.md) | `fileMatch` on `src/domain/**`, `src/storage/**`, domain and property tests | State rules, precedence, user actions, invariants, the DST policy (verified with temporal-polyfill: spring-forward gaps shift forward, fall-back repeats take the earlier offset), the date-only rule and the no-`Date.now()` rule. |
| [graveyard-design.md](.kiro/steering/graveyard-design.md) | `fileMatch` on `src/scene/**`, `src/ui/**`, styles, `index.html`, `e2e/**` | Art direction, palette with contrast ratios computed with the WCAG formula (every text colour pair is 6.36:1 or higher; the shapes-only tombstone fill is as low as 3.14:1 and is never used for text), type scale (ratio 1.25, base 18 px) with two OFL fonts, GSAP motion and reduced-motion policy, keyboard and list-view rules, sound off by default. |

The idea: the always-on files are short and hold rules that apply everywhere; the heavy domain and design detail loads only when Kiro works on matching files. Custom agents do not load steering automatically (per the steering docs), so both agents list the steering files they need as `resources`.

## Agent hooks

Five hook files in [`.kiro/hooks/`](.kiro/hooks), in the documented `version: "v1"` format with PascalCase triggers. Every command hook calls a Node script in [`scripts/hooks/`](scripts/hooks) that also runs standalone, and the pure parts are unit-tested in [`tests/hooks/`](tests/hooks) (35 tests, passing under `npm test`).

| Hook file | Trigger and matcher | What it does | Verified |
|---|---|---|---|
| [tests-on-save.json](.kiro/hooks/tests-on-save.json) | `PostFileSave`, `src/.*\.(ts\|tsx)$` | Runs `vitest related --run` for the saved file using the `{{filePath}}` template variable (falls back to STDIN fields). Exit 1 with the failure output on failing tests, so Kiro returns it to the agent. | Run by hand: passes for `src/ui/App.tsx`, exits 1 for a deliberately failing temporary test, skips non-source files. |
| [commit-guard.json](.kiro/hooks/commit-guard.json) | `PreToolUse`, `shell` | Reads the hook event from STDIN, acts only on `git commit`. Blocks with exit 2 (the documented blocking code) if any `.gitignore` line mentions kiro, `LICENSE` is missing, a real `.env` file is staged, a secret is in the staged diff (AWS keys, Google `AIza`, Groq `gsk_`, Context7 `ctx7sk-`, GitHub tokens, private key blocks), or typecheck, lint or tests fail. | Unit tests plus integration tests against throwaway git repos: exit 2 for `.kiro` in `.gitignore`, missing LICENSE, staged `.env` and staged key; exit 0 for a clean repo. Run by hand on this repo with full checks: exit 0. |
| [a11y-lighthouse-on-build.json](.kiro/hooks/a11y-lighthouse-on-build.json) | `PostToolUse`, `shell` | Acts only on `npm run build`. Runs `scripts/audit.mjs` (axe and Lighthouse against `dist/`). The script serves the built app on its own port, records mobile/desktop Lighthouse and normal/reduced-motion axe scans, and fails on scan errors or serious/critical violations. | Script implemented and unit-tested; automated Kiro invocation remains unverified. |
| [doc-sync.json](.kiro/hooks/doc-sync.json) | `PostTaskExec` | Agent prompt: after a spec task, tick its checkbox only if done and tested, update this file and README with what actually happened, never invent numbers. | Not yet triggered (no spec task has run). |
| [hook-smoke.json](.kiro/hooks/hook-smoke.json) | `SessionStart`; `PostFileSave` on `src/` | Appends a timestamped line to `reports/raw/hook-smoke.log` (gitignored, outside `.kiro`) so the author can see whether hooks fire under ACP. | Script run by hand. Firing inside a real Kiro session: not yet checked. |

Known limits, stated plainly:
- The docs show the STDIN payload for an MCP tool but not the `tool_input` field names for `execute_bash`, so the scripts read `tool_input.command` and fall back to the first string field.
- When one command both stages and commits (`git add x && git commit`), the guard also scans unstaged tracked changes and checks untracked file names, but it does not read untracked file contents.
- Whether hooks fire when T3 Code drives `kiro-cli` over ACP is not verified yet. This session started before the hook files existed, so its own commits were not guarded by the hook; the guard was run by hand before committing.
- The guard's test step found a real problem on 16 Nov 2026: under full parallel load on a busy machine (load average above 20 on 10 cores), two to six of the heavier fast-check properties ran for up to 18 s against Vitest's 5 s default timeout, so `npm test` failed and the guard would refuse the commit even though each property passes alone in under 1 s. The fix is a 60 s suite `testTimeout` in `vite.config.ts` ([Vitest docs](https://vitest.dev/config/testtimeout)); no property's `numRuns` was lowered, and `structure.md` now says never to lower it to fit a timeout.

## Custom agents

Two agents in [`.kiro/agents/`](.kiro/agents), JSON format from the agent configuration reference, both validated with `kiro-cli agent validate --path` (exit 0; a deliberately broken file exits 1) and listed by `kiro-cli agent list` as workspace agents in v3 format.

| Agent | Tools | Write access | Purpose |
|---|---|---|---|
| [design-review](.kiro/agents/design-review.json) | `read`, `write`, `shell`, `@playwright` (via `includeMcpJson`) | `fs_write` allowed only for `docs/design-reviews/**`, denied elsewhere; shell limited to `npm run build`, `npm run preview*`, `git log*`, `git status*` | Builds and serves the app, screenshots normal and reduced-motion modes with Playwright MCP, checks contrast, focus order, keyboard use, list view parity, sound off, type scale, and writes a dated review. Loads `graveyard-design.md`, `product.md` and two specs as resources. |
| [spec-keeper](.kiro/agents/spec-keeper.json) | `read`, `write`, `shell` | Only `docs/spec-reports/**`; shell limited to `npm test`, `npx vitest list*`, `git log*`, `git ls-files*` | Checks that every EARS requirement maps to a task and a test, that P1 to P6 have property tests, and that ticked tasks have code; writes a dated report with the exact test summary. |

Neither agent has run yet: there is no UI to review and no feature code to trace.

## MCP

Workspace config: [`.kiro/settings/mcp.json`](.kiro/settings/mcp.json).

| Server | Config | Why it helps | Checked |
|---|---|---|---|
| Playwright MCP | `npx -y @playwright/mcp@0.0.85 --headless --isolated --viewport-size 1280x800 --output-dir reports/raw/playwright-mcp` (package and flags from the [official README](https://github.com/microsoft/playwright-mcp), Apache-2.0) | Lets the design-review agent drive the real app, emulate reduced motion (`browser_emulate_media`) and take screenshots. | Started it over stdio and sent `initialize` and `tools/list`: it answered with 25 tools including `browser_take_screenshot` and `browser_emulate_media`. |
| Context7 | Remote `https://mcp.context7.com/mcp`, no key | Up-to-date library docs for confirming APIs (GSAP, Temporal, idb, fast-check, Vite) before use, as `tech.md` requires. | Context7 docs say a free API key is only recommended for higher rate limits and coding agents do not need one; an `initialize` POST to the URL returned HTTP 200. If rate limits bite, add `"headers": { "Authorization": "Bearer ${CONTEXT7_API_KEY}" }` and approve that variable in Kiro's MCP approved env vars setting. |

`kiro-cli mcp list` shows both servers. Neither has been used from a Kiro agent session yet. The docs behind the capture work (Vercel, Gemini, Groq, Ollama, MDN, RFC 5545) were checked by fetching the official pages directly, listed with dates in [capture-and-export design.md](.kiro/specs/capture-and-export/design.md#docs-relied-on), not through Context7.

## Property-based testing

fast-check 4.10.2 drives all six properties in [deadline-engine design.md](.kiro/specs/deadline-engine/design.md). Each test title starts with its property number and a `// Validates:` comment names the EARS requirement IDs.

| Property | Test | Runs | What it checks |
|---|---|---|---|
| P1 | [status.property.test.ts](src/domain/status.property.test.ts) | 500 | Status does not depend on the zone, and rendering `dueAt` as wall-clock time in any zone then converting back returns the same instant (a fall-back repeat returns its earlier occurrence, flagged). R1.5, R3.1, R3.6 |
| P2 | same file | 500 | With no action, phase never moves backwards as `now` grows, and missed stays missed. R1.1 to R1.3, R1.6 |
| P3 | same file | 500 | Submitted and buried items stay terminal across random action sequences at later instants; every state-changing action returns `resolved`. R2.1, R2.2, R2.6, R2.10, R2.11 |
| P4 | same file | 1000 | The due-soon window is exactly `[dueAt - 86,400,000 ms, dueAt)`, checked at both edges and 1 ms either side, with `dueAt` biased to within 2 h before and 26 h after real DST transitions. R1.2, R1.4 |
| P5 | [time.property.test.ts](src/domain/time.property.test.ts) | 1000 x 3 | Wall-clock round trip for times that exist once; spring-forward gap times shift forward by the gap (`gap-shifted`); fall-back repeats take the earlier offset (`ambiguous-earlier`). R3.2, R3.3, R3.5 |
| P6 | [ics.property.test.ts](src/capture/ics.property.test.ts) | 300 | Exporting up to 8 random items to `.ics` and parsing the file with the app's own parser returns the same uid, title, instant, zone, date-only flag and demo flag. Titles are full of `,`, `;`, `\`, newlines, emoji and other multi-byte text; items are timed or date-only in the ten test zones. A second property (100 runs) checks that no line is longer than 75 octets. capture-and-export R2.3, R2.4 |

One more property guards storage: [repository.test.ts](src/storage/repository.test.ts) generates up to 15 items and 5 settings (50 runs), exports them from one fake IndexedDB, restores the backup file text into another that already holds different data, and checks the next export is equal (R5.5). It passed on its first run.

Two more properties guard the UI: [layout.property.test.ts](src/scene/layout.property.test.ts) (300 runs each, up to 60 random items at a random instant) checks that no two scene slots overlap and every slot stays inside the view (graveyard-scene R1.5), and that the scene and the list view hold the same ids with the same statuses (accessible-list-view R1.1). Mutation check: shrinking the slot spacing in `layoutScene` to 0.9 slot widths made the overlap property fail at once with two buried items as the counterexample; the change was reverted. [motion.test.ts](src/scene/motion.test.ts) checks with fast-check that parallax never moves the far layer more than 12 px for any pointer and scroll input (R1.2).

The add-from-URL guard has its own properties in [url-guard.property.test.ts](src/capture/url-guard.property.test.ts) (100 runs each): `isPublicAddress` never accepts a generated address from the private, loopback, link-local (including cloud metadata `169.254.169.254`), CGNAT, multicast or reserved IPv4 ranges, nor the same addresses in IPv4-mapped IPv6 form, nor any `fc00::/7` or `fe80::/10` address, and it never throws on arbitrary strings (capture-and-export R1.4). Table tests next to it cover the exact addresses the plan names (`127.0.0.1`, `10.x`, `169.254.169.254`, `::1`, `fc00::1`) and non-http schemes (`file:`, `ftp:`, `javascript:`, `data:`, `gopher:`).

The Séance planner has seven properties in [plan.property.test.ts](src/seance/plan.property.test.ts) (300 runs each, up to 10 random items, answers that mix real ids with ids that match nothing): `buildPlan` never invents a deadline (every step is a given item with its own title, due time and Demo flag, at most once), always includes every due-soon item and every open item due within 7 days, puts every open Q3 pick before any other step, plans epitaphs only for bare graves picked in Q2, suggests revive or bury for Q1 ghosts by the Q3 rule, and gives the same plan for the same inputs in any storage order; `candidatesFor` lists every due-soon item and ghost for Q1 and exactly the open items for Q3 (seance R1.1, R1.3, R2.1 to R2.3). Mutation check: letting due-soon items jump ahead of the Q3 picks made the Q3-first property fail after 208 runs (seed 1059533962) while the other six still passed; the change was reverted.

The first-visit demo data has three properties in [demo-seed.property.test.ts](src/ui/intro/demo-seed.property.test.ts), over up to 25 generated items with random Demo flags: `clearDemo` removes exactly the demo items and keeps every other item unchanged and in order (300 runs), it is idempotent, and `withDemo` always leaves exactly the 3 freshly seeded demo items next to every user item and changes nothing when repeated (200 runs) (first-visit R2.5, R2.6). The example tests next to it check the seeded statuses with the real `deriveStatus` (A ghost, B due-soon, C missed). Mutation check: making `clearDemo` keep resolved demo items left all 12 example tests passing, while two properties failed after 1 run each with a single submitted demo item as the counterexample (seed 241040225); the change was reverted.

Generators live in [arbitraries.ts](src/domain/arbitraries.ts): instants from 1970 to 2100, ten zones (Los Angeles, New York, London, Sydney, Sao Paulo, Santiago, Lord Howe with its 30-minute DST, Kathmandu at +05:45, Kolkata and UTC as no-DST controls), and real transitions found with Temporal's `getTimeZoneTransition('next')`.

**Bugs found by the properties:** none in the engine so far. All five engine properties passed on their first run. P6 and the URL-guard properties pass now; the earlier sessions that wrote them did not record whether they failed first, so no claim is made either way.

**Mutation check (does P4 have teeth?):** I temporarily replaced the due-soon start in `deriveStatus` with wall-clock arithmetic (`dueAt` in the item's zone minus one calendar day via Temporal `subtract({ days: 1 })`). P4 failed at once with counterexample `{ zone: 'Australia/Sydney', ms: 57686400000 }` (31 Oct 1971, a DST start), seed 73275414. P1 to P3 and every example test in `status.test.ts` still passed, so only the DST-biased property caught it. The mutation was reverted.

Kiro IDE's own property extraction (spec Correctness) has not been run yet; see [Steps for the user](#steps-for-the-user).

## Kiro powers

Checked on 15 Nov 2026. `kiro-cli powers --help` offers only `install` and `uninstall` (by catalog name or local path); there is no list or search subcommand. The [powers registry](https://kiro.dev/powers) lists 158 powers. None was installed, and none was needed so far: the two MCP servers above cover browser automation and docs. The registry's BrowserStack power mentions accessibility scans but needs a BrowserStack account, so it was not considered further.

## Lighthouse and axe scores

Lighthouse: not run yet.

axe (Playwright 1.65.1 Chromium, @axe-core/playwright 4.14.0, 15 Nov 2026): `e2e/a11y.spec.ts` adds two deadlines through the form, submits one, and finds zero violations in the scene view, the list-only view and the open add-deadline dialog. The same file checks keyboard navigation (one Tab stop, arrow keys, Enter opens, Escape returns focus), the skip link, and that flames stay still under `prefers-reduced-motion: reduce`. These runs start from an empty graveyard (the first-visit intro is skipped and its demo cleared first, through `e2e/helpers.ts`) and cover two to three items, not a full graveyard.

`e2e/capture.spec.ts` (16 Nov 2026) blocks every request that leaves the local preview server, then finds zero axe violations in the add dialog after the paste-text fallback has filled in the date, time and zone, and zero in the Export and settings dialog; it also checks that the downloaded `.ics` holds the saved deadline. Full e2e run on 16 Nov 2026: 7 of 7 passed.

`e2e/seance.spec.ts` (16 Nov 2026) adds a missed, a due-soon and an active deadline through the form, then runs a whole séance with the keyboard only (Tab, Space, typing, Enter, Escape): a skipped question, Back, a finished plan in the expected order, and an epitaph that is engraved only after its confirmation. Its axe test scans the Séance dialog at each of the three questions, the plan and the open confirmation, with normal and with reduced motion, and fails on serious or critical violations. A one-off run with the filter removed found zero violations of any impact. Full e2e run on 16 Nov 2026: 10 of 10 passed.

`e2e/first-visit.spec.ts` (16 Nov 2026) opens a fresh browser context, so each test is a first visit with 3 seeded demo deadlines. A passive viewer in full motion saw the 5 captioned steps in order and reached the keep-or-clear question 49.3 s after the panel opened, in real time with no fake clock (the test fails above 60 s). Other tests cover Skip intro, Escape, replay from the menu, reduced motion (still on step 1 after 12.5 s, every step on Next), accepting and declining the revive and lantern invitations, Clear demo, focus after the intro, Demo labels in the list view and `[Demo]` on every event of the downloaded `.ics`. axe scans the page with the intro open at step 1 (both motion modes), at the ghost step and at the closing question, and fails on serious or critical violations; `e2e/smoke.spec.ts` scans the first visit with and without the intro and fails on any violation. The first of these scans failed: axe `label-content-name-mismatch` (serious, WCAG 2.5.3) on all 3 scene items, because a truncated title, the Demo badge and the engraved epitaph inside each scene button were not part of its accessible name. Earlier scans had only used short titles, so the problem had been there unseen. The visible text now sits in an `aria-hidden` layer next to each button, and the scans pass. One full run also failed the Séance keyboard test: it pressed Enter twice without waiting for focus to reach the confirmation, a race that showed up under the extra load of the 50 s tour running in parallel; the test now waits for that focus first. Full e2e run on 16 Nov 2026: 15 of 15 passed.

## Steps for the user

These need you, either because they are IDE only or because they need a fresh Kiro session. **All are NOT YET DONE.**

1. **Spec correctness in Kiro IDE (NOT YET DONE).** Open the `deadline-graveyard` folder (not the parent `kiro` folder) in Kiro IDE. Open `.kiro/specs/deadline-engine/`. In the design phase, run property extraction ("Correctness" / property-based testing) and let Kiro generate the property tests. Then tell me which properties it extracted so I can compare them with P1 to P6 here, and keep or discard the generated tests.
2. **ACP hook smoke test (NOT YET DONE).** Start a new Kiro session in T3 Code with `deadline-graveyard` as the project folder. Ask Kiro to make a trivial edit to a file under `src/` (for example add and remove a blank line in `src/ui/App.tsx`). Then check:
   - `reports/raw/hook-smoke.log` has a new `SessionStart` line and a `PostFileSave` line with the file path.
   - The agent's context shows `tests-on-save: related tests for src/ui/App.tsx passed`.
   - Optionally ask Kiro to run `git commit` with nothing staged and see whether `commit-guard` runs.
   If no lines appear, hooks do not fire over ACP in this setup, and the same check should be repeated with `kiro-cli` run directly in a terminal inside `deadline-graveyard/`.
3. **Optional: Analyze Requirements (NOT YET DONE).** Available in CLI and IDE. Run it on `deadline-engine` and record what it found here.

## Kiro docs relied on

Fetched as raw Markdown (`.md` suffix) on 15 Nov 2026:

- [Steering](https://kiro.dev/docs/steering.md): front matter, inclusion modes, custom agents need steering in `resources`.
- [Specs](https://kiro.dev/docs/specs.md), [Feature specs](https://kiro.dev/docs/specs/feature-specs.md), [Correctness](https://kiro.dev/docs/specs/correctness.md): file set, EARS format, PBT is IDE only.
- [Hooks](https://kiro.dev/docs/hooks.md), [Hook types](https://kiro.dev/docs/hooks/types.md), [Hook actions](https://kiro.dev/docs/hooks/actions.md), [Hook examples](https://kiro.dev/docs/hooks/examples.md), [IDE 1.0 hook schema](https://kiro.dev/docs/ide/whats-new-v1/hooks.md), [CLI V3 hooks migration](https://kiro.dev/docs/cli/v3/hooks-migration.md): file schema, trigger names (`PostFileSave`, `PostTaskExec`, `PreToolUse`, `PostToolUse`, `SessionStart`), matchers, `{{filePath}}`, exit code 2 blocks PreToolUse.
- [Custom agents](https://kiro.dev/docs/custom-agents.md), [Agent configuration reference](https://kiro.dev/docs/custom-agents/configuration-reference.md), [Permissions](https://kiro.dev/docs/permissions.md): fields, tool selectors, capability rules with `exclude`.
- [MCP](https://kiro.dev/docs/mcp.md), [MCP configuration](https://kiro.dev/docs/mcp/configuration.md): `mcpServers` schema, env var expansion and approval.
- [Powers](https://kiro.dev/docs/powers.md), [Install powers](https://kiro.dev/docs/powers/installation.md).

## Codex continuation — 17 November 2026

After Kiro reported its monthly usage limit, the author continued this thread with Codex. Audit tooling completion, subsequent repairs, verification and submission drafts in this continuation are Codex work, not evidence of additional Kiro execution. The existing Kiro implementation and configuration remain intact.
