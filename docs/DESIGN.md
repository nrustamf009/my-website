# DESIGN.md — DSCR Investor Toolkit design system (3 switchable themes)

> Audience: Claude Code. Read this before touching any UI, PDF, or email.
> Product behavior lives in `docs/SPEC.md`. This file governs only how things look.
> Visual reference: `docs/design-reference/` (static HTML, 3 themes × 5 surfaces). If this file and a reference file disagree, this file wins for tokens and rules; the reference wins for layout detail.

---

## 1. What we are building

Three complete visual languages, not recolors. A broker (or the agency) picks one per broker; everything the broker's clients see follows it.

| id | Name | In one line | Fits |
|---|---|---|---|
| `maison` | Maison | Private-bank calm. Deep green, serif numerals, hairlines, brass accent. | Conservative, relationship-led brokers |
| `terminal` | Terminal | Dark precision. Graphite, mono numerals, gauge, dense tables. | Data-forward, tech-savvy brokers |
| `atelier` | Atelier | Swiss editorial. White, giant bold numerals, 2px rules, one color block. | Bold, modern brokers |

Surfaces, each present in all three themes:

1. Instant Check (public, mobile-first, also embedded in an iframe)
2. Scenario Sheet (public)
3. Listing page (public, opened from the QR code; reuses Instant Check patterns and Snapshot numbers)
4. Broker dashboard shell and Money List
5. PDFs: Listing Snapshot (US Letter), analysis PDF, scenario comparison PDF
6. Emails: investor analysis, broker notifications, Money List digest, weekly ROI

Reference HTML exists for: Instant Check, Scenario Sheet, Money List dashboard, Snapshot PDF, investor email. Build the rest from the same primitives. Do not invent new visual ideas for them.

---

## 2. Rules that apply to every theme

1. **Single source of truth is `src/design/`.** No hex values, font names, font sizes in px, or radii anywhere else. CI greps for this and fails the build.
2. **Semantic tokens only.** Components use `bg-surface`, `text-muted`, `border-rule`, never a literal color.
3. **The design layer formats numbers; it never computes them.** Every figure comes from `lib/dscr`. Formatting lives in `lib/format` (currency: no decimals; DSCR: 2 decimals; rates: 3 decimals; use tabular numerals).
4. **Accessibility.** WCAG AA text contrast (4.5:1, 3:1 from 24px) in every theme and every preset accent. Touch targets at least 44px. Real `<button>`, `<a href>`, `<input>` with `<label>`. Icon-only controls get `aria-label`. Color is never the only signal: verdicts always carry a text label.
5. **No emoji, no stock icons that clash.** Icons are inline stroke SVG, 1.5px (maison, terminal) or 2px (atelier).
6. **No filler content.** Empty states teach: say what will appear and how to get it.
7. **Banned words in UI, PDF, email, AI drafts:** approved, pre-approved, pre-qualified, qualifies, guaranteed, commitment (except inside the sentence "not a commitment to lend"). Verdict labels: `Looks strong`, `Borderline`, `Needs adjustment`, `Not eligible under current defaults`.
8. **Every public surface, PDF page and email ends with the broker footer:** LO name and individual NMLS, company name and company NMLS, licensed states, versioned disclaimer, NMLS Consumer Access link, Equal Housing Opportunity mark. One `<BrokerFooter/>`, one `<PdfBrokerFooter/>`, one `<EmailBrokerFooter/>`, all fed by the same data.
9. **Mobile first.** Design at 390px wide, then scale up. Public pages must look finished on a phone.
10. **Square vs rounded is part of the theme.** maison and atelier have radius 0. terminal has 12 / 10 / 8 / 4 (see §4).

---

## 3. Architecture

### 3.1 File layout

```
src/design/
  index.ts              getTheme(id), ThemeId, type exports
  tokens.ts             ThemeTokens interface (the semantic contract)
  themes/
    maison.ts           tokens + font config + variant flags + pdf/email overrides
    terminal.ts
    atelier.ts
  theme.css             GENERATED from themes/*.ts by `npm run design:css`. Never hand-edit.
  accent.ts             accent derivation + contrast engine
  fonts.ts              next/font declarations (see §3.4)
  ThemeProvider.tsx     resolves theme once per layout, exposes context
  components/           primitives (see §6)
  pdf/
    theme.ts            getPdfTheme(id, accent) -> plain object, pt units
    fonts.ts            Font.register for react-pdf
    components/         PdfBrokerFooter, PdfMeter, ...
  email/
    theme.ts            getEmailTheme(id, accent) -> inline-style object
    components/         EmailBrokerFooter, ...
  gallery/
    fixture.ts          golden fixture (see §11)
    page.tsx            /dev/design route body
```

### 3.2 Token contract

Every theme fills the same interface. Components depend on the names, not the values.

```ts
export type ThemeId = 'maison' | 'terminal' | 'atelier';

export interface ThemeTokens {
  color: {
    bg: string;            // page background
    surface: string;       // cards, panels
    surfaceAlt: string;    // sunken or raised alternate (paper, tile, selected column)
    inverse: string;       // dark hero panel / dark block
    onInverse: string;
    onInverseMuted: string;
    inverseRule: string;
    ink: string;           // primary text
    ink2: string;          // secondary text (body copy)
    muted: string;         // captions, labels
    rule: string;          // hairlines
    ruleStrong: string;    // emphasized dividers, outlines
    accent: string;        // broker accent: fills (buttons, bars)
    accentText: string;    // accent legible as text on bg and surface (derived)
    onAccent: string;      // text on accent fills (derived)
    accentTint: string;    // accent at 8-12% for hover/selected (derived)
    warn: string;          // terminal only: Borderline chip
    onWarn: string;
  };
  font: { display: string; body: string; mono: string };   // CSS stacks incl. fallbacks
  radius: { card: number; tile: number; control: number; badge: number };
  border: { hairline: number; strong: number };            // px
  space: { page: number; section: number };                // phone gutters
}
```

CSS variables are named `--bg`, `--surface`, `--surface-alt`, `--inverse`, `--on-inverse`, `--on-inverse-muted`, `--inverse-rule`, `--ink`, `--ink-2`, `--muted`, `--rule`, `--rule-strong`, `--accent`, `--accent-text`, `--on-accent`, `--accent-tint`, `--warn`, `--on-warn`, `--font-display`, `--font-body`, `--font-mono`, `--radius-card`, `--radius-tile`, `--radius-control`, `--radius-badge`, `--border-hairline`, `--border-strong`.

Tailwind maps these in config (v4: `@theme inline { --color-bg: var(--bg); ... }`; v3: `theme.extend.colors` referencing `var(--...)`). Use whichever version the project already has.

### 3.3 How switching works

- **Data.** `Broker.theme` (enum `maison | terminal | atelier`, default `maison`) and `Broker.accentColor` (hex). Agency can set the default for new brokers and override any broker.
- **Resolution.** The `/b/[slug]` layout and the `/dashboard` layout load the broker once, resolve the theme, and render `<div data-theme="{id}" style="--accent: ...">`. Because this happens on the server there is no flash of the wrong theme.
- **CSS-first.** About 80% of the difference is token values. Structural differences use the six variant components in §6, which receive `themeId` from the provider (client components) or as an explicit prop (server components).
- **Preview override.** `?previewTheme=` and `?previewAccent=` are honored only for a signed-in user of that broker or the agency, and in demo mode. Public visitors cannot override a broker's brand.
- **Settings → Appearance.** Three theme cards with live preview (an iframe of `/b/[slug]/check` with the preview params), an accent picker with the four presets per theme plus a custom hex, and live contrast ratios. Saving a color that cannot reach AA is refused with a plain explanation.
- **PDF and email** receive `broker.theme` and `broker.accentColor` and call `getPdfTheme` / `getEmailTheme`. Same tokens, different adapters.
- **Agency admin** uses its own fixed neutral theme (default: `terminal` tokens with an ink accent). Record the choice in `docs/DECISIONS.md`.
- **Seed.** The three demo brokers each use a different theme and accent, so the demo script includes a live theme switch.

### 3.4 Fonts

Five families across the themes: Instrument Serif, Hanken Grotesk, IBM Plex Sans, IBM Plex Mono, Inter Tight.

- Use `next/font/google` with `display: 'swap'`, `subsets: ['latin']`, and only the weights listed in §5.
- A visitor must download only the fonts of their broker's theme. Prefer one font module per theme, loaded conditionally in the theme layout. If Next.js cannot do that cleanly, load all five and measure; record the result and the decision in `docs/DECISIONS.md`. Lighthouse mobile must stay at 90 or above.
- Every stack has a system fallback of similar metrics (see §5) so the layout does not jump.
- React-pdf and email do not use `next/font`; see §9 and §10.

---

## 4. Tokens per theme

Colors are defaults; `accent` family is overridden per broker (§8).

### 4.1 maison

| Token | Value |
|---|---|
| bg | `#F3F4F0` |
| surface | `#FBFBF9` |
| surfaceAlt | `#E4E7E1` |
| inverse | `#10241D` |
| onInverse | `#F3F4F0` |
| onInverseMuted | `#B9C4BC` (secondary on dark: `#D7DDD6`) |
| inverseRule | `#36493F` (scale track on dark: `#5E7268`) |
| ink | `#10241D` |
| ink2 | `#2B3B34` |
| muted | `#4A5A53` |
| rule | `#D5D9D1` |
| ruleStrong | `#10241D` |
| accent (default, brass) | `#7D5E22`, onAccent `#FFFFFF` |
| presets | `#7D5E22` `#1F4E79` `#7A1F2B` `#0F5B4B` |
| radius | card 0, tile 0, control 0, badge 0 |
| border | hairline 1, strong 1 |
| page gutter (phone) | 24 |

No shadows. Depth comes from the dark hero panel, hairlines and surface changes.

### 4.2 terminal

| Token | Value |
|---|---|
| bg | `#0A0C0F` |
| surface | `#12161B` |
| surfaceAlt | `#1A2129` |
| inverse | same as surfaceAlt (no separate dark block) |
| ink | `#E9EDF0` |
| ink2 | `#C5CCD3` (message body: `#D5DBE0`) |
| muted | `#8D97A1` |
| dim (chip borders, inactive dots, chart segment) | `#5A646E`, `#4F5A66` |
| rule | `#232A32` |
| ruleStrong | `#3A434D` |
| accent (default, mint) | `#5FE3B3`, onAccent `#0A0C0F` |
| presets | `#5FE3B3` `#7FB6FF` `#F4C96B` `#C8B6FF` |
| warn (Borderline chip) | `#F2B84B`, onWarn `#0A0C0F` |
| radius | card 12, tile 10, control 8 (primary CTA 10), badge 4, logo box 6 |
| border | hairline 1, strong 2 (selected option) |
| page gutter (phone) | 20 |

PDF paper variant (print is light on purpose): paper `#FFFFFF`, ink `#0A0C0F`, muted `#5A646E`, rule `#C9CFD5`, panel `#EEF0F2`, header band `#0A0C0F` with white text, outline `#0A0C0F`. Accent is used as bar fill with a 1px ink outline.

### 4.3 atelier

| Token | Value |
|---|---|
| bg | `#FFFFFF` |
| surface | `#FFFFFF` |
| surfaceAlt | `#F2F2EF` (paper: footers, draft panel, email canvas) |
| inverse | `#0B0B0B` |
| onInverse | `#FFFFFF` |
| ink | `#0B0B0B` |
| ink2 | `#2A2A27` |
| muted | `#55554F` |
| rule | `#0B0B0B` at 1px |
| ruleStrong | `#0B0B0B` at 2px |
| accent (default, ultramarine) | `#2233E6`, onAccent `#FFFFFF` |
| presets | `#2233E6` `#D42C16` `#0B6B4F` `#6A1FD0` |
| radius | all 0 |
| border | hairline 1, strong 2 |
| page gutter (phone) | 20 |

Accent in atelier is used as a full-bleed color block (verdict block, selected option, big count), not as small touches.

---

## 5. Typography

| | maison | terminal | atelier |
|---|---|---|---|
| Display / numerals | Instrument Serif 400, italic 400 | IBM Plex Mono 400/500 | Inter Tight 700 |
| Body / UI | Hanken Grotesk 400/500/600 | IBM Plex Sans 400/500/600 | Inter Tight 400/500/600 |
| Stack: display | `'Instrument Serif', Georgia, 'Times New Roman', serif` | `'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace` | `'Inter Tight', 'Helvetica Neue', Arial, sans-serif` |
| Stack: body | `'Hanken Grotesk', system-ui, sans-serif` | `'IBM Plex Sans', system-ui, sans-serif` | same as display |

Role scale (size / line-height, px, phone unless noted). Tracking is part of the style; do not drop it.

| Role | maison | terminal | atelier |
|---|---|---|---|
| Hero numeral (DSCR) | display 132/112, −0.02em | mono 500 68/68, −0.04em, centered in gauge | 700 212/170, −0.065em, pulled left by about 8px so the glyph aligns to the gutter |
| Dashboard hero count | n/a (title only) | n/a | 700 208/156, −0.07em, accent colored |
| Page title (h1) | display 40/42, −0.01em (desktop 48/52) | sans 600 26/32, −0.015em | 700 46/46, −0.045em (desktop 44/44) |
| Section title | display 30/34 | sans 600 16/22, with mono eyebrow | 700 22/28, −0.02em, prefixed by accent `01` `02` |
| Metric value | display 38/38 in rows; sans 600 17–20 in panels | mono 500 24/30 in tiles | 700 22/28, −0.02em |
| Option rate | display 60/60 | mono 500 13 in table, 20 for DSCR row | 700 44/46, −0.045em |
| Option letter | display italic 24/28 | mono 500 20/24 | 700 120/92, −0.05em |
| Eyebrow / label | sans 500 11/16, uppercase, +0.14em | mono 400 11/16, uppercase, +0.08em | sans 700 12–13/18, uppercase, +0.04em |
| Body | sans 14–16 / 22–26 | sans 13–15 / 19–24 | sans 14–16 / 20–25 |
| Button label | sans 600 15–16 | sans 600 16 | sans 600 15–17 |
| Fine print / disclaimer | 11/16 (PDF 12/16) | 11/16 (PDF 12/16) | 11/16 (PDF 12/16) |

Numerals: `font-variant-numeric: tabular-nums` in tables and metric rows. Use `text-wrap: balance` on headings, `pretty` on paragraphs.

---

## 6. Components and per-theme structure

Primitives (same API in all themes, styled by tokens): `Eyebrow`, `Numeral`, `Rule`, `DataRow`, `Metric`, `Button` (variants `primary`, `secondary`, `link`), `Chip`, `SegmentedControl`, `Panel`, `BrokerHeader`, `BrokerFooter`, `EqualHousingMark`, `QrBlock`, `Table`, `DraftPanel`.

**Only these six components may branch on theme id**; everything else must be token-only:

| Component | maison | terminal | atelier |
|---|---|---|---|
| `ResultHero` | Dark inverse panel. Eyebrow, address, display numeral with italic verdict beside it, one-line explanation. | Surface card. Eyebrow row, semicircle gauge with mono numeral centered, verdict chip, one-line explanation. | Numeral on white, then a full-bleed accent block with a 40px bold verdict ("Borderline."), explanation, outlined scale. |
| `CoverageMeter` | `linear`: 1px track, filled segment, tick marks at 1.00 and 1.20, label "1.20 · strong tier". | `gauge` on phone (viewBox 310×160, 10px stroke, accent arc, ticks at 1.00 and 1.20). `linear` bordered bar in PDF and dashboard. | `linear-block`: 2px outlined bar, solid fill, ticks, on the accent block (white). |
| `VerdictBadge` | Italic display text, no chip. | Mono uppercase chip, `warn` fill for Borderline, accent for Looks strong, outlined for Needs adjustment. | Large bold sentence ending in a period. Color via the block it sits on. |
| `OptionCompare` | Stacked cards. Option B (recommended) inverted. Italic "Option B" label, 60px serif rate, 2×2 metric grid, note, outlined button. | One comparison table, columns A/B/C, selected column on `surfaceAlt` with 2px accent top border. Below it coverage bars with tick marks, an A/B/C selector (`aria-pressed`), one primary CTA. | Full-width sections. Giant letter at left, rate at right, 2×2 metrics with top rules. Selected/recommended option becomes a full accent block with a white button. |
| `ImprovementList` ("paths to 1.20") | Italic roman ordinals i. ii. iii. in accent; label and hint. | Mono accent delta at left (`+$79/mo`, `−0.375%`), label and hint at right. | 44px bold delta at left, label and hint at right, 1px rules. |
| `DashboardShell` | Dark green 232px left sidebar, current item light fill with italic count. | Bordered left sidebar (208px), current item raised with accent count badge; KPI tiles row above the table. | Top bar with 2px rule and underlined current item; giant accent count as the page hero. |

Layout notes common to all themes: single column on phone; dashboard collapses sidebar above content below 900px; tables get an `overflow-x: auto` wrapper at narrow widths; primary CTA is full width on phone, 56px high (64px in atelier).

---

## 7. Surface notes

### 7.1 Instant Check (390px)
Order: header (logo or monogram, broker name, surface label) → hero (address + DSCR + verdict + explanation) → "Based on" assumptions row with an **Adjust** control → rent, payment, cash flow rows (rent shows the likely range and says the lender uses the appraiser's figure) → paths to the next tier → what the property supports (max loan, cash to close, reserves) → primary CTA "Email me the full analysis" → footer.
Terminal adds a payment-composition bar (P&I, taxes, insurance) with legend and a 2×2 tile grid; maison adds the "What this property supports" bordered panel; atelier numbers its sections `01`, `02`.
Embed (`?embed=1`): hide the surface label and outer margins, post height to the parent, keep the footer.

### 7.2 Scenario Sheet (390px)
Order: header → "Prepared for {name}" eyebrow, title, "By {LO}, {date}. Figures hold through {expiry}." → price / loan / rent strip → options → PDF download row → footer. Each option shows rate, product, payment (and the post-IO payment when relevant), DSCR, cash flow, points and cost, prepay structure. The "I'm interested in Option X" action is a real button; selecting it opens an optional question field.

### 7.3 Listing Snapshot PDF (US Letter, one page)
Letter = 612×792 pt (the reference is 816×1056 CSS px, so multiply px by 0.75). Order: header band → address and meta → photo + estimated rent → 20% vs 25% down comparison → QR + LO block + modest realtor block → footer. Broker is dominant, realtor is secondary (RESPA note in SPEC.md). Must stay one page: long addresses drop to two lines at a smaller size; the photo area collapses if no photo is uploaded.
Terminal's PDF is light with a dark header band. Atelier's comparison is a full-width accent block with two 116px numerals.

### 7.4 Money List dashboard (desktop 1280+)
Header with count, market-rate control (**Edit**), **Send my digest now** → filter chips by trigger (`aria-pressed`) → ranked table (client, loan today, why now, estimated benefit, status) → right-hand draft panel (Email / Text length toggle, message, compliance line appended by code, **Copy**, **Mark contacted**, **Snooze**). Benefit text always says what it is net of. Rows with no dollar figure (ARM reset, anniversary) show an italic or bold label ("Review", "Check in") instead of a number.

### 7.5 Emails
Investor analysis: logo row → hero figure (DSCR) → one-paragraph summary → three key figures → paths to 1.20 → single CTA "Open the full analysis" → LO signature → disclaimer, unsubscribe, EHO. Broker notification emails and digests reuse the same header, key-figure block and footer.

---

## 8. White-label accent engine (`src/design/accent.ts`)

Input: `broker.accentColor` (hex). Work in OKLCH (use `culori`, or implement the conversion).

- `accent`: the broker's color, used for fills.
- `onAccent`: white or the theme ink, whichever has at least 4.5:1 on `accent`. If neither does, the color is rejected at save time.
- `accentText`: the accent adjusted in OKLCH lightness (hue and chroma preserved) until it has at least 4.5:1 against both `bg` and `surface`. Used for any accent-colored text (cash flow numbers, eyebrows, ordinals). On terminal this lightens; on maison and atelier it may darken.
- `accentTint`: accent at 8–12% over `bg`, for hover and selected states.
- Unit tests: every preset in every theme passes; a pale yellow on atelier is rejected for fills with white text; `accentText` always reaches 4.5:1.

Logo: the broker's uploaded logo replaces the monogram box, max height 36–40px. Terminal and maison show it on a light chip if the logo is dark and no "logo on dark" variant was uploaded. If there is no logo, render a monogram from the company initials in the theme's style (square outline in maison, solid rounded square in terminal, wordmark only in atelier).

---

## 9. PDF rules (`@react-pdf/renderer`)

- No CSS variables, no `next/font`. `getPdfTheme(id, accent)` returns a plain object in points. Convert reference px to pt with ×0.75.
- Fonts: register TTF or WOFF files from `public/fonts/` (react-pdf does not read WOFF2). Weights as in §5, plus Instrument Serif Italic. Register once in `src/design/pdf/fonts.ts`. Disable hyphenation (`Font.registerHyphenationCallback((w) => [w])`) so numbers never break.
- QR codes are generated with the `qrcode` package and drawn as SVG paths. Quiet zone of 4 modules. The reference QR is a fake pattern; never ship it.
- Every page ends with `<PdfBrokerFooter/>`. Disclaimer type is at least 9pt (12px).
- Fixed-height blocks in the reference are a layout aid. Real content can be longer: tables must be allowed to grow, and Snapshot must still fit one page (shrink gaps first, then photo).
- Minimum stroke 1px (0.75pt). Everything must still read in grayscale.

## 10. Email rules (`@react-email/components`)

- Table-based layout, 600px maximum width, inline styles from `getEmailTheme`.
- Font stacks: use the fallbacks in §5 as the real design; the web font is a progressive enhancement via `<link>` (works in Apple Mail and iOS Mail, not in Gmail).
- No inline SVG and no gauge in email. Bars are nested table cells. The Equal Housing mark and the broker logo are PNG at 2× (SVG is stripped by Gmail); render `public/eho.png` at build.
- Terminal email is dark. Set `bgcolor` attributes on tables, add `<meta name="color-scheme" content="dark light">` and `supported-color-schemes`, and test in Gmail web, Gmail iOS, Apple Mail and Outlook.com. Known limitation: some clients re-invert dark emails. If inversion breaks contrast, fall back to a light variant for those clients and note it in `docs/DECISIONS.md`.
- Subject lines and preheaders follow the banned-word rule (§2.7). Footer is the full broker footer plus unsubscribe.

---

## 11. Golden fixture (`src/design/gallery/fixture.ts`)

The gallery renders every surface from this fixture, and the numbers must come out of `lib/dscr`, not be hard-coded. If the engine disagrees by rounding, **the engine wins; update this table**.

Subject: 1842 Calloway St, Columbus, OH 43206 · single-family · list price $385,000 · rent $2,950 (likely range $2,780–$3,120) · taxes $449/mo · insurance $130/mo · HOA $0 · 7.125% 30-year fixed · FICO 740+ · closing costs 3% ($11,550) · reserves 6 months.

| | 25% down | 20% down |
|---|---|---|
| Loan | $288,750 | $308,000 |
| P&I | $1,945 | $2,075 |
| PITIA | $2,524 | $2,654 |
| DSCR | 1.16 (Borderline; engine rounds DSCR down) | 1.11 |
| Cash flow | +$426 | +$296 |
| Cash to close | $110,707 (incl. $2,907 prepaids & escrow) | $91,457 |
| Rent for 1.00 / 1.20 | $2,524 / $3,029 | $2,654 / $3,185 |

Max loan at 80% LTV: $308,000. Reserves (25% down): $15,146 (6 × PITIA in cents).

Paths to 1.20 at 25% down (engine output; it searches rent in $25 steps): rent $3,050 (+$100) · rate about 6.750% (−0.375) · more down payment of roughly $9.8k. The reference shows "27.5% down"; the solver must round in the direction that actually reaches the target, so the engine will most likely say 27.6%. Trust the engine.

Scenario sheet (loan $288,750 at 75% LTV):
- A: 7.125% 30-year fixed, no points, prepay 3-2-1 → payment $2,524, DSCR 1.16, cash flow +$426.
- B: 7.375% 30-year fixed, 10-year interest-only, no points, prepay 5-4-3-2-1 → payment $2,354, DSCR 1.25, cash flow +$596, payment from year 11 about $2,883.
- C: 6.750% 30-year fixed, 1.25 points ($3,609), prepay 5-4-3-2-1 → payment $2,452, DSCR 1.20, cash flow +$498.

Money List: 11 opportunities among 60 closed loans, market rate 6.875%, trigger threshold 0.750 points; 8 not contacted, 2 contacted, 1 snoozed. The client names and dollar benefits in the reference are illustrative. The seed data must reproduce the same **triggers and ranking order** (prepay ended, prepay in 27 days, 12-month seasoning, ARM reset in 5 months, rate gap with prepay pending, anniversary); the dollars must come from the engine.

---

## 12. Acceptance checklist

- [ ] Switching `Broker.theme` restyles Instant Check, Scenario Sheet, Listing page, dashboard, Money List, all PDFs and all emails with no edits to feature code.
- [ ] `grep` finds no hex colors, font-family strings, or design px constants outside `src/design/`.
- [ ] Only the six components in §6 branch on theme id.
- [ ] Gallery `/dev/design` shows every surface × 3 themes × (390px, 1440px) from the fixture; numbers match §11 as produced by `lib/dscr`.
- [ ] Playwright visual snapshots exist per theme × surface; reviewed side by side against `docs/design-reference/`.
- [ ] axe-core: zero serious or critical violations for each theme at its default accent and at all four presets.
- [ ] Lighthouse mobile ≥ 90 on `/b/[slug]/check` for each theme.
- [ ] Accent engine unit tests pass; Appearance settings refuse inaccessible colors.
- [ ] Footer, disclaimer version, both NMLS IDs, licensed states and EHO mark present on every surface; banned-word test passes over all templates and fixtures.
- [ ] Seed: three demo brokers, one per theme, different accents.
- [ ] `docs/DECISIONS.md` lists every judgment call (font loading, agency-admin theme, email dark-mode handling, anything that deviates from the reference).
