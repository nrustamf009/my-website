# Architecture

Next.js 15 (App Router, React 19, Server Actions) · Prisma 6 (SQLite locally, Postgres on Vercel) · Auth.js v5 (magic link + demo credentials, JWT sessions) · @react-pdf/renderer · React Email + Resend · Claude (structured outputs) · Tailwind v4.

```
app/
  b/[slug]/check | l/[token] | s/[token] | embed/…   public, branded, no auth
  api/public/[slug]/…                               lead, property, event beacons, scenario view/expand/interest/pdf
  api/cron/…                                        webhooks, weekly-roi, money-list-digest, agency-rollup
  dashboard/…                                       broker app (LO + broker admin; agency admin when impersonating)
  admin/…                                           agency admin
  onboarding/[step]                                 6-step setup wizard
lib/
  dscr/        ALL money math. Pure, deterministic, no I/O. Golden + property tests.
  db/          prisma client, forBroker() tenant scope, systemDb for crons
  actions/     server actions (one file per module)
  providers/   email, ai, property, address, bot, transcription — each with a mock
  pdf/ emails/ PDF and email templates (format numbers, never compute them)
  compliance/  disclaimers (versioned), consent text, banned words
  strings/en   every investor-facing string (Spanish later: same shape)
components/    UI; public/* for investor pages
seed/          demo data (dates relative to now)
tests/         unit (incl. cross-tenant), e2e (Playwright, mobile-first)
scripts/       setup, lint guards, prisma provider switch, prod e2e runner
```

## Money: units and rounding (`lib/dscr`)

| Quantity | Unit | Example |
|---|---|---|
| Money | integer cents | $1,234.56 → `123456` |
| Rates | milli-percent | 7.125% → `7125` |
| Ratios (LTV, DSCR, points, prepay %) | ×10,000 | 80% → `8000`, DSCR 1.20 → `12000`, 1 point → `100` |

Floats only inside amortization, rounded half-up once per output. **DSCR rounds down, LTV rounds up** (conservative near cutoffs). The grid prices by DSCR bucket while DSCR depends on the rate, so `analyzeDeal` runs a fixed point (≤3 passes, worse bucket on oscillation). The UI, PDFs, emails and AI prompts only *format* engine output (`lib/format.ts`); `npm run lint` fails on arithmetic over `*Cents/*Milli/*Ratio` values outside `lib/dscr` (boundary parsing in providers/CSV/forms is exempt).

Main entry points: `analyzeDeal` (Instant Check), `computeScenarioOption` / `priceScenarioOption` (Scenario Sheet), `evaluateClosedLoan` / `rankMoneyList` (Money List), `listingSnapshot` (Listing Snapshot), `whatToChange`, `minRentForDscr`, `maxLoanAmount`, `estimateEscrow`.

## Tenancy

Agency → Broker (tenant) → Users (BROKER_ADMIN, LO). Every tenant table carries `brokerId`.

- `forBroker(id)` is a Prisma extension that injects `brokerId` into every `where` and stamps every `create`; a foreign `brokerId` in a create throws. Child tables (`ScenarioOption`, `ScenarioView`, `LoanStatusChange`) are filtered through their parent and can only be created with nested writes.
- `forBrokers(ids)` is read-only for agency dashboards. `systemDb` is for crons and webhook retries only.
- `requireBroker()` resolves the tenant from the session (or the signed impersonation cookie for agency admins) and returns the scoped client. Cross-tenant tests: `tests/unit/tenant.test.ts`; lint forbids raw `prisma.<tenantModel>` outside `lib/db`.

## Public links and tracking

Scenario and snapshot tokens are 24 random characters (≈138 bits, rejection-sampled), unguessable, and revocable or expirable. Beacons (`check.calculated`, `snapshot.scanned`, scenario views) run in the browser after render, are rate-limited per hashed IP and ignore the broker's own staff. Raw IPs are stored only on consent records (TCPA evidence).

## Events, notifications, webhooks

`emit()` appends to `Event` (powers dashboards, ROI emails, agency stats and timelines). Webhooks are queued in `WebhookDelivery`, signed with HMAC-SHA256 (`X-DSCR-Signature: sha256=…`), tried inline at 0 s/1 s/5 s, then retried by cron at 2 min, 10 min, 1 h, 6 h. See [WEBHOOKS.md](WEBHOOKS.md).

## AI

`lib/providers/ai`: `extractNotes` (strict JSON schema), `draftOutreach`, `draftFollowUp`. Facts passed to the model are pre-formatted strings from the engine; `guard.ts` rejects any `$` or `%` figure not present in the facts and any banned word, retries once, then falls back to a deterministic template. Compliance footers are appended by code. Without an API key a rule-based parser and templates run.

## Branding

Per-broker accent color goes through `lib/brand/palette.ts` (AA-checked text and on-accent colors, CSS variables). The switchable theme system (maison, terminal, atelier) is specified in [DESIGN.md](DESIGN.md) and is the next phase.
