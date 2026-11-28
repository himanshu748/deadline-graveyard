# Deadline Graveyard judge guide

**Kiroween 2026 category:** Costume Contest. [Official rules](https://kiroween.devpost.com/rules) · [Project story](../DEVPOST_STORY.md) · [Recorded demo](demo-video.mp4) (0:50).

Deadline Graveyard turns a deadline tracker into a navigable moonlit scene. Active work burns as a candle, missed work becomes a tombstone, an inactive project becomes a ghost and a submitted deadline lights a lantern. A matching list supports the same actions by keyboard.

## Try the browser demo

1. Open the demo without signing in. Skip the intro or use its labelled fictional records.
2. Revive the demo ghost, then mark it submitted and look for the lantern. Open the missed demo scholarship item and write an epitaph.
3. Choose **Hold a séance** and answer its three questions to get a rule-based plan. Select **List only** to review the same deadlines without the scene.
4. Open **Export and settings** to download the calendar. After the initial online visit, deadlines and the cached shell remain usable on an offline reload.

The static Pages build supports manual entry and pasted event details. Automatic link metadata uses the separate `/api/fetch-meta` function. The default planning path needs no API key.

## How Kiro was used

Kiro CLI 3.2.1 with its V3 harness, driven over ACP by T3 Code, produced the plan, scaffold and committed Kiro configuration. The [deadline engine requirements](../.kiro/specs/deadline-engine/requirements.md), [graveyard scene design](../.kiro/specs/graveyard-scene/design.md) and [accessibility specs](../.kiro/specs/accessible-list-view/) document the work before implementation. [Domain steering](../.kiro/steering/deadline-domain.md) records the day-boundary and DST rules.

The team validated and listed both custom agent definitions with the CLI. The project tested [commit guard](../.kiro/hooks/commit-guard.json) behavior against temporary repositories, and manually exercised the hook scripts. Automatic hook firing in the ACP session and execution of the two custom-agent reviews remain unverified. The dated design review was produced during Codex continuation. [Kiro usage evidence](../KIRO_USAGE.md) · [Design review](design-reviews/2026-11-17.md).

The spec's six correctness properties have corresponding fast-check tests. For example, [status properties](../src/domain/status.property.test.ts) cover the due-soon boundary around actual DST transitions and verify that terminal states remain terminal. The interactive IDE Correctness feature was not run.

## Submission fields

| Field | Evidence or value |
| --- | --- |
| Category | Costume Contest |
| Public GitHub repository | [Source](https://github.com/himanshu748/deadline-graveyard), MIT license, and committed root `.kiro/` |
| Working application | Use the verified public URL after running the **Publish browser demo** workflow from `main` |
| Video | [YouTube walkthrough](https://youtu.be/vlgeK36kLIw) (0:50). The [recorded file](demo-video.mp4) is also in this repository. |
| Testing instructions | Use the four browser steps above |
| Pre-existing work | [Dependency and asset disclosures](../README.md#pre-existing-work) |
| Eligibility and survey responses | Entrant completes the personal fields and any bonus declarations |
