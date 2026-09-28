# ĀURA – Design system

ĀURA shows what investors, corporate insiders and members of the US House
disclose. The look is plain and iOS-like: content first, controls float above
it, colour only where it carries meaning.

## Name and wordmark

- Written **ĀURA** (bar over the first A) in the wordmark and headlines,
  **AURA** where a plain ASCII name is needed (app name, share titles).
- The wordmark is one flat path (`web/lib/wordmark.ts`), generated from Inter
  Tight (OFL, only in `web/scripts/fonts`, not loaded by the site) at weight
  620 with 0.14 em tracking by `web/scripts/generate-wordmark.py`.
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
| `bull` / `bull-fill` | #0A7F52 / #0FA36B | #3DDC97 / #2FD592 | gains (text / marks), emerald |
| `bear` / `bear-fill` | #C8243B / #E8384F | #FF7D8B / #FF6B7D | losses (text / marks), rose |
| `*-hi` / `*-deep` | lit / shaded steps of bull, bear, flat | | 3D chart shading only |
| `flat-fill` | #9BA1AD | #7C8290 | "held", neutral marks |
| `seg-thumb` | #FFFFFF | #636366 | selected segment |

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

- One family: the system face, SF Pro on Apple devices (`font-sans` for text,
  `font-display` for headlines, which picks SF Pro Display). It is never
  self-hosted: Apple's licence only covers the copy on the device. Other
  platforms fall back to Segoe UI or Roboto.
- Text 15–17 px. Headlines and large numerals bold with light negative
  tracking (−0.01 em for section titles up to −0.025 em for the hero); SF Pro
  Display is spaced for large sizes, so go no tighter. Large title 34 px;
  numerals tabular.

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
series, fold into "Übrige". Groups (sectors, regions, asset classes) take the
palette by size too — never fixed hex values, which vanished on dark cards.

Volume, where it helps reading: ring charts are shaded discs with a visible
side and a soft shadow (`Donut`), activity bars are lit cylinders
(`ActivityBars`), stacked and yearly bars carry `.bar-3d`, legends use
`.dot-3d`. Lines stay flat.

Numbers are German everywhere (`num`, `pctOf` in `web/lib/format.ts`):
"22,4 %", "$299,3 Mrd.", "$31,1K", with a no-break space before "%" and units.

## Pictures

People: official congressional portraits; credited Commons photos for
investors (`web/lib/portraits.ts`, matched by fund or person name); else the
fund's logo (`FUND_LOGOS`, files in `web/public/funds`); insiders show their
company's logo. Company logos load through `/api/logo` (PNG only, cached a
week) and get a soft edge when their own background matches the card. Logo
groups sit side by side, never overlapped.

## Motion

`AuraField` (WebGL) is decoration only: it pauses off screen and in hidden
tabs and holds still for reduced motion. Entrance animations are short
(≤ 0.9 s) and never block reading.
