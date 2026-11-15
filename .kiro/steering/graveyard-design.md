---
inclusion: fileMatch
fileMatchPattern: ["src/scene/**", "src/ui/**", "src/styles.css", "index.html", "e2e/**"]
---

# Graveyard design system

The Costume Contest is judged on the UI. One art direction, every element encodes state, accessible by construction.

## Art direction: a moonlit graveyard

- A single wide SVG scene, viewed from a low hill at night. Layers back to front: sky with stars, moon and halo, far hills, mid hills with the iron fence, the graveyard ground, fog bands, foreground grass.
- **Candles** stand on the ground in due order from left to right. Wax height is remaining time as a fraction of the time since creation. The flame flickers slowly when active and fast when due-soon.
- **Tombstones** replace candles that were missed or buried. The epitaph is engraved text on the stone (also in the list view).
- **Lanterns** hang from the fence for submitted items, warm and steady.
- **Ghosts** float in the mid layer and drift toward the viewer the longer the project is inactive.
- Parallax: layers shift with pointer position and scroll (small, max 12 px for the far layer). Fog drifts slowly across.
- Style: flat shapes with soft gradients, no photographs, no third-party illustrations. Every asset is hand-written SVG in this repo.

## Palette and measured contrast

Ratios computed on 15 Nov 2026 with the WCAG 2.x formula: sRGB channels linearised, relative luminance `L = 0.2126 R + 0.7152 G + 0.0722 B`, ratio `(L1 + 0.05) / (L2 + 0.05)`. Recompute if a value changes; the design-review agent re-checks rendered contrast with axe. AA needs 4.5:1 for normal text, 3:1 for large text and UI components.

| Token | Hex | Use | on night-900 `#0b1020` | on night-800 `#141a2e` | on night-700 `#1f2742` |
|---|---|---|---|---|---|
| moon-100 | `#eef1f8` | Primary text | 16.74 | 15.26 | 13.01 |
| mist-300 | `#aeb8d0` | Secondary text | 9.53 | 8.68 | 7.40 |
| lantern-300 | `#ffd98a` | Focus ring, submitted accent | 14.01 | 12.77 | 10.89 |
| candle-400 | `#f5b84a` | Flame, primary action | 10.67 | 9.73 | 8.29 |
| ghost-200 | `#c9e4ff` | Ghost glow, links | 14.45 | 13.17 | 11.23 |
| ember-400 | `#ff8a66` | Due-soon and missed warnings | 8.19 | 7.46 | 6.36 |
| moss-400 | `#7fd1a3` | Success messages | 10.41 | 9.49 | 8.09 |
| stone-400 | `#8790ad` | Tombstone outline, borders | 5.97 | 5.44 | 4.64 |
| stone-500 | `#6b7390` | Tombstone fill (non-text only) | 4.04 | 3.68 | 3.14 |

Backgrounds: night-900 page, night-800 panels, night-700 raised controls. Button text on candle-400 uses night-900 (10.67:1).

Rules:
- Text is never placed directly on fog or gradients. Scene labels sit on a night-800 plate at 90% opacity or more.
- stone-500 is for shapes only; engraved epitaph text uses moon-100 on a stone plate darkened to night-700 or darker.
- State is never shown by colour alone: each state also has a shape (candle, stone, lantern, ghost) and a text label.

## Type

Fonts, both SIL Open Font License 1.1, self-hosted from `public/fonts/` and listed in README > Pre-existing work:
- **IM Fell English** (Igino Marini): display and headings only, never below step 2.
- **Atkinson Hyperlegible Next** (Braille Institute): body, labels, list view, forms.

Modular scale, ratio 1.25 (major third), base 1.125 rem (18 px):

| Step | rem | px | Use |
|---|---|---|---|
| -1 | 0.900 | 14.4 | Captions, the "Demo" badge |
| 0 | 1.125 | 18.0 | Body |
| 1 | 1.406 | 22.5 | Lead text, list headings |
| 2 | 1.758 | 28.1 | Panel titles |
| 3 | 2.197 | 35.2 | Section titles |
| 4 | 2.747 | 43.9 | Page title |
| 5 | 3.433 | 54.9 | First-visit title (clamped down on narrow screens) |

Line height 1.5 for body, 1.15 for display. Minimum body size 18 px. Expose the steps as CSS custom properties `--step--1` to `--step-5`.

## Motion (GSAP) and reduced motion

- Motion explains state: flicker rate means urgency, drift distance means neglect, a lantern lighting means success. No motion that does not encode something, except slow fog.
- Durations: micro 150 to 250 ms, state changes 400 to 700 ms, ambient loops 3 to 12 s. Ease `power2.out` for entrances, `sine.inOut` for loops.
- All GSAP timelines are created through one helper that reads a single `motion` setting: `full` or `reduced`. The setting starts from `matchMedia('(prefers-reduced-motion: reduce)')`, listens for changes, and can be overridden by a visible toggle saved locally.
- In `reduced` mode: no parallax, no drift, no flicker loops, no fog movement. State changes become opacity cross-fades of 200 ms or less, or instant. The scene still shows the same states statically (flame size and colour, ghost distance by position).
- Nothing flashes more than 3 times per second.

## Keyboard and the list view

- Every interactive scene element is reachable by Tab in due order, with a visible focus ring (2 px lantern-300 plus 2 px night-900 offset).
- Arrow keys move between scene items; Enter opens the detail panel; Escape closes panels and returns focus to the item that opened them.
- A skip link goes to the list view. The list view is a real `<ul>` of every item in the scene, grouped by status, with the same actions as the scene. It renders from the same derived state as the SVG, so they cannot disagree.
- The SVG scene is `aria-hidden` only when the list view fully represents it; decorative layers are always `aria-hidden`.
- Live updates (a candle turning due-soon) are announced through one polite live region, at most once per item per state change.

## Sound

- Off by default. A toggle turns it on; the choice is saved locally.
- Sounds are synthesised with the Web Audio API in the browser (wind, a soft chime when a lantern lights). No recorded audio files, so there is nothing to license. If a recorded sound is ever added it must be CC0, with source URL and license in README.
- No sound plays before the user turns it on, and none plays in reduced-motion mode unless sound is explicitly on.
