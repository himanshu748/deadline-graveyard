# When a deadline becomes a ghost: building Deadline Graveyard with Kiro

This unpublished draft was written for the **Kiroween 2026 hackathon**. It needs the author's review before publication.

A candle can tell a different story from a red overdue badge. It gets shorter while there is still time to act. A ghost asks whether a project has been neglected. A lantern lets completed work remain visible.

Deadline Graveyard uses those forms as controls in a deadline tracker for students and builders. The question behind the project is modest: can a coherent visual metaphor make a crowded week easier to read, while still working as an ordinary, accessible task tool? That is a design hypothesis, not a measured outcome.

## Give the metaphor rules

The approved plan came before implementation. Kiro CLI helped turn it into feature specifications with EARS requirements, design documents and traceable tasks. A missed deadline, for example, is determined by a UTC instant; its appearance does not depend on which timezone is selected. Seven days of inactivity produces a ghost only while the item is unresolved and not already missed. Submitted and buried states are terminal.

Five steering files separate product direction, stack decisions, folder structure, domain invariants and the visual system. That separation keeps timezone rules close to the engine and typography, contrast and motion rules close to the interface.

## Test the boundaries the illustration hides

The candle's last 24 hours must mean 24 elapsed hours. A calendar-day subtraction can produce a different window at a daylight-saving transition. The project uses fast-check with DST-biased generators, alongside example tests. Temporarily replacing elapsed-time arithmetic with calendar-day arithmetic caused the property test to fail while the ordinary examples still passed. The mutation was reverted; this was a test of the test, not a production incident.

The scene and text list also share a single derived state. That matters because a beautiful illustration is not useful if its keyboard-accessible alternative disagrees with it.

## A saved record is not an offline app

The end-to-end tests uncovered a practical gap. IndexedDB kept the records, but the service worker did not cache the app itself. Turning networking off and reloading failed. The production build now creates a versioned app-shell cache, while keeping API responses and user data out of that cache.

Enabling the offline regression exposed a second problem: Clear demo updated the display before deletion committed. An immediate reload could bring the demo records back. Waiting for the database operation before reporting success fixed the race. This is why the test goes through a browser rather than stopping at an IndexedDB unit test.

## What Kiro did, and what remains unverified

Kiro CLI was used for the plan, specs, steering and feature implementation. The repository contains hook scripts for related tests, commit checks and build audits, plus doc-sync and hook-smoke definitions. Two custom agents and Playwright/Context7 MCP connections are configured. The scripts have been exercised directly, but automatic ACP hook firing and the custom-agent runs still need verification. Kiro IDE property extraction has not been run. No power was installed.

After Kiro hit its usage limit, Codex completed the audit tooling, repaired offline loading, checked the interface and prepared these drafts. Context7 was used during that continuation to verify Vite's build-only plugin lifecycle. This is not presented as a Kiro MCP execution.

## Where the build stands

The local journey works without an account or LLM: add a deadline, see its state, reflect on a missed one, create a weekly plan and reload offline. The final checks passed 470 unit/property tests and 23 Chromium browser tests. The README links the measured Lighthouse and axe results, including imperfect performance scores.

Before release, the author still needs to complete the Kiro-specific checks, review the experience with intended users, authorize hosting and record the demo. The public repository and app URLs are pending. The most useful lesson from this build is already concrete: treat the metaphor, the accessible controls and persistence as one journey, and test where they meet.
