# How Kiro was used

This file answers the Kiro write-up questions from the [Kiroween 2026 rules](https://kiroween.devpost.com/rules). It is updated after every task. Sections marked "Not yet" describe work that has not happened yet; nothing here is claimed before it is done.

## Kiro surfaces used (IDE, CLI, Web, Crew)

- **Kiro CLI** (`kiro-cli 3.2.1`, V3 harness), driven from T3 Code over ACP. Used so far to write the plan (`PLAN.md`) and the project scaffold.
- **Kiro IDE:** Not yet. Planned for spec correctness (property extraction from EARS requirements), which the docs list as IDE only.
- **Kiro Web and Crew:** Not used so far.

## Custom agents

Not yet. Planned: `design-review` and `spec-keeper` (see `PLAN.md` section 6).

## Agent hooks

Not yet. Planned: tests on save, a commit guard, an axe and Lighthouse run after builds, and doc sync.

## Spec-driven vs vibe coding

The plan was written first and approved before any code. The scaffold in this commit was written directly from the plan's stack section; it contains no app logic. Feature specs (requirements in EARS, design, tasks) come next.

## Steering strategy

Not yet. Planned: `product.md`, `tech.md`, `structure.md`, plus domain steering for deadline rules and the graveyard design.

## MCP

Not yet. Planned: Playwright MCP for the design-review agent and a docs server for confirming APIs.

## Property-based testing

fast-check 4.10.2 is installed and a smoke property runs in `tests/smoke.test.ts` to prove the runner works. Real properties (deadline state transitions across timezones and DST) are not written yet.

## Kiro powers

Not yet. The powers registry will be checked during the spec phase.

## Lighthouse and axe scores

Lighthouse: not run yet.

axe: the placeholder page passes `e2e/smoke.spec.ts` with zero axe violations (Playwright 1.65.1, @axe-core/playwright 4.14.0). This is only a scaffold page, so it says nothing about the final UI.
