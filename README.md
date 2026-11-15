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

## Project status

Spec phase done: steering, feature specs, hooks, custom agents and MCP config are in `.kiro/`. The deadline engine (`src/domain/`, pure state machine, timezones and DST, with fast-check property tests) and offline storage (`src/storage/`, IndexedDB with JSON backup and restore) are implemented and tested. The graveyard scene (SVG, GSAP motion with reduced-motion support, optional synthesised sound) and the screen-reader list view with keyboard navigation, add and edit form and detail dialog are implemented and persist to IndexedDB. Demo data, add from URL, `.ics` export, notifications and the Seance are not built yet. See `PLAN.md` for the build plan and `KIRO_USAGE.md` for how Kiro is used.

## License

[MIT](LICENSE)
