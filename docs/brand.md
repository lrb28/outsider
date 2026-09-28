# ĀURA – Design system

ĀURA shows what investors, corporate insiders and members of the US House
disclose. The look is plain and iOS-like: content first, controls float above
it, colour only where it carries meaning.

## Name and wordmark

- Written **ĀURA** (bar over the first A) in the wordmark and headlines,
  **AURA** where a plain ASCII name is needed (app name, share titles).
- The wordmark is one flat path (`web/lib/wordmark.ts`), generated from Inter
  Tight at weight 620 with 0.14 em tracking by `web/scripts/generate-wordmark.py`.
  It uses `currentColor`; never add effects to it.
- App icon: a white Ā on the three auras over near-black (`web/app/icon.svg`,
  PNGs in `web/public`).

## Colour

All colours are CSS variables in `web/app/globals.css` ("R G B" triplets) with
light and dark values; Tailwind names map onto them (`web/tailwind.config.ts`).

| Role | Light | Dark | Use |
|---|---|---|---|
| `bg` | #F5F5F7 | #000000 | page |
| `surface` / `card` | #FFFFFF | #1C1C1E | cards, sheets |
| `surface-2` | #F2F2F7 | #2C2C2E | fills, chips, tracks |
| `ink` | #1D1D1F | #F5F5F7 | text, primary action |
| `subtle` | #6C6C70 | #98989D | secondary text (≥ 4.5:1) |
| `bull` / `bull-fill` | #248A3D / #34C759 | #30D158 | gains (text / marks) |
| `bear` / `bear-fill` | #D70015 / #FF3B30 | #FF6961 / #FF453A | losses |

**The three auras** – identity colours for who disclosed. Validated for
colour-vision deficiency in both modes with the dataviz validator (all pairs):

| Aura | Light | Dark |
|---|---|---|
| Investoren | #2A78D6 | #3987E5 |
| Insider | #EB6834 | #E0703F |
| Politiker | #C2479A | #D55FAE |

Rules: the primary action is monochrome (black in light, white in dark). A
change is always spelled out with ▲/▼ and a number, never colour alone.

## Type

- Text: the system face (SF Pro on Apple devices), 15–17 px.
- Headlines and large numerals: Inter Tight (self-hosted, OFL), bold, tight
  tracking (−0.02 to −0.045 em). Large title 34 px; numerals tabular.

## Surfaces and controls

- Cards: `card` class – surface colour, 22 px radius, no border, a whisper of
  shadow in light mode, a 0.5 px hairline in dark mode. Never nest cards.
- Lists: grouped inset (`ListCard`, `ListRow`), hairlines inset from the
  leading edge, 44 px minimum targets.
- Buttons: `btn-primary` (solid capsule) for the one main action,
  `btn-capsule` (frosted capsule) for secondary and paired choices, round
  capsules for back/close. Motion uses the `ease-spring` curve (no overshoot).
- Segmented controls slide one selection "droplet" (`SegmentedControl`).

## Liquid Glass

Only on the navigation layer (header nav, tab bar, action button menu), never
on content. `components/LiquidGlass.tsx`: CSS glass everywhere; Chromium
additionally refracts the page live through an SVG displacement filter.
Reduced transparency and increased contrast fall back to solid surfaces.

## Charts

Follow the dataviz method: one axis, thin smooth lines (monotone, never
invented extremes), recessive hairline grid, crosshair + tooltip on hover,
touch and arrow keys, draw-in animation that respects reduced motion.
Categorical colours come from `web/lib/palette.ts` in fixed order; past eight
series, fold into "Übrige".

## Motion

`AuraField` (WebGL) is decoration only: it pauses off screen and in hidden
tabs and holds still for reduced motion. Entrance animations are short
(≤ 0.9 s) and never block reading.
