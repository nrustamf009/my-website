# Decisions log

Every judgment call made while building v2, newest at the bottom. Format: **decision** — why.

## Engine
- **Integer units everywhere** (cents, milli-percent, ratio ×10,000). Floats only inside amortization, rounded half-up once per output. — Avoids penny drift between UI, PDF and webhook payloads.
- **DSCR rounds down, LTV rounds up.** — Conservative: never overstate coverage or understate leverage near a cutoff.
- **Rate↔DSCR fixed point, ≤3 passes, worse bucket on oscillation.** — The grid prices by DSCR bucket, but DSCR depends on the rate.
- **A worse DSCR bucket is never priced cheaper than a better one** (gridRate uses the max adjustment of the bucket and all better ones). — The default `<0.75` adjustment of 0 made DSCR non-monotonic at the 0.75 boundary; the property test caught it.
- **Qualifying payment = initial payment** (interest-only payment for IO products). — Matches how most DSCR lenders qualify IO; the post-IO payment is shown alongside.

## Money List
- **Benefit kinds: SAVINGS, CASH_OUT, NONE.** NONE rows (ARM reset, anniversary, prepay expiry without a positive estimate) show "Review" / "Check-in" instead of a dollar figure. — Never show a $0 or negative "opportunity".
- **What-if rate is a URL parameter, not a saved broker setting.** — Per-user exploration should not change what teammates or the digest see. `Broker.whatIfRateMilli` is unused and kept only for backward compatibility.
- **Dedupe key = lowercase email + normalized address.** Re-importing the same LOS export updates rows instead of duplicating them; status and history are kept.
- **ARM rows without a reset date assume a 5/6 ARM** (first reset 60 months after closing). — The most common DSCR ARM; the LO can edit it.
- **Prepay term column**: header containing "month" means months, "year" means years; otherwise values ≤5 are read as years. — LOS exports use both.
- **AI drafts carry no numbers of their own.** Facts are pre-formatted by the engine; a guard rejects any $ or % figure not present in the facts, plus banned words. One retry, then the deterministic template. The compliance footer (NMLS IDs, EHO, SMS opt-out) is appended by code, never by the model.
- **Money List defaults: 60-month horizon, 3% refi closing costs** (were 36 / 3.5%). — DSCR investors typically hold 5+ years; with 36 months a 1.1-point rate drop on a fresh-penalty loan ranked as "Review", which a broker would never believe.
- **Cash out counts as the benefit only when a seasoning trigger fired.** — Otherwise equity alone ranks every old loan first and buries real rate/prepay opportunities.
- **Slow savings (breakeven past the horizon) are shown to the LO but never pitched**: the row reads "Review" with "$X/mo, breakeven month N" as a hint, and the draft gets no dollar figure.

## Listing Snapshot
- **Taxes and insurance are stored on the snapshot when it is created** (typed, public record, or state table). — The flyer, the investor page and any re-download must show the same numbers even if state defaults change later.
- **Default quoted rate = the broker grid's best-tier purchase rate** (740+, DSCR ≥1.20, 30-yr fixed, 5-4-3-2-1). The investor page's "Adjust assumptions" calculator re-prices from the grid, so changing FICO or DSCR changes the rate there.
- **A scan is counted in the browser** (a beacon after the page renders), once per visitor per listing per 6 hours, and never for the broker's own staff. — Link-preview bots and prefetches don't run JavaScript, so they don't inflate realtor stats.
- **RESPA language is a co-marketing statement, not legal advice**: "independent companies; no fee or thing of value is paid for referrals; you may choose any lender." Shown on the flyer, the investor page and the realtor stats email.
- **Modern template drops the rows already shown in its DSCR cards** to stay on one Letter page.

## Scenario Sheet
- **Option rates default to the program grid, re-priced on the option's own DSCR bucket** (`priceScenarioOption`, ≤3 passes). The LO types the lender's real rate to override; "Price from grid" restores it.
- **Default options: A 30-yr fixed (recommended), B 30-yr with 10-yr IO, C 30-yr fixed with 1 point** (same prepay), so C is a true buydown with a visible breakeven vs A.
- **Refinance cash to the investor is shown only when the LO enters the payoff**; without it, refis show cash to close (prepaids + points), as before.
- **Opens are tracked per page load** (visit key) with visible-time pings every 15 s; first open and any open 24 h+ after the previous visit notify the owning LO by email and send `scenario.viewed`. Staff previews are never tracked.
- **The investor can switch their pick**; each pick notifies again. The question is optional and capped at 1,000 characters.
- **Expired links (30 days) show an "ask your LO" page; re-sharing an expired scenario restarts the 30 days.** Revoked links can't be re-shared; duplicate instead.

## Notes-to-Scenario
- **No audio in v1.** `TranscriptionProvider` exists as a stub behind `TRANSCRIPTION_ENABLED=true`; it throws. Paste-only keeps us out of call-recording consent rules and storage.
- **Extraction writes nothing.** The review step is client state; the DB is touched only on "Create". The pasted text is kept only if the LO ticks the box, and can be deleted later. Extraction is rate-limited (40/hour per user) and never logged.
- **Stated monthly taxes/insurance are annualized by the engine** (`annual()`); blanks fall back to the state table.
- **Option structures follow the conversation**: prefers amortizing → fixed, fixed + 1 point, 7/6 ARM; wants IO → IO, fixed, IO + 1 point; otherwise fixed, IO, fixed + 1 point. Loan from the stated down payment (default 25%), clamped to 50–80% LTV.
- **The investor becomes a lead with source NOTES** (deduped by email/phone). No web consent is recorded for these; it's the LO's own contact.
- **Follow-up email footer (NMLS IDs, EHO, estimate language) is appended by code**, same as Money List drafts.

## Leads, ROI, crons
- **CCPA deletion removes the lead and its consents and anonymizes scenarios built for that person**; events keep only non-identifying metadata (`lead.deleted`, reason). Broker admins only.
- **CSV export uses Papa's `escapeFormulae`** so names like `=HYPERLINK(...)` can't execute in Excel.
- **Status changes send `lead.updated` with `previousStatus`** so Zapier/Make can branch without polling.
- **Crons are idempotent by timestamp**: weekly ROI skips brokers mailed in the last 6 days, the agency rollup and Money List digest skip anything sent in the last 25 days. Safe to retry or run more often.
- **Webhook retries run every 10 minutes** (`/api/cron/webhooks`). Vercel Hobby only allows daily crons; on Hobby, retries happen daily (documented in the README).
- **Cron routes require `Authorization: Bearer $CRON_SECRET` whenever the secret is set**; without a secret they run only outside production.

## Tooling and security
- **`npm run lint` is a project guard script (`scripts/lint.mjs`), not ESLint.** ESLint + `eslint-config-next` would be new dependencies (CLAUDE.md: ask first). The guards enforce the non-negotiables that matter most: banned words, money math only in `lib/dscr`, no raw Prisma on tenant tables, server-action exports. TypeScript strict mode covers the rest. Adding ESLint is a one-line decision for the owner.
- **Public tokens are 24 characters from a 54-char alphabet (≈138 bits), rejection-sampled** (the first version used 10–14 characters and modulo sampling, below the spec's 128 bits).
- **The engine exposes `downPaymentRatio`, `escrowCents`, `cashToBorrowerCents` and `penaltyTodayCents`** so PDFs and pages never subtract or multiply money themselves.
- **`design:css` and `design:gallery` scripts are part of the design-system phase** (src/design), which starts after the plan is approved.
- **Lighthouse (mobile, production build, 2026-11-13):** `/b/harborline/check` perf 90 · a11y 100 · best practices 96 · SEO 100; listing page 96/100/96; scenario page 96/100/93. Listing and scenario pages score SEO 66 on purpose: they are private links with `noindex`. Fixed after the run: missing favicon (console 404) and 11px fine print on public pages (now 12px).

## Design system
- **Theme stored as a validated string** (`Broker.theme`, `Agency.defaultTheme`), like every other enum-like column; `db push` workflow kept.
- **Platform pages (landing, sign-in) use maison with an ink accent; the agency admin uses terminal with an ink accent** (DESIGN §3.3 default).
- **Token contract additions:** `positive`, `negative`, `focus`, `dim`, derived `*Tint` colors, a full type-role scale, `radius.cta`/`radius.logo`, `shadow`. Without them components would hard-code status colors or branch on theme for type sizes.
- **Tailwind's radius and shadow scales are remapped to theme tokens**, so existing `rounded-2xl` cards become square in maison/atelier and 12px in terminal without touching feature code. Accent *text* always uses `accentText` (`.text-accent` override), never the raw fill color.
- **Font loading:** the five OFL families are self-hosted in `src/design/fonts` (downloaded once by `npm run design:fonts`; WOFF2 for the web, TTF for react-pdf) and declared with `next/font/local`, `preload: false`. Only the active theme's variable classes are applied, so the browser downloads only that theme's files. `next/font/google` was dropped after a production build failed on a transient Google Fonts response; builds and CI must not depend on the network.
- **Migration guard:** `scripts/design-legacy.json` lists files that still contain hex/font/px literals; `npm run lint` fails on any new offender and on any listed file that is already clean, so the list can only shrink.
- **Terminal PDFs use Courier for mono numerals.** fontkit (react-pdf's font engine) throws on IBM Plex Mono's GPOS table for common strings like "$2,524", from both Google's TTF and Fontsource's WOFF. The web keeps IBM Plex Mono; print falls back to the PDF-standard monospace.
- **PDF theme travels in AsyncLocalStorage, not React context.** App-router server code cannot use `createContext`; `withPdfTheme(theme, accent, render)` scopes the kit per render, so concurrent PDFs never mix brokers.
