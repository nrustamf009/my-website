# DSCR Investor Toolkit v2: Plan

This plan evolves the v1 codebase already on this branch (Next.js, Prisma, Auth.js, five modules, about 60% reusable). The v2 spec changes the data model (cents, LOs, events, program grid), the engine, and the compliance layer. Those are rebuilt. The UI shell, design system, providers, PDF/email plumbing and tests are kept and extended.

---

## 0. Pushback: what I'd change in the spec, and what I'll do by default

| # | Spec item | Concern | Default I'll use (→ DECISIONS.md) |
|---|---|---|---|
| P1 | "Rates as basis points" | DSCR rates move in 1/8ths: 7.125% = 712.5 bps, which isn't an integer. | Store rates as **milli-percent** integers (7.125% → `7125`). Store ratios (LTV, DSCR thresholds) as integer **ten-thousandths** (80% → `8000`, DSCR 1.20 → `12000`). Money stays in integer cents. |
| P2 | "No floating-point money" | Amortization needs exponentiation, so it can't be done in integers. | Rate math in float64, then **round half-up to cents at one documented boundary per output**. All sums and differences are done on integer cents. Rounding rules are documented in `lib/dscr/README.md` and covered by the golden file. |
| P3 | **Business-purpose / occupancy** (missing from spec) | DSCR loans are business-purpose credit on non-owner-occupied property. An investor who plans to live in the property is in TILA/RESPA/ATR territory, and a DSCR estimate is wrong for them. | Every public form gets a required acknowledgment: *"This is an investment property. I will not live in it."* It's stored with the consent record. The copy says "business-purpose loans for investment properties". |
| P4 | Rate adjustments by **DSCR bucket** | This is circular: the rate sets PITIA, PITIA sets DSCR, and DSCR sets the rate. | Solve with a fixed-point loop (≤3 passes). If a bucket oscillates, take the more conservative one. The steps are shown in the golden file. |
| P5 | One max-LTV grid | Cash-out caps are lower than purchase caps (typically 75% vs 80%). One grid would overstate cash-out. | The grid has **per-mode** LTV tables: purchase, rate-term and cash-out, each FICO × DSCR. Default cash-out is 5 points lower. |
| P6 | Lead status "qualified" | This conflicts with the banned-words rule (and a grep check would flag it). | Pipeline stages: `new / contacted / in progress / closed / lost`. |
| P7 | Widget bundle < 100 KB | Next's own runtime is about 100 KB gzipped before our code. | The standalone and embed pages are server-rendered and **work without JS** (a GET form computes on the server). JS enhances live updates. I'll report our JS on top of the framework and treat Lighthouse ≥ 90 as the binding target. If you need a hard 100 KB total, I'd build the embed as a separate vanilla bundle (about +1 day). |
| P8 | Webhook retries with backoff on Vercel | Vercel **Hobby** cron runs at most once a day, so minute-level backoff needs Pro. | Inline attempt plus 2 quick retries (≈1 s, 5 s), then a retry-sweep cron. The schedule is every 15 min on Pro and daily on Hobby (documented). The broker sees every attempt in the delivery log. |
| P9 | 50-state tax/insurance table "with sensible values" | I can't ship authoritative per-state rates without a licensed source. Insurance in FL, TX and LA varies more than any single number can capture. | Ship **rough planning defaults**, labeled as such in UI and docs, editable per broker. The property provider's tax figure wins when available, and the user can override everything. |
| P10 | Prepay structures | Some states restrict prepayment penalties, mostly for loans to individuals rather than LLCs. The engine can't know this. | The engine supports all listed structures. The compliance checklist tells brokers to confirm prepay availability by state and vesting. No state rules are encoded (they'd be invented). |
| P11 | Module 4 co-branded flyer | Under **RESPA Section 8**, giving a realtor free marketing can count as a "thing of value" for referrals. A modest realtor block reduces the risk but doesn't remove it. | The flyer is the broker's financing flyer and the realtor block is ≤ 20% of the area. The README, the admin panel and the compliance checklist recommend legal review and, where counsel advises, pro-rata cost sharing. Not legal advice. |
| P12 | All user-facing strings in one place | Spanish v2 is for **investors**. Centralizing every dashboard label now doubles the work. | `lib/strings/en.ts` holds every **investor- and realtor-facing** string (public pages, PDFs, emails, AI-draft footers). Dashboard strings are module-local. Noted for v2. |
| P13 | Audio uploads (built in v1) | The spec says no audio in MVP. | Remove the upload UI, routes and Blob code. Keep a `TranscriptionProvider` interface stub behind `FEATURE_TRANSCRIPTION=false`. |
| P14 | Cash-out seasoning | The spec wording is easy to misread. | <6 months: no cash-out (delayed financing out of scope). 6–12 months: value capped at **purchase price** (documented improvements out of scope). ≥12 months: **appraised/estimated value**. Thresholds are configurable. |
| P15 | Rate buydown lever in "what to change" | The solver needs a pricing assumption that the spec doesn't give. | Grid setting `buydownMilliPerPoint` (default 0.25% of rate per 1 point), labeled in UI as an assumption. |
| P16 | Prepaids in cash to close | Not defined in the spec. | Prepaids estimate = 12 months insurance + 3 months taxes. Documented and configurable. |
| P17 | Refi rent | On refinances many lenders use the **lesser of lease and market rent**. | Refi mode shows both when a lease amount is entered and uses the lesser. A note explains it. |

---

## 1. Folder structure (changes vs v1 marked ★)

```
app/
  (marketing)/page.tsx
  login/… dev/mailbox/
  onboarding/[step]/page.tsx            ★ 6-step wizard (agency can pre-fill)
  admin/                                agency: overview, brokers, ★ audit log, ★ monthly rollup
  dashboard/
    page.tsx                            today + ★ ROI panel (week/month)
    leads/ (list, [id], ★ export.csv)  ★ statuses, owner LO, notes, event timeline, delete (CCPA)
    money-list/ (+import, ★ new)        ★ manual add, snooze, not-interested, history
    snapshots/ realtors/                ★ realtor detail + "email stats to realtor"
    scenarios/ (new, [id], edit)        ★ expiry/revoke, prepay schedule table
    notes/ (new, [id])                  ★ renamed from calls; paste-only
    settings/ (branding, team ★, program grid ★, state defaults ★, disclaimers ★, notifications, webhooks, modules ★)
  b/[slug]/
    check/ embed/check/ embed.js        ★ purchase + cash-out modes, no-JS fallback, UTM
    s/[token]/ (+pdf)                   ★ expiry, owner LO, prepay schedule, expanded-option tracking, question box
    l/[token]/ (+pdf? no: broker downloads) ★ adjust-assumptions calculator
    unavailable/                        ★ suspended/disabled module page
  api/
    public/[slug]/lead | s/[token]/view|interest | l/[token]/scan
    rent-estimate, money-list/template, leads/export
    cron/ weekly-roi ★, monthly-digest, agency-rollup ★, webhook-retry ★
lib/
  dscr/                                 ★ rewritten: cents/milli/ratio units
    units.ts rounding.ts amortization.ts products.ts prepay.ts grid.ts state-defaults.ts
    analyze.ts (purchase | rate-term | cash-out) solvers.ts what-to-change.ts verdict.ts
    scenario.ts money-list.ts
    __tests__/golden.test.ts (+ golden.md with written-out arithmetic), property.test.ts
  db/ scoped.ts ★ (forBroker(brokerId) Prisma extension), client.ts
  compliance/ ★ disclaimers.ts consent.ts banned-words.ts
  events/ ★ emit.ts, queries for stats
  strings/en.ts ★
  providers/ rent (RentCast + mock, now with tax record), ai (Claude + mock), email (Resend + dev),
             bot ★ (Turnstile + mock), address ★ (none), transcription ★ (stub, flag off), storage (data-URL)
  emails/ ★ React Email templates (lead-investor, lead-broker, scenario-share, scenario-viewed, interest,
             money-list-digest, weekly-roi, agency-rollup, invite, magic-link)
  pdf/ ★ shared tokens with web/email; BrokerPdfFooter
  webhooks/ ★ queue + backoff + log
components/ ★ BrokerFooter (single component), PaletteProvider (accent → AA-checked palette)
.github/workflows/ci.yml ★   docs/ ★ ARCHITECTURE.md DECISIONS.md ONBOARDING.md EMBED.md WEBHOOKS.md COMPLIANCE.md DEMO.md
```

---

## 2. Prisma schema (v2)

The schema stays portable between SQLite and Postgres: no enums, and JSON is stored as `String` and validated with zod. Units: `*Cents` is integer cents, `*Milli` is milli-percent, `*Ratio` is ratio × 10,000.

```prisma
model Agency { id String @id @default(cuid()); name String; slug String @unique; logoUrl String?; accentColor String
  brokers Broker[]; users User[]; audits AuditLog[]; createdAt DateTime @default(now()) }

model User {                                   // agency admins and loan officers
  id String @id @default(cuid()); email String @unique; name String?; emailVerified DateTime?
  role String          // AGENCY_ADMIN | BROKER_ADMIN | LO
  agencyId String?; brokerId String?
  nmlsId String?; phone String?; title String?; headshotUrl String?; active Boolean @default(true)
  accounts Account[]; createdAt DateTime @default(now()) }
model Account { … Auth.js … }   model VerificationToken { … }

model Broker {
  id String @id @default(cuid()); agencyId String; slug String @unique
  status String @default("TRIAL")                 // TRIAL | ACTIVE | SUSPENDED
  features String                                 // {"check":true,"moneyList":true,"snapshot":true,"scenario":true,"notes":true}
  companyName String; companyNmlsId String; logoUrl String?; accentColor String
  phone String?; email String; websiteUrl String?; privacyPolicyUrl String?
  licensedStates String                           // ["TX","FL"]
  notificationEmails String                       // ["ops@…","lo@…"]
  webhookUrl String?; webhookSecret String
  tonePreset String @default("FRIENDLY")          // FRIENDLY | DIRECT | CONSULTATIVE | CUSTOM (+ toneCustom)
  toneCustom String?
  programGrid String                              // ProgramGrid JSON (§4)
  stateOverrides String @default("{}")            // Partial<StateDefaults>
  marketRateMilli Int?; whatIfRateMilli Int?; marketRateUpdatedAt DateTime?
  moneyListRules String                           // MoneyListRules JSON
  currentDisclaimerId String?
  onboardingStep Int @default(0); isDemo Boolean @default(false)
  createdAt DateTime @default(now()) }

model DisclaimerVersion { id String @id @default(cuid()); brokerId String; version Int; text String; createdAt DateTime @default(now())
  @@unique([brokerId, version]) }

model Lead {
  id String @id @default(cuid()); brokerId String; ownerUserId String?
  source String          // WIDGET | SNAPSHOT | SCENARIO | NOTES | MANUAL
  status String @default("NEW")   // NEW | CONTACTED | IN_PROGRESS | CLOSED | LOST
  name String; email String; phone String?; phoneE164 String?
  propertyAddress String?; state String?
  engineInput String; engineOutput String        // frozen snapshot of lib/dscr in/out
  realtorId String?; snapshotId String?; scenarioId String?
  utmSource String?; utmMedium String?; utmCampaign String?; utmTerm String?; utmContent String?; referrer String?
  disclaimerVersionId String; notes String?
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  consents Consent[]
  @@index([brokerId, createdAt]) @@index([brokerId, email]) }

model Consent { id String @id @default(cuid()); brokerId String; leadId String
  kind String            // CONTACT (TCPA) | MARKETING | INVESTMENT_PROPERTY
  textVersion String; text String; granted Boolean; ip String; userAgent String; createdAt DateTime @default(now()) }

model Event { id String @id @default(cuid()); brokerId String; type String  // lead.created, scenario.opened, scenario.reopened, scenario.option_expanded, scenario.interest, snapshot.scanned, moneylist.contacted, …
  entityType String; entityId String; actorUserId String?; meta String @default("{}"); createdAt DateTime @default(now())
  @@index([brokerId, type, createdAt]) }

model AuditLog { id String @id @default(cuid()); agencyId String; actorUserId String; action String; targetBrokerId String?; meta String; createdAt DateTime @default(now()) }

model Scenario {
  id String @id @default(cuid()); brokerId String; ownerUserId String; token String @unique  // 22-char base62 ≥ 128 bits
  status String @default("DRAFT")  // DRAFT | SHARED | ARCHIVED
  expiresAt DateTime; revokedAt DateTime?
  mode String            // PURCHASE | RATE_TERM | CASH_OUT
  investorName String; investorEmail String?; investorPhone String?; leadId String?
  propertyAddress String; state String; propertyType String; units Int @default(1); use String @default("LTR")
  valueCents Int; currentBalanceCents Int?; currentRateMilli Int?
  rentCents Int; leaseRentCents Int?; taxesAnnualCents Int; insuranceAnnualCents Int; hoaMonthlyCents Int @default(0)
  ficoBucket String; note String?
  interestedOptionId String?; interestedAt DateTime?; interestQuestion String?
  firstOpenedAt DateTime?; lastNotifiedAt DateTime?
  options ScenarioOption[]; views ScenarioView[]
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt }

model ScenarioOption { id String @id @default(cuid()); scenarioId String; label String
  product String          // FIXED30 | IO30 | IO40 | ARM5_6 | ARM7_6
  loanAmountCents Int; rateMilli Int; pointsRatio Int @default(0)   // negative = lender credit
  feesCents Int @default(0); prepay String   // 5-4-3-2-1 | 3-2-1 | 5-5-5-5-5 | 3-3-3 | 2-1 | 1 | NONE
  recommended Boolean @default(false); sortOrder Int }

model ScenarioView { id String @id @default(cuid()); scenarioId String; visitKey String @unique; device String
  startedAt DateTime @default(now()); lastSeenAt DateTime @default(now()); activeSeconds Int @default(0) }

model Realtor { id String @id @default(cuid()); brokerId String; name String; brokerage String; phone String?; email String?
  logoUrl String?; headshotUrl String?; createdAt DateTime @default(now()) }

model Snapshot { id String @id @default(cuid()); brokerId String; ownerUserId String; realtorId String; token String @unique
  template String @default("CLASSIC")  // CLASSIC | MODERN
  address String; state String; propertyType String; listPriceCents Int; rentCents Int; rentSource String
  taxesAnnualCents Int; insuranceAnnualCents Int; hoaMonthlyCents Int @default(0); rateMilli Int; photoUrl String?
  createdAt DateTime @default(now()) }

model LoanImport { id String @id @default(cuid()); brokerId String; filename String; rowCount Int; mapping String; createdAt DateTime @default(now()) }

model ClosedLoan {
  id String @id @default(cuid()); brokerId String; importId String?
  borrowerName String; email String @default(""); phone String?; propertyAddress String; addressKey String
  loanAmountCents Int; rateMilli Int; closingDate DateTime
  product String           // FIXED | IO | ARM
  armFirstResetDate DateTime?
  prepayType String; prepayTermMonths Int
  ltvAtClosingRatio Int?; closingValueCents Int?; notes String?
  status String @default("OPEN")    // OPEN | CONTACTED | SNOOZED | NOT_INTERESTED | WON
  snoozedUntil DateTime?; draftEmail String?; draftSms String?; draftedAt DateTime?
  history LoanStatusChange[]
  @@unique([brokerId, email, addressKey]) }

model LoanStatusChange { id String @id @default(cuid()); loanId String; from String; to String; note String?; userId String?; createdAt DateTime @default(now()) }

model SavedNote { id String @id @default(cuid()); brokerId String; userId String; extraction String
  sourceText String?   // only if the broker ticks "save pasted text"
  checklist String; followUp String; scenarioId String?; createdAt DateTime @default(now()) }

model WebhookDelivery { id String @id @default(cuid()); brokerId String; eventType String; payload String
  status String          // PENDING | SUCCESS | FAILED
  attempts Int @default(0); nextAttemptAt DateTime?; lastHttpStatus Int?; lastError String?
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  @@index([status, nextAttemptAt]) }

model PropertyCache { addressKey String @id; rentCents Int?; rentLowCents Int?; rentHighCents Int?; taxesAnnualCents Int?; provider String; fetchedAt DateTime @default(now()) }
model RateLimitHit { … }   model DevEmail { … }
```

**Tenant scoping.** `db.forBroker(brokerId)` is a Prisma client extension. It injects `where.brokerId` on every read, update and delete of tenant models, sets it on create, and throws if a query targets a tenant model without scope. Raw `prisma.*` on tenant models is banned by a lint rule plus a test. Cross-tenant tests try to read, update and delete another broker's lead, scenario and loan, and every attempt must fail.

---

## 3. Routes

| Surface | Route | Notes |
|---|---|---|
| Public | `/b/[slug]/check` | Purchase and cash-out modes. Works without JS (GET-form server calc). Captures UTM. |
| | `/b/[slug]/embed/check`, `/b/[slug]/embed.js` (`data-broker`) | postMessage auto-resize. Guides for WordPress, Wix, Squarespace and GoDaddy are in docs/EMBED.md. |
| | `/b/[slug]/s/[token]` (+`/pdf`) | Expiry (default 30 days) and revoke. Shows the owning LO, prepay schedule table, option-expand tracking, and interest with an optional question. |
| | `/b/[slug]/l/[token]` | Property page with "Adjust assumptions" (the Module 1 calculator) and a financing-estimate form. |
| | `/b/[slug]/unavailable` | Shown for suspended brokers and disabled modules. |
| Broker | `/onboarding/[1..6]`, `/dashboard/**` (see §1) | `requireBroker()` plus a feature-flag gate per module. |
| Agency | `/admin`, `/admin/brokers/[id]`, `/admin/audit`, `/admin/rollup` | Impersonation writes an AuditLog entry and shows a persistent banner. |
| API | `/api/public/**` | Rate-limited and checked by Turnstile. |
| | `/api/leads/export` | CSV export. |
| | `/api/cron/{weekly-roi,monthly-digest,agency-rollup,webhook-retry}` | Protected by `CRON_SECRET`. |

---

## 4. Engine data shapes

```ts
type FicoBucket = "740+" | "700-739" | "680-699" | "660-679" | "<660";
type DscrBucket = ">=1.20" | "1.00-1.19" | "0.75-0.99" | "<0.75";
type Mode = "PURCHASE" | "RATE_TERM" | "CASH_OUT";
type Product = "FIXED30" | "IO30" | "IO40" | "ARM5_6" | "ARM7_6";
type Prepay = "5-4-3-2-1" | "3-2-1" | "5-5-5-5-5" | "3-3-3" | "2-1" | "1" | "NONE";

interface ProgramGrid {
  baseRateMilli: number;                                         // 7125 = 7.125%
  maxLtvRatio: Record<Mode, Record<FicoBucket, Record<DscrBucket, number | null>>>;  // null = not eligible
  rateAdjMilli: { fico: Record<FicoBucket, number>; dscr: Record<DscrBucket, number>; product: Record<Product, number>; prepay: Record<Prepay, number> };
  subOneDscrEnabled: boolean;                                    // default false
  minLoanCents: number; maxLoanCents: number;                    // 100_000_00 / 3_000_000_00
  ficoFloor: number;                                             // 660
  strongDscrRatio: number;                                       // 12000 = 1.20
  minDscrRatio: number;                                          // 10000
  reservesMonths: number;                                        // 6
  closingCostRatio: { purchase: number; refi: number };          // 300 / 350
  prepaids: { insuranceMonths: number; taxMonths: number };      // 12 / 3
  buydownMilliPerPoint: number;                                  // 250
  cashOutSeasoningMonths: { purchasePriceCap: number; appraisedValue: number }; // 6 / 12
}

type StateDefaults = Record<UsState /* 50 + DC */, { taxRatio: number; insuranceRatio: number }>;  // annual % of value ×10,000
```

Verdict tiers:

- **Looks strong:** DSCR ≥ strong and LTV within the cap.
- **Borderline:** DSCR ≥ min and within the cap.
- **Needs adjustment:** fails, but a single lever fixes it.
- **Not eligible under current defaults:** FICO below the floor, DSCR < 0.75, or outside the loan limits.

UI copy comes from `lib/strings`. A banned-words test greps `app/`, `components/`, `lib/strings`, `lib/emails`, `lib/pdf` and the AI prompts and outputs.

---

## 5. Provider interfaces

```ts
interface PropertyProvider { lookup(a: NormalizedAddress): Promise<{ rentCents?: number; rentLowCents?: number; rentHighCents?: number; taxesAnnualCents?: number; provider: "rentcast" | "mock"; cached: boolean } | null> }
interface AddressProvider  { suggest(q: string): Promise<NormalizedAddress[]> }      // default: NoneAddressProvider + normalize()
interface BotCheck         { verify(token: string | null, ip: string): Promise<boolean> }  // Turnstile | mock (always true)
interface AiClient {
  extractNotes(text: string): Promise<NotesExtraction>;                          // strict JSON schema, no numbers invented: numbers only if quoted in text
  draftOutreach(ctx: OutreachFacts, tone: TonePreset): Promise<{ email: string; sms: string }>;  // ctx carries engine output as strings; footer appended by code
  draftFollowUp(ctx: FollowUpFacts, tone: TonePreset): Promise<{ subject: string; body: string }>;
}
interface Mailer           { send(msg: { to: string[]; subject: string; react: ReactElement; text: string; replyTo?: string; attachments?: … }) }
interface TranscriptionProvider { transcribe(): never }                            // stub; FEATURE_TRANSCRIPTION=false
```

The AI rule: prompts receive pre-formatted engine numbers as tokens, for example `{"monthlySavings":"$412"}`. The model is told to quote them verbatim and never compute. A post-check rejects drafts that contain a `$` or `%` figure not present in the input facts, then retries once and falls back to a template.

---

## 6. Build order

1. Engine + golden file + property tests (show golden.md).
2. Data layer: scoped client, events, webhooks queue, compliance (disclaimers, consent, footer, palette/AA), React Email, Turnstile, auth roles (BROKER_ADMIN/LO), onboarding wizard, agency admin + audit, ROI panel.
3. Modules in order 1 → 3 → 4 → 2 → 5. Each module gets a mobile Playwright smoke test, a "no math outside lib/dscr" grep check and a banned-words check, plus a short report.
4. Seed (demo banner), docs set, CI, mobile and Lighthouse pass.

**Migration of v1 data:** none needed (demo-only). `db:reset` rebuilds the database.
