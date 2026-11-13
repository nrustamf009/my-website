# DSCR Investor Toolkit: Product spec (v2)

Senior full-stack + product partner who knows US DSCR / non-QM investor lending. Push back when a requirement would embarrass a broker in front of an investor or a compliance officer. Ambiguity → the defaults here → the simpler option, logged in docs/DECISIONS.md. Never invent domain rules. All UI, code, comments and docs in English.

## Who it is for
- Buyer: a marketing agency reselling white-label to mortgage brokers.
- Tenant: a US mortgage broker company doing DSCR loans, with 1..n loan officers (LOs).
- Public pages: real-estate investors (on phones) and realtors.
- The agency must prove ROI to each broker weekly. ROI visibility is a core feature.

## Core principles
- No licensed data (MLS, credit bureaus, lender APIs/rate sheets). No third-party documents, no SSNs, no audio uploads in MVP.
- Every external service has a self-serve key in < 10 minutes.
- Every number on screen, in PDFs, emails and AI drafts comes from lib/dscr. Claude never computes or invents numbers.
- Nothing reads like an approval: estimates only.
- Tenant isolation enforced in one place (scoped Prisma helper).

## Stack
Next.js App Router + TS strict + Tailwind; React Email. Postgres via Prisma (SQLite locally). Money in integer cents (rates in milli-percent, see DECISIONS). Auth.js magic link; public pages token-based. Resend email; no SMS; outbound HMAC-signed webhooks with retry/backoff and a broker-visible delivery log. @react-pdf/renderer, generated on demand, never stored. Claude via Anthropic TS SDK with JSON-schema outputs; mock without key. Property provider interface (RentCast + deterministic mock), 30-day cache per normalized address; every fetched number overridable. Optional address autocomplete interface (default none). Cloudflare Turnstile + honeypot + per-IP rate limit (mock without key). Vitest, Playwright, GitHub Actions. Vercel + cron.

## Tenancy and white-label
Agency → Broker (tenant) → User (LO) → Leads, Scenarios, Loans, Snapshots, Realtors, Events.
Broker: company name, company NMLS, logo, accent color, contact info, website, privacy policy URL, licensed states, notification email(s), webhook URL + secret, versioned disclaimer, tone preset, status (trial/active/suspended → suspended public pages show "unavailable"), per-module feature flags.
User (LO): name, individual NMLS, email, phone, headshot, title. Public pages show the owning LO's NMLS and the company NMLS.
Public pages at /b/[brokerSlug]/... fully branded (accent palette with AA-checked foreground, LO block, company NMLS, EHO, licensed states, NMLS Consumer Access link, versioned disclaimer) via one BrokerFooter + one PDF footer.
Onboarding wizard (~10 min; agency can pre-fill): branding → NMLS/licenses → program grid defaults → notification email + test → webhook + test → embed snippet. Agency creates brokers, invites LOs, impersonates (banner + audit log), sees cross-broker stats.

## Engine: lib/dscr (pure, tested)
Modes: purchase | rate-term refi | cash-out refi. Purchase: price, down % or $, closing costs (default 3%). Refi: value, balance, current rate, desired loan or cash-out, closing (default 3.5%). Gross rent (no vacancy factor), 2–4 unit rents. Annual taxes/insurance, monthly HOA; defaults from a per-state table (50 + DC, editable per broker) or the provider's tax record. Rate, term, product, FICO bucket, property type (SFR, 2–4, condo, townhome), use (LTR; STR flagged).
Products: 30-yr fixed; 30-yr with 10-yr IO; 40-yr with 10-yr IO; 5/6 and 7/6 ARM (fixed period, clearly labeled). Prepay: 5-4-3-2-1, 3-2-1, 5-5-5-5-5, 3-3-3, 2-1, 1, none, with a penalty-$-at-month-N function.
Program grid (per broker): max LTV by FICO × DSCR bucket (defaults 740+/700–739 80%, 680–699 75%, 660–679 70%, <660 not eligible; DSCR 0.75–0.99 → 70% only if "sub-1.0 programs" enabled; <0.75 not eligible). Rate adjustments by FICO and DSCR bucket on a base rate (default 7.125%). Min loan $100k, max $3M, strong DSCR 1.20, FICO floor 660, reserves 6 months PITIA.
Outputs: P&I (and IO), taxes, insurance, HOA, PITIA, DSCR, cash flow, LTV, loan amount, cash to close (down + closing + prepaids), reserves, total cash needed. Verdicts: "Looks strong" / "Borderline" / "Needs adjustment" / "Not eligible under current defaults". "What to change" solver per lever (down payment, price, rent, buydown) to the next tier, cheapest first. Solvers: max loan, min down, max price, min rent for a DSCR, max cash-out (seasoning + LTV caps). Money List math: months since closing, prepay status, seasoning, rate delta vs market, refi savings, net benefit = savings × horizon (36) − penalty − closing costs, breakeven month.
Quality: documented rounding, deterministic, no float money; ≥15 golden hand-verified scenarios; property-based monotonicity tests.

## Compliance and trust
Disclaimer (estimate, not a commitment to lend, subject to change, not all applicants qualify, figures estimated) on every public page, PDF and email; versioned; leads and PDFs record the version. TCPA express-written-consent checkbox (text version, timestamp, IP, UA) + separate marketing checkbox + privacy link. Never "APR". RESPA §8 note for Module 4 (broker-dominant flyer; legal review; not legal advice). No PII in logs. CCPA: delete a lead and derived records; CSV export.

## Module 1: DSCR Instant Check
/b/[slug]/check + embed.js (data-broker) auto-resizing iframe; link-in-bio version; WordPress/Wix/Squarespace/GoDaddy guides. Inputs: mode (purchase / cash-out), address, price/value, down % or cash-out, FICO, property type, rent (provider range, editable, appraiser note), taxes/insurance/HOA (provider or state table) under "Adjust assumptions". Output: PITIA breakdown, DSCR, cash flow, verdict, max loan, cash to close + reserves, cheapest "what to change". Step 2 (PDF): name, email, phone, consents, Turnstile → save lead (source widget, UTM), dedupe by email/phone within broker, email PDF, email broker, webhook, events. Small bundle; works without JS where feasible.

## Module 2: Scenario Sheet
2–3 options (product, rate, points/credits, prepay, fees, lender credit); engine computes payment (IO + post-IO), DSCR, cash to close, 5-year total cost, prepay schedule table. Public /b/[slug]/s/[token]: branded, mobile-first, PDF, expiry (30 days) and revoke, owning LO. Tracking: opens, time on page, expanded option; notify (email + webhook) on first open and on reopen 24h+ later. "I'm interested in option B" → optional question → broker + webhook + event.

## Module 3: Money List
CSV import with mapping, template, row validation, dedupe by borrower email + address, re-import updates; manual add. Fields: borrower, email, phone, address, loan amount, rate, closing date, product (fixed/IO/ARM + first reset), prepay type/term, LTV at closing, closing value, notes. Broker enters market rate (+ optional what-if). Triggers: prepay expired/expiring ≤60d; seasoning 6 mo (purchase price) / 12 mo (appraised); market ≥ X pts below (0.75); ARM reset ≤6 months; loan anniversary. Rank by net benefit then urgency; show reasons, number, breakeven. Claude drafts email + SMS-length text in the tone preset; compliance footer appended by code. Copy, Mark contacted, Snooze 30/60/90, Not interested, Notes, history. Monthly digest (cron + manual); weekly count in ROI email.

## Module 4: Listing Snapshot
Address, list price, optional photo, realtor entity (name, brokerage, phone, email, logo/headshot). Rent from provider/manual; taxes/insurance from provider/state table. One-page co-branded PDF (2 templates): payment and DSCR at 20% and 25% down, cash flow, rent for DSCR 1.0 and 1.2, cash to close, QR → /b/[slug]/l/[token] (numbers + "Adjust assumptions" calculator + "Get a financing estimate" form; lead tagged with realtor, source snapshot). Per-realtor stats (snapshots, scans, leads, last activity); email stats to realtor.

## Module 5: Notes-to-Scenario
Paste notes/email/transcript (no audio; TranscriptionProvider stub behind a flag). Claude → strict JSON: deal params, goals, objections, timeline, entity (LLC vs personal), use, next steps, missing info. Review form; nothing saved until confirmed. One click: draft Scenario via engine + tailored DSCR document checklist + follow-up email in tone. Pasted text not retained unless saved.

## Lead management
List with source, realtor, status (new / contacted / in progress / closed / lost), owner LO, notes, event timeline; CSV export. Webhook stays the primary integration.

## Notifications & analytics
Event table powers dashboards, agency stats, digests. Weekly ROI email per broker; monthly agency rollup. Webhook schema documented with Zapier/Make recipes; test button; delivery log with retry.

## Design/UX
Mobile-first; Lighthouse ≥ 90 public; WCAG AA. Editorial, not template. One type system across web, PDF, email. Teaching empty states. Strings for investors in one place (Spanish v2). See docs/DESIGN.md for the switchable theme system.

## Security
Scoped tenant helper + cross-tenant tests. Public tokens ≥128 bits, expirable, revocable. Rate limits on public routes. Signed webhooks. Secrets in env. Optional Sentry with PII scrubbing.

## Demo data
One command: agency, 3 fictional brokers (distinct branding, states, grids), LOs, realtors, leads across sources, 5 scenarios with opens, 60 closed loans (Money List 8–12 across all triggers), 4 snapshots with scans, 2 transcripts. Demo-mode banner.

## Deliverables
README (3 commands, env vars, keys, free tiers, cost per broker at 200 checks/20 scenarios/10 snapshots, Vercel deploy, cron), 10-minute demo script (lead → scenario → Money List refi → realtor flyer), onboarding checklist, embed guide, webhook/Zapier guide, compliance checklist (not legal advice), DECISIONS.md, ARCHITECTURE.md.

## Do not
Compute money outside lib/dscr; let Claude produce numbers; use banned words; log PII; store audio or PDFs; use real names; ship features needing non-self-serve keys.
