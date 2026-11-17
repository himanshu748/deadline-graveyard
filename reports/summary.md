# Audit summary

Written by `npm run audit:a11y` (`scripts/audit.mjs`) from the run described below. Do not edit by hand; KIRO_USAGE.md quotes these numbers.

- Date: 2026-11-17 04:58 UTC
- Commit: 94414dc (with uncommitted changes outside reports/)
- Page: http://127.0.0.1:4374/ (the built `dist/` served by Vite preview), opened in a fresh browser profile, so it is a first visit: 3 Demo deadlines are seeded and the intro is open
- Lighthouse 12.8.2 in Google Chrome 157.0.8103.52 (installed Chrome found by chrome-launcher), headless, categories performance, accessibility, best-practices, seo, one run per preset (mobile is the default config, desktop is `desktop-config.js`)
- axe-core 4.14.0 through @axe-core/playwright in Playwright Chromium 159.0.8154.6, headless, all rules on, viewport 1280x800
- Machine load average (1, 5, 15 min) on 10 cores: 8.2, 9.5, 8.0 at the start, 13.7, 10.8, 8.5 at the end. A busy machine lowers the performance score.
- Duration: 34 s

## Lighthouse

| Preset | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| mobile | 93 | 100 | 100 | 100 |
| desktop | 100 | 100 | 100 | 100 |

### mobile

| Metric | Value |
|---|---|
| First Contentful Paint | 1.5 s |
| Largest Contentful Paint | 2.2 s |
| Total Blocking Time | 280 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 1.5 s |

Audits below 0.9 (the report would not show them as passed):

| Category | Audit | Score | Value |
|---|---|---|---|
| performance | Total Blocking Time (`total-blocking-time`) | 0.81 | 280 ms |
| performance | Network dependency tree (`network-dependency-tree-insight`) | 0 |   |
| performance | Render blocking requests (`render-blocking-insight`) | 0 | Est savings of 150 ms |
| performance | Max Potential First Input Delay (`max-potential-fid`) | 0.56 | 230 ms |
| performance | Eliminate render-blocking resources (`render-blocking-resources`) | 0 | Est savings of 150 ms |
| performance | Reduce unused JavaScript (`unused-javascript`) | 0 | Est savings of 48 KiB |
| performance | Minimize main-thread work (`mainthread-work-breakdown`) | 0 | 2.1 s |

### desktop

| Metric | Value |
|---|---|
| First Contentful Paint | 0.3 s |
| Largest Contentful Paint | 0.5 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0 |
| Speed Index | 0.4 s |

Audits below 0.9 (the report would not show them as passed):

| Category | Audit | Score | Value |
|---|---|---|---|
| performance | Network dependency tree (`network-dependency-tree-insight`) | 0 |   |
| performance | Render blocking requests (`render-blocking-insight`) | 0.5 |   |
| performance | Reduce unused JavaScript (`unused-javascript`) | 0 | Est savings of 48 KiB |

## axe

Violations are counted per rule. Serious or critical in total: 0. All impacts: 0.

| State | Motion | Critical | Serious | Moderate | Minor |
|---|---|---|---|---|---|
| First visit, intro open over the 3 Demo deadlines | no-preference | 0 | 0 | 0 | 0 |
| Scene and list view after Skip intro | no-preference | 0 | 0 | 0 | 0 |
| Detail panel of the missed Demo deadline | no-preference | 0 | 0 | 0 | 0 |
| Add deadline form | no-preference | 0 | 0 | 0 | 0 |
| Export and settings dialog | no-preference | 0 | 0 | 0 | 0 |
| Séance, first question | no-preference | 0 | 0 | 0 | 0 |
| List only view | no-preference | 0 | 0 | 0 | 0 |
| First visit, intro open over the 3 Demo deadlines | reduce | 0 | 0 | 0 | 0 |
| Scene and list view after Skip intro | reduce | 0 | 0 | 0 | 0 |
| Detail panel of the missed Demo deadline | reduce | 0 | 0 | 0 | 0 |
| Add deadline form | reduce | 0 | 0 | 0 | 0 |
| Export and settings dialog | reduce | 0 | 0 | 0 | 0 |
| Séance, first question | reduce | 0 | 0 | 0 | 0 |
| List only view | reduce | 0 | 0 | 0 | 0 |

No violations of any impact.

## Run log

Every run of this script, newest first (scores are performance / accessibility / best practices / SEO).

<!-- run-log:start -->
| Date | Commit | Lighthouse mobile | Lighthouse desktop | axe serious + critical | axe all | Load (1 min) |
|---|---|---|---|---|---|---|
| 2026-11-17 04:58 UTC | 94414dc (uncommitted changes) | 93 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 0 | 0 | 8.2 |
| 2026-11-17 04:54 UTC | 164b0b0 (uncommitted changes) | 80 / 100 / 100 / 100 | 69 / 100 / 100 / 100 | 0 | 0 | 8.4 |
| 2026-11-16 18:07 UTC | 60b67d3 (uncommitted changes) | 63 / 100 / 96 / 90 | 74 / 100 / 96 / 90 | 0 | 0 | 89.5 |
<!-- run-log:end -->
