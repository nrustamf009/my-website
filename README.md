# DSCR Investor Toolkit

A white-label SaaS for US mortgage brokers who do DSCR loans (investment property loans qualified on the property's rent). It's sold by an agency to its broker clients. Each broker gets their own brand, NMLS details, public pages, leads and integrations.

| Module | What it does |
|---|---|
| **1. DSCR Instant Check** | Public, branded calculator (`/b/[slug]/check`) plus an embeddable widget. Shows DSCR, a verdict, max loan and what to change to qualify. Investors swap their contact info for a PDF analysis. The lead is saved, the broker is emailed and the webhook fires. |
| **2. Scenario Sheet** | Compare 2–3 loan options for an investor on a mobile-friendly page (`/b/[slug]/s/[token]`) with a PDF. The broker is emailed on the first open and again on a return visit 24+ hours later. Tracks time on page and has an "I'm interested in option B" button. |
| **3. Money List** | CSV import of closed loans, with column mapping and validation. Ranks past clients by prepay expiry, cash-out seasoning and rate drop. AI drafts outreach in the broker's tone. Includes a monthly digest via Vercel Cron. |
| **4. Listing Snapshot** | One-page co-branded PDF for realtors, with DSCR at 20% and 25% down and a QR code. The QR opens a property page that captures leads tagged to the realtor. Includes per-realtor stats. |
| **5. Call-to-Scenario** | Upload a call (mp3/m4a) or paste notes. It transcribes, Claude extracts the deal, goals and objections, and one click creates a draft scenario, a DSCR document checklist and a follow-up email. The audio is deleted after processing. |
| **Agency admin** | Create brokers, impersonate a broker, and see stats across all brokers. |

No MLS, credit bureau or lender data. No SSNs and no borrower documents. Every integration has a mock, so the whole product runs with **zero API keys**.

---

## Run it in 3 commands

```bash
npm install
npm run setup      # creates .env, SQLite DB and demo data
npm run dev        # http://localhost:3000/login
```

Requires Node 20+. In development, the sign-in page has **one-click demo accounts**:

| Account | Role |
|---|---|
| `admin@northbeam.example` | Agency admin (Northbeam Growth Partners) |
| `maya@harborline.example` | Broker: Harborline Lending (navy) |
| `daniel@cactusridge.example` | Broker: Cactus Ridge Mortgage (terracotta) |
| `priya@evergreenkey.example` | Broker: Evergreen Key Capital (green) |

Magic-link sign-in also works. Without `RESEND_API_KEY`, every email (magic links, PDFs, alerts, digests) goes to the **dev mailbox** at `/dev/mailbox`.

Reset the demo at any time with `npm run db:reset`.

### Demo data (`npm run db:seed`)

All of it is fictional:

- 1 agency, 3 brokers with different branding.
- ~28 leads, 5 scenarios with open history, 4 listing snapshots with QR scans.
- 102 closed loans. Harborline's 60-loan CSV is built so the Money List finds **10 opportunities** (a unit test checks the count stays at 8–12 at any date). Dates are relative to today, so the demo never goes stale.
- The CSVs are written to `seed/out/` and can be re-uploaded on the import page.
- 2 sample call transcripts in `seed/transcripts/`. They're also one click away on the Call-to-Scenario page.

---

## API keys (all optional, all self-serve in minutes)

| Variable | Used for | Where to get it | Without it |
|---|---|---|---|
| `AUTH_SECRET` | Session signing | `openssl rand -base64 32` (setup generates it) | required |
| `DATABASE_URL` | Database | Local: `file:./dev.db`. Vercel: Neon Postgres via Vercel Marketplace (Storage → Create → Neon) | required |
| `APP_URL` | Links in emails, QR codes, embeds | Your deployed URL | `http://localhost:3000` |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email | resend.com → API Keys. Verify a domain to send from your own address | Dev mailbox at `/dev/mailbox` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Call extraction, outreach drafts, follow-up emails | console.anthropic.com → API Keys. Default model `claude-opus-5-5`; set `claude-sonnet-5-5` to halve the cost | Rule-based mock AI |
| `RENTCAST_API_KEY` | Rent estimates | app.rentcast.io → API (free Developer plan) | Deterministic mock estimates, clearly labeled |
| `TRANSCRIBE_API_KEY`, `TRANSCRIBE_BASE_URL`, `TRANSCRIBE_MODEL` | Call transcription (any OpenAI-compatible `/audio/transcriptions`) | OpenAI: platform.openai.com (`whisper-1`). Groq: console.groq.com, base URL `https://api.groq.com/openai/v1`, model `whisper-large-v3` | Mock transcript |
| `BLOB_READ_WRITE_TOKEN` | Call recordings over 4.5 MB on Vercel | Vercel → Storage → Blob | Uploads limited to ~4.5 MB on Vercel; unlimited locally up to 25 MB |
| `CRON_SECRET` | Protects `/api/cron/money-list-digest` | Any random string; Vercel Cron sends it automatically | Cron endpoint returns 401 |
| `DEMO_LOGIN` | One-click demo accounts and dev mailbox in production | Set `true` only on a demo deployment | Off in production |

The broker dashboard's **Settings → Integrations status** shows which providers are live and which are mocked.

---

## Estimated external API cost per broker per month

These figures are rough and based on list prices. Check current prices before quoting them to clients.

Assumptions for an active broker: 150 Instant Checks (~100 unique addresses after the 30-day rent cache), 40 leads, 20 scenarios, 30 Money List drafts, 15 calls of about 12 minutes, and ~250 emails.

| Service | Usage | Est. cost |
|---|---|---|
| Claude (Opus 5.5: $4 / $20 per M tokens) | 15 extractions (≈$0.05 each) + 15 follow-ups (≈$0.02) + 30 drafts (≈$0.01) | **≈ $1.50–$3.00** (about half with `claude-sonnet-5-5`) |
| Whisper transcription (OpenAI `whisper-1`, $0.006/min) | 180 min | **≈ $1.10** (Groq is cheaper) |
| RentCast | ~100 lookups (results cached 30 days per address) | Free plan covers 50/mo. Above that, a paid plan shared across all brokers on one key, typically **a few dollars per broker**. Check rentcast.io pricing |
| Resend | ~250 emails | Free tier covers 3,000/mo across the agency. Pro starts at $20/mo for the whole agency |
| Vercel + Neon + Blob | shared hosting | Usually fits Hobby or Pro plus Neon free or launch tier; spread across all brokers |

**Total: about $3–$10 per broker per month in variable API cost**, plus shared hosting.

---

## Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add Neon Postgres from the Vercel Marketplace. It sets `DATABASE_URL`.
3. Set `AUTH_SECRET`, `APP_URL`, `CRON_SECRET`, plus any optional keys from the table above.
4. Deploy. `npm run build` switches Prisma to PostgreSQL and runs `prisma db push` automatically (`scripts/prisma-provider.mjs`).
5. Optional demo data: `DATABASE_URL=<postgres url> npx tsx prisma/seed.ts`. On a demo deployment, set `DEMO_LOGIN=true`.
6. `vercel.json` schedules the Money List digest at 14:00 UTC on the 1st of each month.

To give a broker real access, sign in as the agency admin, then open **Brokers → Add broker** and enter their login email. They sign in by magic link.

---

## Webhooks (bring-your-own CRM)

Every broker can set a webhook URL in Settings (Zapier, Make, n8n or any CRM endpoint). Each event is a JSON `POST`:

```json
{ "id": "evt_…", "event": "lead.created", "version": 1, "brokerSlug": "harborline", "occurredAt": "2026-11-09T12:00:00Z", "data": { … } }
```

The events are `lead.created`, `scenario.viewed`, `scenario.option_interest`, `money_list.contacted` and `test`.

The headers are `X-DSCR-Event`, `X-DSCR-Delivery` and `X-DSCR-Signature: sha256=<hmac>`. Verify the signature like this:

```js
const expected = "sha256=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
```

Deliveries are logged. Settings shows the last 10 deliveries, a "Send test event" button and a "Redeliver" button.

Instead of SMS, use the webhook to trigger texts from your own CRM.

---

## Architecture

```
app/                 Next.js App Router
  b/[slug]/…         public branded pages (check, embed, scenario s/[token], listing l/[token])
  dashboard/…        broker dashboard        admin/…  agency admin
  api/…              public lead/view/interest endpoints, rent estimate, call upload, CSV template, cron
lib/
  dscr/              ALL financial math (pure functions, unit-tested)
  providers/         rent (RentCast | mock), ai (Claude | mock), transcription (Whisper-compatible | mock),
                     email (Resend | dev mailbox), storage (temp files | Vercel Blob)
  moneylist/         CSV parsing/mapping/validation, digest
  actions/           server actions (all tenant-scoped through requireBroker())
  pdf/               @react-pdf/renderer documents
  webhooks/          signed dispatch + delivery log
prisma/schema.prisma SQLite locally, PostgreSQL in production (no enums/Json columns, so both work)
seed/                demo data generators + sample transcripts
tests/unit, tests/e2e
```

Rules followed throughout:

- **All math goes through `lib/dscr`.** That covers PITIA, DSCR, IO and amortizing loans, the solvers (max loan, minimum down payment, max price, minimum rent), verdicts, scenario options, prepay schedules, refi savings and Money List rules. Components only format the results.
- **Tenant isolation.** Every dashboard query is scoped by the broker id from `requireBroker()`. Agency admins impersonate through a signed, httpOnly cookie, and a banner is always shown.
- **Compliance.** Every public page and PDF shows the disclaimer and the broker's NMLS ID, and states that figures are estimates, not an offer to lend. Lead consent text and a timestamp are stored. Scenario and listing pages are `noindex`. The broker's own previews are not counted as opens.
- **Privacy.** No SSNs or documents. View tracking uses a random per-tab key and stores no IP address. Rate limits use a hashed IP. Logs go through `lib/log.ts`, which redacts PII and never writes transcripts. Call audio exists only in a temp directory (or Blob) until transcription finishes, then it's deleted in a `finally` block.
- **Spam protection.** Public forms have a honeypot, a minimum time on the form, and per-IP and per-email rate limits.

### Verdict rules (configurable per broker in Settings)

- **Likely qualifies:** DSCR ≥ minimum DSCR and LTV ≤ the limit for the investor's FICO range.
- **Borderline:** DSCR within the borderline band (default 0.10) below the minimum, or only the LTV limit blocks the deal.
- **Unlikely:** anything else, or FICO below 620 (configurable limits per FICO range).

---

## Tests

```bash
npm test         # Vitest: 26 hand-verified lib/dscr scenarios, CSV import, Money List seed count, mock AI
npm run e2e      # Playwright: auth/admin, all 5 modules (desktop + mobile for public pages), settings
```

Playwright starts `npm run dev` automatically (or set `E2E_BASE_URL`). On first run, use `npx playwright install chromium` unless a browser is already installed.

---

## 10-minute demo script (selling to the agency)

**0:00 Setup (before the call).** Run `npm run db:reset` and open `/login` in one tab and `/dev/mailbox` in another.

**0:30 Agency view.** Sign in as **Alex (agency admin)**. Show the overview, which has leads, scenario opens, QR scans and Money List opportunities across 3 brokers. Then show **Brokers**: each one has their own brand and URL. *"You onboard a new broker client in 60 seconds: name, NMLS, color, login."*

**1:30 Instant Check (the lead magnet).** Open `/b/harborline/check` on your phone, or use responsive mode.

- Type an address. Rent pre-fills.
- Set the price to $400k and the rent to $2,300. It shows DSCR 0.83 and **Unlikely**, with "what to change" (more down, rent needed, target price).
- Bump the rent to $3,000 and it flips to DSCR 1.08 and **Likely qualifies**.
- Fill the form. In the mailbox you'll see the investor's PDF and the broker's alert.
- *"Every broker gets this on their own site with one script tag (Settings → Embed)."*

**3:30 Listing Snapshot (realtor channel).** Impersonate **Maya** → Listing Snapshots → New. Enter an address and price, click Estimate, pick a realtor, then Create → **Download PDF**. Open the property page, which is where the QR lands, and submit a pre-qualification. Show **Realtor stats**. *"Brokers hand this to realtors, and every scan and lead is attributed."*

**5:00 Money List (revenue from the existing book).** Show 10 ranked opportunities: prepay ending, 6- and 12-month seasoning, rate drop with dollar savings and breakeven. Click **Draft message**, then **Copy**, then **Mark contacted**. Change the market rate and the list re-ranks. Show **Email me the digest**. *"This is money sitting in their closed-loan file."*

**6:45 Scenario Sheet.** Open Nadia Okoro's scenario. It shows 3 opens, time on page and interest in Option B. Open the share link on a phone and show the comparison cards and the PDF. Tap **I'm interested** and the broker email arrives. *"Brokers know exactly when to call."*

**8:15 Call-to-Scenario.** Calls → New. Pick **Sample: duplex purchase** and click **Extract deal details**. Review the fields, then click **Create draft scenario + checklist + email**. You get a draft scenario, a DSCR document checklist and a follow-up email in the broker's tone. *"Ten minutes of post-call admin, done in one click."*

**9:30 Close.** White-label branding, no licensed data, no SSNs, about $3–$10 per broker per month in API costs, and webhooks into any CRM. Q&A.
