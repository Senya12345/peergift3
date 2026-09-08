# Casilla design system

## Why this file exists

AI-generated interfaces converge because a model predicts the *statistically most likely*
next token, and for visual choices "most likely" means the average of every Tailwind and
shadcn template on the open web. The result is a recognisable look — purple-to-cyan
gradient hero, glassmorphism card with a neon glow, Inter in every weight, three feature
cards in a row, `rounded-2xl` on everything, bounce on hover. It is not ugly. It is
anonymous, and in 2026 readers read it as "nobody was home."

The fix is not "be creative." The fix is to **make the taste decisions explicitly and
write them down**, so nothing is left to averaging. That is what this file is.

## Positioning

The entire crypto casino niche looks the same: neon purple, dark glass, glowing dice,
animated gradients. Competing on that axis means being the tenth-best version of it.

**Casilla is an analytical reference, not a casino landing page.** The nearest reference
points are a market data terminal or a well-made league table — dense, aligned, numerate,
calm. The product is a ranked comparison of numbers from named sources. The design should
make a reader trust the numbers, which means it should look like it was built by people
who care about numbers.

Practical consequence: information density beats whitespace. A user comparing casinos
wants to see eight of them at once, not scroll through eight hero sections.

## Palette

Dark-first and dark-only for launch. This is a deliberate commitment, not an oversight —
a light variant is deferred until there is traffic to justify the second set of decisions.

```css
/* Surfaces — cool near-black, never pure #000 */
--ink-900: #0E1114;   /* page background */
--ink-800: #161A1F;   /* section surface */
--ink-700: #1E242B;   /* card surface */
--ink-600: #2A323B;   /* borders, dividers */
--ink-400: #5C6873;   /* disabled, subtle rules */
--ink-300: #8B959F;   /* muted text, labels */
--ink-100: #E4E8EC;   /* body text */
--ink-050: #F5F7F9;   /* headings */

/* Accent — one warm metal, used sparingly */
--amber-500: #E0913A; /* primary accent, scores, CTA */
--amber-400: #F0A855; /* hover */
--amber-950: #2A1E0E; /* accent surface / tint */

/* Score scale — desaturated on purpose. Data, not traffic lights. */
--score-high: #6FA46A;  /* 8.0+  muted sage */
--score-mid:  #C9A227;  /* 6.5–7.9  ochre */
--score-low:  #B0645A;  /* <6.5  muted brick */
```

One accent, and it is warm. No purple, no cyan, no neon, no gradient between two hues.
The score colours are deliberately desaturated so a page of them reads as a data table
rather than an alarm panel.

**Contrast:** `--ink-100` on `--ink-900` is far above AA. `--amber-500` on `--ink-900`
clears 6.5:1, so it is safe for body text as well as UI. Any new colour must be checked
before it is used — no exceptions for "just a label."

## Typography

Explicitly **not Inter**. Inter everywhere is the single clearest tell.

```css
--font-display: 'Archivo', 'Helvetica Neue', Arial, sans-serif;  /* headings, scores, ranks */
--font-body:    'Source Sans 3', system-ui, sans-serif;          /* body, UI */
```

- Self-hosted via `@fontsource-variable` — no Google Fonts CDN. Removes a DNS lookup and
  a third-party request, which helps LCP and keeps analytics honest.
- Headings: Archivo 600/700, letter-spacing `-0.02em`. Tight and editorial.
- **Every number on the site uses `font-variant-numeric: tabular-nums`.** Ratings,
  ranks, bonus amounts, dates. On a site built entirely on figures, columns that align
  are the difference between "data" and "decoration." This is the cheapest credibility
  signal available and almost nobody in the niche does it.
- Body copy at 17px / 1.6 — a touch larger than the 16px default, because long editorial
  paragraphs are the point of the site.

## Layout

- Content column 1120px; the ranking list may run to 1280px.
- 8px baseline grid. Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64.
- **Border radius 4px.** Not 16px, not `2xl`. Small radii read as precise.
- **Depth comes from surface tone and a 1px border, never from shadow.** No `box-shadow`
  on cards at all.
- Casino card is a horizontal row, not a portrait tile: fixed 40px rank column, 48px
  logo, name and factor chips in a flexible middle, score and CTA right-aligned. It
  should read like a table row that happens to be comfortable to tap.
- The per-source score strip lives inside the card — small source abbreviations with
  their figures under the casino name. This is our differentiator; it should be visible
  before a click, not buried on the detail page.

## Motion

- Maximum 120ms, `ease-out`.
- Only `opacity`, `background-color`, `border-color`. No transform, no scale, no bounce.
- `@media (prefers-reduced-motion: reduce)` disables all of it.

Motion on a comparison site is friction. The list should feel instant.

## Hard bans

Failing any of these means the design has drifted back to the statistical average:

- ❌ Gradient hero, especially purple→cyan or any two-hue blend
- ❌ Glassmorphism, backdrop blur, neon glow, glowing borders
- ❌ Inter, in any weight
- ❌ A row of three cards with icon + heading + paragraph
- ❌ `rounded-2xl` / large radii as a default
- ❌ Hover bounce, scale-up, or springy transitions
- ❌ Default shadcn components shipped unmodified
- ❌ A stock icon set used as the visual identity
- ❌ Emoji as UI iconography
- ❌ Centred marketing hero with a big headline and two buttons
- ❌ `box-shadow` on cards

## Identity

The logo is drawn for this project — a mark built from the *casilla* idea (a cell, a
square on a board) rendered as a small filled grid. Monochrome, works at 24px, ships as
inline SVG so it costs no request and inherits `currentColor`.

## Accessibility

Not optional, and it overlaps with SEO more than people expect.

- Every interactive element reachable and visible on keyboard; focus ring is a 2px
  `--amber-500` outline with 2px offset, never `outline: none`.
- The whole casino card is clickable, but the underlying markup is a real heading link,
  not a `div` with a click handler. The "Visit site" button is a separate `<a>` that
  stops propagation.
- Colour is never the only carrier of meaning: score colour is always accompanied by the
  figure itself.
- Sortable table headers are real `<button>` elements inside `<th>` with
  `aria-sort` reflecting state.
