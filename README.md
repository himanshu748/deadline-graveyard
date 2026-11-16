# Deadline Graveyard

A deadline and project tracker where a moonlit graveyard is the interface. Built for the Kiroween 2026 hackathon (Costume Contest category).

## What it is

Every element in the scene encodes real state:

- An active deadline is a candle that burns down in real time. Its flame flickers faster in the last 24 hours.
- A missed deadline becomes a tombstone with an epitaph you write about what you learned.
- A submitted deadline becomes a lit lantern.
- A project with no activity for 7 days becomes a ghost that drifts toward you until you revive it or bury it.
- The Séance is a weekly review: three questions whose answers become next week's plan.

Times are shown in your timezone. Data stays in your browser (IndexedDB), so it works offline and without an account.

## Who it is for

Students and builders who track many overlapping deadlines (hackathons, coursework, internship and grant applications) and lose track of which ones are close and which projects they quietly dropped.

## Working app URL

TODO after Vercel deploy. The app will be hosted on the Vercel free tier only after the author approves the deploy.

## How to run

Requirements: Node.js 22.12 or newer and npm.

```sh
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # typecheck, then production build into dist/
npm run preview    # serve dist/ at http://localhost:4173
```

## How to test

```sh
npm run typecheck  # TypeScript, no emit
npm run lint       # ESLint
npm test           # Vitest unit and fast-check property-based tests
npx playwright install chromium   # once, before the first e2e run
npm run test:e2e   # Playwright end-to-end tests with axe accessibility checks
```

## Getting deadlines in and out

All of these are in the add form or behind the **Export and settings** button. Nothing needs an account or a key.

### Add from a link

Paste an event URL in the add form and press **Fill in from the link**. The app asks `/api/fetch-meta`, which reads the page title and any dates the page exposes (Open Graph, schema.org JSON-LD `Event`, event meta tags, `<time>` elements) and returns only those fields. You check and edit everything before you save.

- Where it works: `npm run dev` (a Vite dev middleware serves `/api/fetch-meta`) and the hosted app (Vercel function `api/fetch-meta.ts`). `npm run preview` has no API, so the button explains that and the other paths take over.
- Safety limits, for the first URL and every redirect: http or https on ports 80, 443, 8080 or 8443, no user name or password in the URL, the host must resolve only to public addresses (private, loopback, link-local, cloud metadata `169.254.169.254`, CGNAT, multicast and IPv6 unique-local are refused), the connection is pinned to the checked addresses, 5 seconds in total, at most 3 redirects, at most 1 MB read, HTML only.
- If the page cannot be read or has no date, the link is kept and you can **paste page text** (the app finds dates in it with rules, offline) or type the date yourself. The zone defaults to yours.
- Try it: `curl 'http://localhost:5173/api/fetch-meta?url=https://example.com'` while `npm run dev` runs returns `{"source":"https://example.com/","title":"Example Domain"}`.

### Calendar export (.ics)

**Export to calendar (.ics)** downloads one event per unresolved deadline. Timed deadlines are written in UTC, so any calendar app shows the right moment in your zone; date-only deadlines become all-day events. Demo items are marked `[Demo]`. The file has no `VTIMEZONE` blocks; the deadline's own zone is kept in a custom `X-DG-TZID` line that other apps ignore. Importing it into a real calendar app has not been tested yet.

### Backup and restore

**Download backup** saves every deadline and setting as JSON. **Restore backup** asks before replacing anything and, if the file is not a valid backup, says which field failed and changes nothing. AI keys are never in the backup.

### Reminders (browser notifications)

Off by default. Turning on **Browser reminders** is the only thing that asks for notification permission. You then get one notification when a candle enters its last 24 hours and one an hour before it burns out.

Limits, stated plainly:

- Reminders only fire while the app is open in a tab. There is no push server, so a closed tab cannot remind you.
- Browsers slow timers in background tabs, so a reminder can arrive a minute or more late.
- If you open the app for the first time inside a deadline's last hour, you get only the 1 hour reminder for it, not both.
- If notifications are blocked or unsupported, the app says so and the candles still show what is due.

The service worker (`public/sw.js`) only shows these notifications and focuses the app when you click one. It caches nothing and has no push subscription.

### Optional AI helper

The default provider is **None**: rule-based, offline, no key. Everything in the app works with it. In **Export and settings > Optional AI helper** you can pick one of these free options instead. It is only used when you press **Ask ...** next to text you pasted in the add form, and its answer is filled in as a suggestion for you to check.

| Provider | What you need | Default model | Notes |
|---|---|---|---|
| Google Gemini | A free API key from [Google AI Studio](https://aistudio.google.com/apikey) | `gemini-3.5-flash-lite` | Free of charge on the free tier. Google's pricing page says free-tier content is used to improve its products. |
| Groq | A free API key from [console.groq.com](https://console.groq.com/keys) | `openai/gpt-oss-20b` | Listed in Groq's Free Plan rate limits (30 requests per minute, 1,000 per day). |
| Ollama | [Ollama](https://ollama.com) running on your computer and `ollama pull llama3.2` | `llama3.2` | Ollama accepts browser requests from `127.0.0.1` by default. For the hosted app, start it with `OLLAMA_ORIGINS=https://<app-domain> ollama serve`. |

Keys are stored only in this browser (`localStorage`) and sent only to that provider. If a call fails or returns something that does not parse, the app falls back to the rule-based result and tells you. The provider calls were tested with a fake `fetch` only; no real key was used while building.

### Kiro hook scripts

The hooks in `.kiro/hooks/` call Node scripts in `scripts/hooks/` that also run on their own. Their pure logic is unit-tested by `npm test` (`tests/hooks/`).

```sh
# commit guard: exit 2 blocks, exit 0 allows (add --static-only to skip typecheck/lint/test)
echo '{"hook_event_name":"PreToolUse","tool_name":"execute_bash","tool_input":{"command":"git commit -m x"}}' \
  | node scripts/hooks/commit-guard.mjs; echo $?

# tests on save: runs vitest related for one file
node scripts/hooks/tests-on-save.mjs src/ui/App.tsx

# audit after build: prints a notice until scripts/audit.mjs exists
echo '{"tool_name":"execute_bash","tool_input":{"command":"npm run build"}}' \
  | node scripts/hooks/a11y-lighthouse-on-build.mjs
```

## Pre-existing work

The project scaffold (package.json, tsconfig, Vite, Vitest, ESLint and Playwright configs, index.html) was written by hand for this project. No starter template or project generator was used.

Third-party libraries used, as listed in `package.json`:

### Runtime dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| [preact](https://preactjs.com) | 11.2.0 | MIT | UI components |
| [gsap](https://gsap.com) | 3.15.1 | GSAP Standard "no charge" license ([terms](https://gsap.com/standard-license)), not an OSI license | Scene animation |
| [temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill) | 1.0.8 | MIT | Timezone and DST-aware date handling (Temporal API) |
| [idb](https://github.com/jakearchibald/idb) | 8.0.4 | ISC | Promise wrapper for IndexedDB |

### Development dependencies

| Package | Version | License | Purpose |
|---|---|---|---|
| [vite](https://vite.dev) | 8.3.8 | MIT | Dev server and bundler |
| [@preact/preset-vite](https://github.com/preactjs/preset-vite) | 2.10.6 | MIT | Preact support for Vite |
| [@babel/core](https://babeljs.io) | 7.29.13 | MIT | Required peer of @preact/preset-vite |
| [typescript](https://www.typescriptlang.org) | 6.0.3 | Apache-2.0 | Type checking |
| [@types/node](https://github.com/DefinitelyTyped/DefinitelyTyped) | 22.20.5 | MIT | Node.js types for config and scripts |
| [vitest](https://vitest.dev) | 5.1.0 | MIT | Unit test runner |
| [happy-dom](https://github.com/capricorn86/happy-dom) | 21.0.4 | MIT | DOM environment for UI unit tests |
| [fast-check](https://fast-check.dev) | 4.10.2 | MIT | Property-based testing |
| [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) | 6.2.8 | Apache-2.0 | In-memory IndexedDB for storage tests in Node |
| [@playwright/test](https://playwright.dev) | 1.65.1 | Apache-2.0 | End-to-end tests |
| [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) | 4.14.0 | MPL-2.0 | Accessibility checks in e2e tests |
| [lighthouse](https://github.com/GoogleChrome/lighthouse) | 12.8.2 | Apache-2.0 | Performance and accessibility audits |
| [eslint](https://eslint.org) | 10.15.0 | MIT | Linting |
| [@eslint/js](https://eslint.org) | 10.0.1 | MIT | ESLint recommended rules |
| [typescript-eslint](https://typescript-eslint.io) | 8.72.2 | MIT | TypeScript rules for ESLint |
| [globals](https://github.com/sindresorhus/globals) | 17.14.0 | MIT | Browser and Node global definitions for ESLint |

GSAP license, checked on 15 Nov 2026 at [gsap.com/standard-license](https://gsap.com/standard-license) (effective 30 Apr 2025): use on any website or web application is a "Permitted Use" at no charge, including commercial use. The only prohibited use is building a visual no-code animation tool that competes with Webflow, which this app is not. GSAP's own notices are left in place. This is not an OSI license, so it is listed here separately from the MIT code of this repo.

### Fonts

Self-hosted from `public/fonts/` (Latin subset, WOFF2). The license texts are next to the files.

| Font | Designer | License | Files | Source |
|---|---|---|---|---|
| IM Fell English (regular) | Igino Marini | SIL Open Font License 1.1 ([OFL-IMFellEnglish.txt](public/fonts/OFL-IMFellEnglish.txt), from [google/fonts](https://github.com/google/fonts/tree/main/ofl/imfellenglish)) | `im-fell-english-latin-400-normal.woff2` | WOFF2 from [@fontsource/im-fell-english 5.3.0](https://www.npmjs.com/package/@fontsource/im-fell-english) via jsDelivr |
| Atkinson Hyperlegible Next (400, 700) | Braille Institute of America | SIL Open Font License 1.1 ([OFL-AtkinsonHyperlegibleNext.txt](public/fonts/OFL-AtkinsonHyperlegibleNext.txt), from [google/fonts](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext)) | `atkinson-hyperlegible-next-latin-{400,700}-normal.woff2` | WOFF2 from [@fontsource/atkinson-hyperlegible-next 5.3.0](https://www.npmjs.com/package/@fontsource/atkinson-hyperlegible-next) via jsDelivr |

The Fontsource packages are not dependencies; only the three font files were copied in.

### Sounds and artwork

- Sounds: none recorded. Wind and the lantern chime are synthesised at runtime with the Web Audio API (`src/scene/sound.ts`), so there are no audio files to license.
- Artwork: every scene shape (sky, moon, hills, fence, fog, candles, tombstones, lanterns, ghosts) is hand-written SVG in `src/scene/`. No icon set, illustration or image file is used.

### Development tools used through Kiro (not app dependencies)

| Tool | Version | License | Purpose |
|---|---|---|---|
| [Playwright MCP](https://github.com/microsoft/playwright-mcp) (`@playwright/mcp`) | 0.0.85, run with npx | Apache-2.0 | Browser automation for the design-review agent |
| [Context7](https://context7.com) remote MCP server | hosted service | Server package MIT; service used on its free keyless access | Library docs lookup for confirming APIs |
| [Vercel CLI](https://vercel.com/docs/cli) (`vercel`) | 65.16.0, run with `npx vercel@latest build` in a temp copy | Apache-2.0 | Local build check of `api/fetch-meta.ts` without logging in or deploying (steps in `.kiro/specs/capture-and-export/design.md`). Not a dependency. |

No library was added for add-from-URL, `.ics`, notifications or the AI helper: HTML extraction, the address checks, the iCalendar writer and parser, and the provider calls are written for this repo with Node built-ins (`node:dns`, `node:http`, `node:https`) and browser APIs (`fetch`, `Notification`, service workers).

## Project status

Spec phase done: steering, feature specs, hooks, custom agents and MCP config are in `.kiro/`. The deadline engine (`src/domain/`, pure state machine, timezones and DST, with fast-check property tests) and offline storage (`src/storage/`, IndexedDB with JSON backup and restore) are implemented and tested. The graveyard scene (SVG, GSAP motion with reduced-motion support, optional synthesised sound) and the screen-reader list view with keyboard navigation, add and edit form and detail dialog are implemented and persist to IndexedDB. Add from a link (with paste-text and manual fallbacks), `.ics` export, backup and restore, opt-in reminders and the optional AI helper (default None) are implemented and tested. The Séance weekly review (three skippable questions, a rule-based plan for the next 7 days, revive, bury and epitaph actions that each wait for a confirmation, and a history kept in backups) is implemented and tested, including a keyboard-only Playwright run. Demo data and the first-visit intro are not built yet. See `PLAN.md` for the build plan and `KIRO_USAGE.md` for how Kiro is used.

Not verified yet, and needing a person or a deploy:

- `api/fetch-meta.ts` on Vercel's servers. It passed a local `vercel build` and a load test of the built function, but nothing has been deployed. Vercel warns that `"engines": { "node": ">=22.12.0" }` makes it use Node.js 26.x.
- Importing the `.ics` file into Google Calendar, Apple Calendar or Outlook.
- A real OS notification after granting permission.
- A live call to Gemini, Groq or Ollama with a real key or a running Ollama.

## License

[MIT](LICENSE)
