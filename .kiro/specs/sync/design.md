# Design: sync (stretch, not started)

**Status: not started, stretch.** No design decision has been made and no code exists.

Open questions to answer before a design is written, each confirmed in official AWS documentation through the AWS Documentation MCP server:

1. Which AWS services keep a two-device sync within the free tier for the judging period (to 29 Jan 2027), and what are their exact free-tier limits?
2. How does a browser-only app authenticate without shipping long-lived credentials?
3. How is data encrypted at rest and in transit, and who can read it?

Constraints already fixed by other specs: IndexedDB stays the source of truth (R1.3), the merge rule is R2.1, and no credential may be committed (R3.2, enforced by the commit-guard hook).
