# Deadline Graveyard

Draft for author review; not submitted. Category: Costume Contest. Working app, public GitHub repository and YouTube URL: **pending author-approved publication**. Best Student remains conditional on the author's eligibility details.

## Tagline

Keep your deadlines alive. Turn missed work into lessons, and finished work into light.

## Inspiration

A busy week can contain a course report, a hackathon submission and an application that has quietly stopped moving. A calendar records when they are due, but a date alone does not tell the whole story. Deadline Graveyard explores an interface where time remaining, neglect, completion and reflection have different visible forms.

The intended audience is students and builders juggling overlapping commitments. This is a working prototype, not a claim of validated demand or improved completion rates.

## What it does

An active deadline is a candle. Its wax shrinks as time passes, and the flame becomes more urgent in the last 24 hours. Missing the deadline leaves a tombstone where you can write an epitaph: what would you do differently next time? Marking work submitted lights a lantern. An unresolved project with seven days of inactivity becomes a ghost you can revive or bury.

The Séance turns a weekly review into three questions: what needs attention, what did you learn, and what will you carry into next week? Your choices produce a concrete plan with actions you confirm before applying.

The first visit introduces three clearly labelled demo deadlines. You can skip or pause the tour, clear its data, and start your own graveyard. A complete text list exposes the same deadlines and actions, with keyboard navigation, local timezone display and reduced-motion controls. No account or AI key is required.

## How it was built

Kiro CLI helped develop the plan, EARS requirements, designs, task lists and implementation. The scene and list share a pure TypeScript state model, with Preact for the interface, GSAP for motion, Temporal for timezone conversion and IndexedDB for storage. Property-based tests exercise deadline boundaries and daylight-saving transitions. The production app shell is cached for offline reload; URL capture uses a bounded server-side fetcher with paste-text and manual fallbacks.

Five steering files establish the product, architecture, structure, deadline rules and visual system. The repository includes custom agents, hook scripts and MCP configuration. Their execution status is documented separately in KIRO_USAGE.md: configuration is not presented as proof of automatic execution. After Kiro's usage limit interrupted the build, Codex completed the audit tooling, offline repair and submission preparation.

## Challenges

Offline storage and an offline application are different problems. The browser tests found that saved deadlines survived in IndexedDB but the page could not reload without networking. A versioned app-shell cache closed that gap. The newly enabled test also found that clearing demo records reported success before database deletion finished; the UI now waits for completion.

Timezones were another source of hidden assumptions. A 24-hour urgency window must use elapsed time, even across a daylight-saving change. A deliberate mutation to calendar-day arithmetic was caught by the DST-biased property test while ordinary examples still passed.

## Accomplishments

The central journey works locally without an LLM: create a deadline, see its state, submit or reflect on it, build a weekly plan and keep working offline. The latest local verification passed 470 unit/property tests and 23 Chromium browser tests. Audit results, screenshots and limitations are linked from the README; they are engineering evidence, not user-impact statistics.

## What we learned

Making the metaphor usable required text labels, visible focus and a list view with the same actions. Testing the whole journey also mattered more than testing isolated storage calls: it exposed both the missing offline shell and the deletion race.

## What's next

Complete the Kiro-specific execution checks, review the experience with intended users, and validate the hosted URL-fetch function after deployment is authorized. Cloud sync remains an optional future direction. Public hosting, the demo recording, student eligibility details and final submission are still pending.

## Built with

Kiro CLI, TypeScript, Preact, Vite, GSAP, temporal-polyfill, idb/IndexedDB, Service Workers, Vitest, fast-check, Playwright, axe-core, Lighthouse. Codex assisted with the final continuation. Optional Gemini, Groq and Ollama adapters are implemented but were not live-tested; Vercel deployment is planned, not completed.
