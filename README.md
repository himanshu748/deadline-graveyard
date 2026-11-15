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
| [@playwright/test](https://playwright.dev) | 1.65.1 | Apache-2.0 | End-to-end tests |
| [@axe-core/playwright](https://github.com/dequelabs/axe-core-npm) | 4.14.0 | MPL-2.0 | Accessibility checks in e2e tests |
| [lighthouse](https://github.com/GoogleChrome/lighthouse) | 12.8.2 | Apache-2.0 | Performance and accessibility audits |
| [eslint](https://eslint.org) | 10.15.0 | MIT | Linting |
| [@eslint/js](https://eslint.org) | 10.0.1 | MIT | ESLint recommended rules |
| [typescript-eslint](https://typescript-eslint.io) | 8.72.2 | MIT | TypeScript rules for ESLint |
| [globals](https://github.com/sindresorhus/globals) | 17.14.0 | MIT | Browser and Node global definitions for ESLint |

Fonts and sounds: none yet. Every font and sound source will be listed here with its license when added.

## Project status

Scaffold only. The page shows a placeholder heading. See `PLAN.md` for the build plan and `KIRO_USAGE.md` for how Kiro is used.

## License

[MIT](LICENSE)
