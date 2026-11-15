---
inclusion: always
---

# Tech: stack, constraints and rules

## Stack (installed in the scaffold commit, versions as of 15 Nov 2026)

| Concern | Choice | Why |
|---|---|---|
| Build | Vite 8 + TypeScript ~6.0.3 (strict) | Static SPA, fast dev server. TypeScript is pinned below 6.1 because typescript-eslint 8.72 requires it. |
| UI | Preact 11 (`jsx: react-jsx`, `jsxImportSource: preact`) | Small React-style components for panels, forms and the list view. |
| Scene | Hand-written SVG layers driven by the same derived state as the list view | Full control of art direction and accessibility. No canvas text. |
| Motion | GSAP 3.15 | Timelines for flicker, drift and parallax. GSAP Standard "no charge" license (not OSI), disclosed in README. |
| Time | `temporal-polyfill` 1.0.8 (Temporal API) | Explicit DST disambiguation (`compatible`, `earlier`, `later`, `reject`). Luxon documents ambiguous fall-back times as undefined behaviour, which would make PBT property 5 untestable. Drop the polyfill when native Temporal ships everywhere. |
| Storage | `idb` 8.0.4 over IndexedDB | 1.2 kB, mirrors the native API. Dexie's query layer is not needed. |
| Unit tests | Vitest 5, default environment `node`; UI tests opt in with `// @vitest-environment happy-dom` | Domain tests stay fast and DOM-free. |
| Property tests | fast-check 4 | PBT for state transitions, timezones, DST and `.ics` round trips. |
| E2E and a11y | Playwright 1.65 (Chromium only) + `@axe-core/playwright` | Real browser checks, zero axe violations is the bar. |
| Scores | Lighthouse ^12.8.2 | 13.x needs Node 22.19; this machine has Node 22.14. |
| Lint | ESLint 10 flat config + typescript-eslint 8 | |
| Hosting | Vercel free tier, static `dist/` plus one function in `api/` | Deployed only when the author says go. |

Node 22.12 or newer is required (`engines` in package.json). Commands: `npm run dev | build | preview | typecheck | lint | test | test:related | test:e2e`.

## Hard rules

1. **Confirm every API in official docs before using it.** Use the Context7 MCP server or the library's own docs site. Never guess a function name, option or field. If the docs cannot be reached, stop and say so.
2. **Free tiers only.** No paid service, no paid API tier.
3. **One LLM adapter, off by default.** Any runtime LLM goes through the single `LlmProvider` interface in `src/llm/`. Providers: `none` (rule-based, the default), Gemini free tier, Groq free tier, local Ollama. Every feature must work with `none`. API keys are entered by the user at runtime, stored only in the browser, and never committed.
4. **No fabrication.** No invented users, stats, scores or testimonials. Report Lighthouse and axe scores exactly as measured, including bad ones. Demo data is labelled Demo.
5. **No secrets in the repo.** Keys come from the user at runtime or from environment variables. The commit-guard hook scans staged changes for AWS, Google (`AIza`), Groq (`gsk_`), Context7 (`ctx7sk-`) keys, private key blocks and staged `.env` files.
6. **Never ignore `.kiro`.** `.gitignore` must never contain the string `.kiro` (the Kiroween rules say ignoring it could disqualify the entry). The commit guard enforces this.
7. **Never publish, deploy, push, post or submit** without the author's explicit go. If a step needs a login, stop and print the exact command for the author.
8. **Brand-new code only.** Every library, font, sound or generator goes into README > Pre-existing work with its license.

## Engineering conventions

- Domain logic in `src/domain/` is pure: no `Date.now()`, no `new Date()` without an argument, no DOM, no IndexedDB. `now` is always a parameter. See `deadline-domain.md`.
- Instants are stored as UTC epoch milliseconds plus the source IANA zone.
- Prefer small pure functions with tests over classes. No abstractions for one-time operations.
- Errors at trust boundaries (URL input, fetched HTML, imported JSON backups, LLM output) are validated and turned into typed results, never thrown into the UI.
- The URL fetch function accepts only `http` and `https`, rejects private, loopback and link-local addresses, caps size and time, and returns only extracted fields.
- No em dashes in written content (docs, UI copy, commit messages).
