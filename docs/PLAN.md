# DSCR Investor Toolkit: Build Plan

## 1. Key technical decisions

| Topic | Decision | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict, Tailwind v4 | Requested; Vercel-native |
| DB | Prisma; **SQLite locally, Postgres (Neon via Vercel Marketplace) in prod**. A `scripts/prisma-provider.mjs` step switches the datasource provider at build time when `DATABASE_URL` starts with `postgres` | Lets the app run in 3 commands with no Docker |
| Portability | No Prisma enums and no `Json` columns. Enum-like fields are `String` validated with zod; JSON is stored as `String` and parsed through zod | Same schema works on SQLite and Postgres |
| Money units | Dollar amounts are whole-dollar `Int` in the DB; rates are `Float` annual percent (7.25); monthly results are rounded to cents only at the output edge | Simple, no float drift in storage |
| Auth | Auth.js v5, Email (magic link) provider via Resend, Prisma adapter, **JWT sessions** (middleware can check the role without a DB call). Roles: `AGENCY_ADMIN`, `BROKER`. Without `RESEND_API_KEY`, the magic link goes to the dev mailbox and the server console | Self-serve keys, zero-config dev |
| Impersonation | Signed, httpOnly `impersonate` cookie (HMAC with `AUTH_SECRET`), honored only when the session role is `AGENCY_ADMIN`. A persistent "Viewing as X — Stop" banner is shown | Safe and auditable |
| Tenancy | Every dashboard query goes through `requireBroker()`, which returns `brokerId`. Prisma calls are always scoped by `brokerId`, and public routes resolve broker by slug + token | One choke point |
| PDF | `@react-pdf/renderer` (no headless Chrome on Vercel) | Small bundle, works on serverless |
| QR | `qrcode` package, rendered as a data URL into the PDF. The QR URL is `/b/[slug]/l/[token]?src=qr`, and a scan is logged when `src=qr` | No extra service |
| Logos | Uploaded logo is stored as a data URL in the DB (≤256 KB, PNG/SVG/JPG), or the broker can give an https URL | No storage key needed |
| Audio upload | Local: multipart to a route handler, written to `os.tmpdir()`. Vercel: files over 4.5 MB need **Vercel Blob client upload** (`BLOB_READ_WRITE_TOKEN`, self-serve). Max file size is 25 MB (Whisper limit). The file is deleted in a `finally` block after transcription, and the Blob object is deleted too | Vercel body limit is 4.5 MB |
| Email | `Mailer` interface: Resend, or **DevMailbox** (stored in the `DevEmail` table, viewable at `/dev/mailbox`) when there is no key | Demo works with zero keys; the agency can see every email |
| Webhooks | JSON POST with an `X-DSCR-Signature: sha256=<hmac>` header and an `X-DSCR-Event` header. Sent in `after()` (non-blocking) with a 5 s timeout and logged to `WebhookDelivery`. The dashboard has "Send test" and "Redeliver" buttons | Brokers wire up Zapier/Make/any CRM |
| AI | `AiClient` interface: Claude (Anthropic TS SDK, structured JSON output validated with zod) or Mock (rule-based extraction + templates). Model set by `ANTHROPIC_MODEL`, default `claude-sonnet-5-5` to keep per-broker cost low | Mock mode when no key |
| Rent | `RentProvider` interface: RentCast or Mock. Results are cached for 30 days in `RentEstimateCache` (normalized address) because the RentCast free tier is 50 calls/month. The value is always editable | Cost control |
| Spam | Public forms use a honeypot field, a minimum time-to-submit, and a per-broker+email rate limit (DB count) | No CAPTCHA key needed |
| Compliance | Consent text + timestamp are stored with every lead. No SSN, DOB, or documents are collected. A `log()` helper redacts email, phone, and transcript fields. Public token pages are `noindex` | Requested principles |
| E2E | Playwright (preinstalled Chromium) with one spec per module | Verify after each module |

## 2. Folder structure

```
app/
  page.tsx                         # product landing (agency-facing) + sign in
  login/page.tsx, login/check-email/page.tsx
  dev/mailbox/page.tsx             # only when the mock mailer is active
  admin/                           # AGENCY_ADMIN only
    page.tsx                       # cross-broker stats
    brokers/page.tsx, brokers/new/page.tsx, brokers/[id]/page.tsx
  dashboard/                       # BROKER (or impersonating admin)
    layout.tsx                     # sidebar, impersonation banner
    page.tsx                       # overview: leads, views, opportunities
    leads/page.tsx, leads/[id]/page.tsx
    snapshots/page.tsx, snapshots/new/page.tsx, snapshots/[id]/page.tsx, realtors/page.tsx
    money-list/page.tsx, money-list/import/page.tsx
    scenarios/page.tsx, scenarios/new/page.tsx, scenarios/[id]/page.tsx
    calls/page.tsx, calls/new/page.tsx, calls/[id]/page.tsx   # review form
    settings/page.tsx              # branding, defaults, rules, tone, webhook, embed code
  b/[slug]/
    layout.tsx                     # broker theme (--accent CSS var), header, footer w/ NMLS + disclaimer
    page.tsx                       # -> redirect to check
    check/page.tsx                 # Module 1
    embed/check/page.tsx           # chrome-less iframe version (auto-resize via postMessage)
    embed.js/route.ts              # <script> that injects the iframe
    s/[token]/page.tsx             # Module 2 public scenario
    s/[token]/pdf/route.ts
    l/[token]/page.tsx             # Module 4 property page
  api/
    auth/[...nextauth]/route.ts
    rent-estimate/route.ts         # public (slug-scoped, rate-limited) + dashboard
    public/[slug]/check/lead/route.ts
    public/[slug]/s/[token]/view/route.ts      # start + heartbeat (sendBeacon)
    public/[slug]/s/[token]/interest/route.ts
    public/[slug]/l/[token]/lead/route.ts
    money-list/template/route.ts   # CSV template download
    calls/upload/route.ts          # + Blob client-upload token route
    cron/money-list-digest/route.ts  # Vercel Cron, protected by CRON_SECRET
  (server actions live next to their pages in actions.ts)

components/
  ui/            # Button, Input, Card, Badge, Stat, Table, Dialog, Toast (hand-built, no template look)
  public/        # BrandHeader, DisclaimerFooter, VerdictCard, NumberField, LeadForm
  dashboard/     # Sidebar, ImpersonationBanner, ...
  pdf/           # DealAnalysisPdf, ScenarioPdf, ListingSnapshotPdf (react-pdf)

lib/
  dscr/          # ALL financial math (pure, no I/O)
    payment.ts   # monthlyPI, monthlyEscrow, monthlyPITIA, dscr
    solvers.ts   # maxLoanAmount, minDownPayment, maxPurchasePrice, minRentForDscr
    eligibility.ts # verdict, FICO→LTV caps, "what to change" suggestions
    analyze.ts   # analyzeDeal() used by Modules 1, 4, 5
    scenario.ts  # computeOption() for Module 2 (points/fees → cash to close)
    prepay.ts    # prepay schedules 5-4-3-2-1 / 3-2-1 / none, penalty % at a date
    refi.ts      # rate-drop savings, cash-out equity estimate
    defaults.ts  # BrokerDefaults type + system defaults
    __tests__/   # ≥12 hand-calculated scenarios
  moneylist/     # csv.ts (parse, column mapping, validation), rules.ts (date rules → uses lib/dscr), digest.ts
  providers/
    rent/        # types.ts, rentcast.ts, mock.ts, index.ts (factory by env)
    transcription/ # types.ts, whisper.ts (any OpenAI-compatible /audio/transcriptions), mock.ts
    ai/          # types.ts, claude.ts, mock.ts, prompts.ts, schemas.ts (zod)
    email/       # types.ts, resend.ts, dev-mailbox.ts, templates/*.tsx
    storage/     # temp audio: local tmp or Vercel Blob
  webhooks/      # events.ts (typed payloads), dispatch.ts (sign, send, log)
  auth/          # auth.ts (Auth.js config), session.ts (requireAdmin/requireBroker), impersonation.ts
  tracking/      # scenario view logic + "notify broker" rules (first open, re-open ≥24h)
  db.ts, env.ts (zod-validated env), log.ts (redacting logger), tokens.ts, format.ts (display only)
prisma/schema.prisma, prisma/seed.ts
seed/            # generators: brokers, leads, scenarios, closed-loans CSV, snapshots
  transcripts/call-1.txt, call-2.txt
scripts/prisma-provider.mjs
tests/e2e/       # module1.spec.ts ... module5.spec.ts
vercel.json      # cron
```

## 3. Prisma schema (draft)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"  url = env("DATABASE_URL") }   // switched to postgresql at build

// ---------- Auth.js ----------
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  emailVerified DateTime?
  image         String?
  role          String    @default("BROKER")      // AGENCY_ADMIN | BROKER
  agencyId      String?
  brokerId      String?
  agency        Agency?   @relation(fields: [agencyId], references: [id])
  broker        Broker?   @relation(fields: [brokerId], references: [id])
  accounts      Account[]
  createdAt     DateTime  @default(now())
}
model Account { /* standard Auth.js adapter fields */ }
model VerificationToken { identifier String; token String @unique; expires DateTime; @@unique([identifier, token]) }

// ---------- Tenancy ----------
model Agency {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  logoUrl     String?
  accentColor String   @default("#0F766E")
  brokers     Broker[]
  users       User[]
  createdAt   DateTime @default(now())
}

model Broker {
  id                String   @id @default(cuid())
  agencyId          String
  agency            Agency   @relation(fields: [agencyId], references: [id])
  slug              String   @unique
  active            Boolean  @default(true)
  // Branding & contact
  name              String               // loan officer
  companyName       String
  nmlsId            String
  companyNmlsId     String?
  logoUrl           String?              // data: URL or https URL
  accentColor       String   @default("#1F4E79")
  email             String
  phone             String?
  website           String?
  licensedStates    String?              // "TX, FL, GA"
  notificationEmail String
  webhookUrl        String?
  webhookSecret     String
  disclaimerText    String
  messageTone       String   @default("Friendly and professional, concise, no jargon")
  // DSCR defaults
  minDscr           Float    @default(1.0)
  maxLtv            Float    @default(0.80)
  defaultRate       Float    @default(7.5)
  taxRatePct        Float    @default(1.2)    // annual, % of price
  insuranceRatePct  Float    @default(0.5)    // annual, % of price
  ficoLtvCaps       String   // JSON: [{"minFico":740,"maxLtv":0.80},{"minFico":680,"maxLtv":0.75},...]
  // Money List rules
  marketRate          Float?
  marketRateUpdatedAt DateTime?
  rateDropThreshold   Float    @default(0.75) // points below client rate
  prepayWindowDays    Int      @default(60)
  seasoningMonths     String   @default("[6,12]")
  digestEnabled       Boolean  @default(true)
  lastDigestAt        DateTime?
  createdAt         DateTime @default(now())

  users User[]; leads Lead[]; scenarios Scenario[]; closedLoans ClosedLoan[]; loanImports LoanImport[]
  realtors Realtor[]; snapshots Snapshot[]; calls CallSession[]; webhookDeliveries WebhookDelivery[]
}

// ---------- Leads ----------
model Lead {
  id              String    @id @default(cuid())
  brokerId        String
  broker          Broker    @relation(fields: [brokerId], references: [id])
  source          String    // CHECK | LISTING | SCENARIO
  name            String
  email           String
  phone           String?
  consentAt       DateTime
  consentText     String
  propertyAddress String?
  purchasePrice   Int?
  downPaymentPct  Float?
  monthlyRent     Int?
  ficoRange       String?   // "740+", "700-739", "660-699", "620-659", "<620"
  resultJson      String?   // analyzeDeal() output frozen at submit time
  snapshotId      String?
  snapshot        Snapshot? @relation(fields: [snapshotId], references: [id])
  realtorId       String?
  realtor         Realtor?  @relation(fields: [realtorId], references: [id])
  scenarioId      String?
  status          String    @default("NEW")   // NEW | CONTACTED | ARCHIVED
  createdAt       DateTime  @default(now())
  @@index([brokerId, createdAt])
}

// ---------- Module 2: Scenario Sheet ----------
model Scenario {
  id                 String   @id @default(cuid())
  brokerId           String
  broker             Broker   @relation(fields: [brokerId], references: [id])
  token              String   @unique
  status             String   @default("DRAFT")  // DRAFT | SHARED | ARCHIVED
  origin             String   @default("MANUAL") // MANUAL | CALL
  investorName       String
  investorEmail      String?
  investorPhone      String?
  propertyAddress    String
  loanPurpose        String   @default("PURCHASE") // PURCHASE | RATE_TERM | CASH_OUT
  propertyValue      Int
  monthlyRent        Int
  taxesMonthly       Float
  insuranceMonthly   Float
  hoaMonthly         Float    @default(0)
  note               String?  // personal note shown on the public page
  interestedOptionId String?
  firstOpenedAt      DateTime?
  lastNotifiedAt     DateTime?
  createdAt          DateTime @default(now())
  options            ScenarioOption[]
  views              ScenarioView[]
}

model ScenarioOption {
  id             String   @id @default(cuid())
  scenarioId     String
  scenario       Scenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  label          String   // "A" | "B" | "C"
  loanAmount     Int
  ratePct        Float
  termYears      Int      @default(30)
  interestOnly   Boolean  @default(false)
  ioYears        Int?     // e.g. 10
  prepay         String   @default("5-4-3-2-1")  // 5-4-3-2-1 | 3-2-1 | NONE
  pointsPct      Float    @default(0)
  lenderFees     Int      @default(0)
  sortOrder      Int      @default(0)
}

model ScenarioView {
  id            String   @id @default(cuid())
  scenarioId    String
  scenario      Scenario @relation(fields: [scenarioId], references: [id], onDelete: Cascade)
  visitKey      String   // random per tab, no IP stored
  device        String   // mobile | desktop
  startedAt     DateTime @default(now())
  lastSeenAt    DateTime @default(now())
  activeSeconds Int      @default(0)
  @@index([scenarioId, startedAt])
}

// ---------- Module 3: Money List ----------
model LoanImport {
  id        String   @id @default(cuid())
  brokerId  String
  broker    Broker   @relation(fields: [brokerId], references: [id])
  filename  String
  rowCount  Int
  mapping   String   // JSON column mapping used
  createdAt DateTime @default(now())
  loans     ClosedLoan[]
}

model ClosedLoan {
  id              String    @id @default(cuid())
  brokerId        String
  broker          Broker    @relation(fields: [brokerId], references: [id])
  importId        String?
  import          LoanImport? @relation(fields: [importId], references: [id])
  borrowerName    String
  email           String?
  phone           String?
  propertyAddress String
  loanAmount      Int
  ratePct         Float
  closingDate     DateTime
  prepayType      String    // 5-4-3-2-1 | 3-2-1 | NONE | OTHER
  prepayTermYears Int       // 0 when NONE
  interestOnly    Boolean
  draftMessage    String?
  draftedAt       DateTime?
  contactedAt     DateTime?
  createdAt       DateTime  @default(now())
  @@unique([brokerId, propertyAddress, closingDate])   // re-import is idempotent
}

// ---------- Module 4: Listing Snapshot ----------
model Realtor {
  id        String     @id @default(cuid())
  brokerId  String
  broker    Broker     @relation(fields: [brokerId], references: [id])
  name      String
  brokerage String
  email     String?
  phone     String?
  logoUrl   String?
  createdAt DateTime   @default(now())
  snapshots Snapshot[]
  leads     Lead[]
}

model Snapshot {
  id            String   @id @default(cuid())
  brokerId      String
  broker        Broker   @relation(fields: [brokerId], references: [id])
  realtorId     String
  realtor       Realtor  @relation(fields: [realtorId], references: [id])
  token         String   @unique
  address       String
  price         Int
  monthlyRent   Int
  rentSource    String   // RENTCAST | MOCK | MANUAL
  ratePct       Float
  taxesMonthly  Float
  insuranceMonthly Float
  hoaMonthly    Float    @default(0)
  createdAt     DateTime @default(now())
  scans         SnapshotScan[]
  leads         Lead[]
}

model SnapshotScan {
  id         String   @id @default(cuid())
  snapshotId String
  snapshot   Snapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  device     String
  createdAt  DateTime @default(now())
}

// ---------- Module 5: Call-to-Scenario ----------
model CallSession {
  id            String   @id @default(cuid())
  brokerId      String
  broker        Broker   @relation(fields: [brokerId], references: [id])
  inputType     String   // AUDIO | NOTES
  status        String   // TRANSCRIBING | EXTRACTED | CONVERTED | FAILED
  transcript    String?  // kept so the broker can review; audio is never stored
  extraction    String?  // JSON (zod: CallExtraction)
  checklist     String?  // JSON string[]
  followUpEmail String?
  scenarioId    String?
  errorCode     String?  // never raw error text with PII
  createdAt     DateTime @default(now())
}

// ---------- Infra ----------
model RentEstimateCache {
  id         String   @id @default(cuid())
  addressKey String   @unique   // normalized address
  rent       Int
  rentLow    Int?
  rentHigh   Int?
  provider   String
  fetchedAt  DateTime @default(now())
}

model WebhookDelivery {
  id         String   @id @default(cuid())
  brokerId   String
  broker     Broker   @relation(fields: [brokerId], references: [id])
  event      String   // lead.created | scenario.viewed | scenario.option_interest | ...
  payload    String
  status     String   // SUCCESS | FAILED
  httpStatus Int?
  attempts   Int      @default(1)
  createdAt  DateTime @default(now())
}

model DevEmail {          // only written when RESEND_API_KEY is absent
  id        String   @id @default(cuid())
  to        String
  subject   String
  html      String
  attachments String?  // JSON [{filename, size}]
  createdAt DateTime @default(now())
}
```

## 4. Routes

**Public (branded, mobile-first, disclaimer + NMLS footer on every page)**
- `/b/[slug]/check`: Module 1 widget
- `/b/[slug]/embed/check` + `/b/[slug]/embed.js`: iframe embed and one-line script tag
- `/b/[slug]/s/[token]`: scenario comparison, PDF download, "I'm interested in option X"
- `/b/[slug]/s/[token]/pdf`: scenario PDF
- `/b/[slug]/l/[token]`: listing property page + pre-qualify form (QR target)

**Broker dashboard** `/dashboard/...`: overview, leads, snapshots (+ realtors & per-realtor stats), money-list (+ import, template, digest trigger), scenarios, calls, settings (branding, defaults, rules, tone, webhook test, embed snippet)

**Agency admin** `/admin/...`: stats across brokers, create/edit broker, invite broker user, impersonate / stop

**API**: Auth.js, rent estimate, public lead/view/interest endpoints, CSV template, call upload, cron digest (`CRON_SECRET`). Dashboard mutations use server actions.

## 5. Provider interfaces

```ts
// lib/providers/rent/types.ts
export interface RentEstimateInput { address: string; bedrooms?: number; bathrooms?: number; squareFootage?: number; propertyType?: "single_family" | "condo" | "townhouse" | "multi_family"; priceHint?: number }
export interface RentEstimate { rent: number; rentLow?: number; rentHigh?: number; provider: "rentcast" | "mock"; cached: boolean }
export interface RentProvider { estimate(input: RentEstimateInput): Promise<RentEstimate | null> }   // null = unavailable, the UI falls back to manual

// lib/providers/transcription/types.ts
export interface TranscriptionInput { filePath: string; filename: string; mimeType: "audio/mpeg" | "audio/mp4" | "audio/x-m4a" }
export interface Transcriber { transcribe(input: TranscriptionInput): Promise<{ text: string; durationSec?: number }> }
// WhisperTranscriber: POST {TRANSCRIBE_BASE_URL}/audio/transcriptions (OpenAI, Groq, any compatible), model from TRANSCRIBE_MODEL

// lib/providers/ai/types.ts
export interface CallExtraction {
  investor: { name?: string; email?: string; phone?: string; experience?: string }
  deal: { propertyAddress?: string; loanPurpose?: "PURCHASE" | "RATE_TERM" | "CASH_OUT"; purchasePrice?: number; estimatedValue?: number;
          downPaymentPct?: number; monthlyRent?: number; ficoRange?: string; propertyType?: string; units?: number;
          interestOnlyInterest?: boolean; prepayPreference?: "5-4-3-2-1" | "3-2-1" | "NONE"; targetRatePct?: number }
  goals: string[]; objections: string[]; nextSteps: string[]; missingInfo: string[]
}
export interface AiClient {
  extractCall(transcript: string): Promise<CallExtraction>                       // zod-validated
  draftOutreach(ctx: OutreachContext, tone: string): Promise<string>             // Money List message
  draftFollowUpEmail(ctx: FollowUpContext, tone: string): Promise<{ subject: string; body: string }>
}

// lib/providers/email/types.ts
export interface Mailer { send(msg: { to: string; subject: string; html: string; text: string; replyTo?: string;
  attachments?: { filename: string; content: Buffer }[] }): Promise<{ id: string }> }

// lib/webhooks/events.ts (outbound, versioned)
type WebhookEvent =
  | { event: "lead.created"; data: { lead; source: "CHECK" | "LISTING"; realtor? ; numbers } }
  | { event: "scenario.viewed"; data: { scenarioId; investorName; firstView: boolean } }
  | { event: "scenario.option_interest"; data: { scenarioId; option: "A" | "B" | "C"; ... } }
  | { event: "money_list.contacted"; data: { ... } }
  | { event: "test"; data: {} }
// envelope: { id, event, version: 1, brokerSlug, occurredAt, data }
```

Every provider has a `getX()` factory: real implementation when its env key is set, otherwise the mock. The active modes are shown in Settings ("Rent: Mock", etc.).

## 6. lib/dscr API (pure functions)

- `monthlyPI({ loanAmount, ratePct, termYears, interestOnly })`: standard amortization, IO = L·r/12, handles 0 % rate
- `monthlyPITIA({ pi, taxesMonthly, insuranceMonthly, hoaMonthly })`, `escrowFromPrice(price, taxRatePct, insRatePct)`
- `dscr(rent, pitia)`: returns `null` when PITIA is 0
- Solvers: `maxLoanAmount` = min(maxLtv·price, payment capacity from rent/minDscr − TIH), `minDownPayment`, `maxPurchasePrice` (closed form with taxes/insurance as % of price), `minRentForDscr`
- `verdict()`: Likely (DSCR ≥ min + 0.05 and LTV ≤ FICO cap), Borderline (within ±0.05 of min, or only LTV blocks), Unlikely (otherwise or FICO < 620). Thresholds come from broker defaults
- `whatToChange()`: ranked suggestions (more down payment → X%, rent ≥ $Y, price ≤ $Z, interest-only option)
- `prepayPenaltyPct(type, closingDate, asOf)`, `refiSavings(...)`, `cashOutEquity(...)`

## 7. Environment variables (all optional except DB/auth secret)

`DATABASE_URL`, `AUTH_SECRET`, `APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `RENTCAST_API_KEY`, `TRANSCRIBE_API_KEY`, `TRANSCRIBE_BASE_URL`, `TRANSCRIBE_MODEL`, `BLOB_READ_WRITE_TOKEN` (Vercel only, for audio > 4.5 MB), `CRON_SECRET`.

## 8. Seed (`npm run db:seed`)

Seeds the agency "Northbeam Growth Partners" plus admin `admin@demo.test`. It creates 3 fictional brokers with distinct branding (e.g. *Harborline Lending* (navy), *Cactus Ridge Mortgage* (terracotta), *Evergreen Key Capital* (green)), ~20 leads, 5 scenarios with view history, and 4 snapshots across 3 realtors with scans and leads. It also generates a 60-row closed-loans CSV **with dates relative to today**, so Money List always finds 8–12 opportunities (a test asserts this), imported through the real CSV pipeline. Two call transcripts are written to `seed/transcripts/`. All names use reserved/fictional data (`.test` emails, 555-01xx phones).

## 9. Build order

1. Scaffold + `lib/dscr` + tests (run)
2. Auth, tenancy, agency admin, impersonation
3. Module 1 → 4 → 3 → 2 → 5. After each: run the app, Playwright spec for the key flow, fix, short report
4. README: 3-command run, keys table, cost per broker/month, 10-minute demo script
