# Contract: UI tokens

Defined once in `src/styles/index.css` with Tailwind v4 `@theme`; components use utilities (`bg-surface`,
`text-muted`, ...), never raw hex values. Dark values are applied with
`@media (prefers-color-scheme: dark)` redefining the same variables. Derived from the approved mockup, with the
contrast corrections from `research.md` R7 (marked **fix**).

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-page` | `#f5f5f7` | `#000000` | page background |
| `--color-surface` | `#ffffff` | `#1c1c1e` | card |
| `--color-field` | `#ffffff` | `#2c2c2e` | inputs |
| `--color-text` | `#1d1d1f` | `#f5f5f7` | primary text |
| `--color-muted` | `#6e6e73` | `#98989d` | secondary text, **placeholders (fix: full colour, no opacity)** |
| `--color-line` | `rgb(0 0 0 / .14)` | `rgb(255 255 255 / .18)` | borders |
| `--color-accent` | `#0071e3` | `#0a84ff` | links, focus ring base, Show/Hide control |
| `--color-accent-fill` | `#0071e3` | `#0071e3` | **fix:** primary button fill in both themes (white text 4.70:1) |
| `--color-accent-press` | `#0062c3` | `#0062c3` | button hover/press |
| `--color-ring` | `rgb(0 113 227 / .28)` | `rgb(10 132 255 / .40)` | 4px focus ring |
| `--color-danger` / `--color-danger-bg` | `#d70015` / `rgb(215 0 21 / .07)` | `#ff6961` / `rgb(255 105 97 / .12)` | errors |
| `--color-ok` | `#1d8a3a` | `#30d158` | met-rule dot (graphic, 3:1) |
| `--color-bar` | `rgb(255 255 255 / .72)` | `rgb(28 28 30 / .72)` | translucent top bar |

## Shape, type, motion

| Token | Value |
|---|---|
| radius | field/button `12px`, card `24px`, pill `9999px`, logo mark `12px` |
| control height | primary controls (inputs, primary button) `48px`; secondary controls (ghost button, Show/Hide, footer links) `44px` minimum (FR-019, constitution Principle V) |
| font | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif` |
| display tracking | h1 `-0.022em`/28px/1.1; welcome headline `-0.03em`/`clamp(34px,5vw,46px)`/1.04; body `0`/17px for inputs, 15px secondary |
| shadow (card) | `0 1px 2px rgb(0 0 0 / .04), 0 12px 40px rgb(0 0 0 / .08)`; dark `... / .4, ... / .5` |
| easing | `cubic-bezier(.2,.8,.2,1)` (one token, `--ease-out-soft`) |
| durations | press `120ms`, field/state colour, border and shadow `150-200ms` (200ms is the ceiling), rise-in `500ms` |
| press feedback | `:active { transform: scale(.97) }` on pointer-down |
| motion rule | keyframe and position/scale motion animates only `transform` and `opacity`; colour, border-colour and box-shadow may transition for hover, focus and state feedback, at most `200ms` (enforced by the "motion budget" test) |

## Media-query behaviour (required, tested where jsdom allows)

- `prefers-reduced-motion: reduce`: animations/transitions collapse to ~0 and the card appears with opacity only.
- `prefers-reduced-transparency: reduce`: top bar uses `--color-surface`, no `backdrop-filter`.
- `prefers-contrast: more`: `--color-line` becomes a solid, higher-contrast value; focus ring thickness 3px solid.
- No inline `style` attributes (CSP, research R4).

## Contrast test

`src/styles/tokens.test.ts` parses the token table values (exported from a small `tokens.ts` mirror kept equal to the
CSS by a second assertion that greps `index.css`) and asserts: text/page, text/surface, muted/surface,
muted/page, muted/field, white/accent-fill, danger/surface, danger/page, accent/surface (links) are all >= 4.5:1 in
both themes, and the met-rule dot against surface is >= 3:1.
