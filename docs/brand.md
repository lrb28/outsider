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
- App icon: the user's "3D gloss" icon from Figma (file lDOK5IkoP0lFNnTxIsxuFK,
  node 1:11): a white Ā on a diagonal aura gradient (blue left, orange top
  right, magenta bottom right), inner bevel shadows and top/right gloss
  highlights. Rebuilt crisp from the same letter path and Figma's effect
  values; iOS gets a full-bleed square (`app/apple-icon.png`,
  `public/apple-touch-icon.png`, it applies its own mask), the manifest gets
  rounded 192/512 and a full-bleed maskable 512. `web/app/icon.svg` is the
  flat tab version of the same gradient. Source: `web/scripts/icon/app-icon.html`.

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
- Segmented controls slide one selection "droplet" (`SegmentedControl`); they
  are for local switches inside a card (chart range, Investoren/Insider).
- Page sections and list filters at the top of a page use the `ChipBar`
  (Entdecken, Meldungen, Depot): 36 px capsules on `surface-2`, the chosen one
  solid ink, aura dot for people categories. Same look on every tab.
- Anything that answers "who/what is behind this?" opens a `Sheet` instead of
  a new page: key figures (Investoren mit Bestand, Zugänge, Abgänge), legend
  rows, the "So liest du die Daten" explainer; a trade opens the trade card
  (`TradeDetailModal`) with the same interactive price chart as the stock
  page. The page stays visible behind it as frosted glass (blurred, milky
  tint, `dialog::backdrop`) and does not scroll (`useScrollLock` pins the
  body, which iOS needs). A downward swipe on the header, or anywhere while
  the content is at its top, drags the sheet and dismisses it
  (`useDragDismiss`); a tap outside or Escape closes it too. Touches inside
  `[data-sheet-nodrag]` (charts) never drag the sheet.
- Mobile tab bar: icons only, solid glyphs (`homeFill`, `discoveryFill` with
  the needle cut out, `notificationFill`, `graphFill`), the current tab in
  full ink, the others at 30 % ink, a short pop on change. The round "+"
  beside it blurs the page first and lets its actions rise once the page has
  gone soft (`.menu-scrim`, `.action-item`).
- Lists of positions (Depot, dividends per position) are plain grouped rows
  like getquin/Parqet: logo, name, one grey detail line; value and result on
  the right. Destructive actions hide behind "Bearbeiten".
- Key figures that can be opened carry a chevron (`StatRow` with `onClick`).

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

Volume, where it helps reading: ring charts (`Donut`) are one closed band,
segments edge to edge with square joins (no gaps, no round ends), each lit
along its length and across the band and the ring lifted by a soft glow in
its own colours; they sweep in clockwise once they scroll into view, glide
to new values when the data changes and the touched segment grows and steps
out. Allocation cards (`AllocView`) show eight groups and fold the rest into
a grey "Übrige (n)", so the ring always adds up to the whole. Stacked and
yearly bars carry `.bar-3d`, legends use `.dot-3d`. Lines stay flat; price
and Depot lines take emerald or rose by the result of the shown range.

Price chart (`PriceChart`): the price and change above it roll to the
touched day while scrubbing, and the day's date rides on top of the
crosshair; nothing else in the header moves and there is no footer line.

Depot groups (sector, region, asset class) come from `classify` in
`lib/sectors.ts`: the curated list, then funds recognised by name (region
and sector from "S&P 500", "MSCI World", "Health Care" …), the ISIN's
country or the listing for regions, and Yahoo's sector via `/api/meta` for
all other shares. What no source knows is "Sonstige", never "Unbekannt".

Investor activity on a stock is a diverging ramp (`--move-*` tokens), deep to
light emerald, grey, light to deep rose: neu eingestiegen · aufgestockt ·
unverändert · reduziert · ausgestiegen (each fund's latest 13F against the
quarter before).

Numbers are German everywhere (`num`, `pctOf` in `web/lib/format.ts`):
"22,4 %", "$299,3 Mrd.", "$31,1K", with a no-break space before "%" and units.

## Pictures

People: official congressional portraits; credited Commons photos for
investors (`web/lib/portraits.ts`, matched by fund or person name); else the
fund's logo (`FUND_LOGOS`, files in `web/public/funds`: website icons or the
public-domain text logos on Commons cut down to the mark; `tile` files are
finished round tiles); insiders show their company's logo. Company logos load
through `/api/logo` (Parqet by ISIN from the 13F CUSIP first, then by symbol,
then FMP; PNG only, cached a week). `CompanyLogo` reads each file: a mark that
runs to the border (wordmarks) is inset on its own field colour, a white mark
on transparency gets a dark tile. Shadows go on the tile itself
(`.logo-lift`, `.face-lift`), never on a wrapper, whose line box is taller
than the logo and shows as a pale band. Logo groups sit side by side, never
overlapped.

## Motion

`AuraField` (WebGL) is decoration only: it pauses off screen and in hidden
tabs and holds still for reduced motion. Entrance animations are short
(≤ 0.9 s) and never block reading.

Numbers roll like an odometer (`RollingNumber`, after the reference wallet
apps): each digit is a 0–9 column that slides with a short motion blur,
digits that appear or go grow and shrink in width. The Depot value and the
start page counts roll up from zero once they are on screen; values that
follow a finger (the chart price) roll in about 0.28 s.

Welcome screen (first visit, or `/?willkommen=1`): after the reference wallet
app, a band of iridescent silk (`SilkRibbon`, WebGL, six-second loop) flows
through a white page, the mark (the Ā without its crossbar: a bar over a Λ)
sits in the upper middle, "Money / leaves / clues" one word per line bottom
left, two equal frosted capsules below. Dark mode shows the negative of the
light picture on black, as the reference does.
