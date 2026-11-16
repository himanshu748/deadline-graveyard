---
inclusion: always
---

# Structure: folders, naming and test placement

```
deadline-graveyard/
  .kiro/                 committed, never gitignored
    steering/            product, tech, structure (always); deadline-domain, graveyard-design (fileMatch)
    specs/<feature>/     requirements.md (EARS), design.md, tasks.md
    hooks/*.json         standalone hook files (version v1), each calling a script in scripts/hooks/
    agents/*.json        custom agents: design-review, spec-keeper
    settings/mcp.json    workspace MCP servers
  src/
    domain/              pure deadline engine: types, state machine, ghosts, time, ics
    storage/             IndexedDB repository (idb), JSON backup and restore
    scene/               SVG graveyard layers, candles, tombstones, lanterns, ghosts, GSAP timelines
    ui/                  Preact panels, forms, list view, App shell
    capture/             add-from-URL client, HTML metadata extractor, paste-text parser
    seance/              weekly review questions and plan builder
    llm/                 LlmProvider interface and providers (none, gemini, groq, ollama)
    notifications/       Notification API and service worker glue
  api/                   Vercel function(s): fetch-meta.ts
  public/                self-hosted OFL fonts, icons
  tests/                 unit and property tests that are not colocated
    hooks/               unit tests for scripts/hooks/lib.mjs
  e2e/                   Playwright + axe specs
  scripts/
    hooks/               Node scripts behind .kiro/hooks (run standalone too)
    audit.mjs            axe + Lighthouse against dist/ (added in the polish phase)
  reports/               summary.md committed; reports/raw/ gitignored
  docs/design-reviews/   dated reviews written by the design-review agent
```

## Naming

- Files: kebab-case for modules (`deadline-state.ts`), PascalCase for Preact components (`ListView.tsx`).
- Types and interfaces: PascalCase. Functions and variables: camelCase. Constants: UPPER_SNAKE only for true constants such as `DUE_SOON_MS`.
- Spec folders: kebab-case feature names matching `PLAN.md` (`deadline-engine`, `graveyard-scene`, `accessible-list-view`, `capture-and-export`, `seance`, `first-visit`, `sync`).
- Requirement IDs: `R<n>.<m>` inside a spec, referenced from tasks as `_Requirements: R1.2_`. Cross-spec references use the folder name, for example `deadline-engine R2.1`.

## Imports

- Relative imports with explicit extensions (`./deadline-state.ts`, `./ListView.tsx`); `allowImportingTsExtensions` is on.
- `src/domain/` imports nothing from `scene/`, `ui/`, `storage/` or the DOM. Dependencies point inward: `ui` and `scene` depend on `domain`, never the other way.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is on).

## Tests

- Unit tests are colocated as `*.test.ts(x)` next to the module, or under `tests/` when they span modules. Vitest includes `src/**/*.test.{ts,tsx}` and `tests/**/*.test.{ts,tsx}`.
- Property tests use fast-check and are named `*.property.test.ts`.
- The suite timeout is 60 s (`testTimeout` in `vite.config.ts`) because heavy properties take far longer than the 5 s default when all workers run on a busy machine. Never lower a property's `numRuns` to make it fit a timeout.
- UI tests start with `// @vitest-environment happy-dom`.
- E2E specs live in `e2e/*.spec.ts` and run against `vite preview` on port 4173.
- Each EARS requirement maps to at least one task and one test. The spec-keeper agent checks this. A test names what it validates in its title or in a comment: `// Validates: deadline-engine R1.4` (or `P4` for a deadline-engine correctness property).

## Commits

Conventional prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`. One commit per task. The commit-guard hook runs typecheck, lint and tests before any `git commit` the agent makes.
