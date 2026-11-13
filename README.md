# DSCR Investor Toolkit

A white-label SaaS for US mortgage brokers who do **DSCR loans** (investment-property loans qualified on the property's rent, not the borrower's income). An agency sells it to its broker clients; each broker gets their own brand, NMLS details, loan officers, public pages, leads and integrations.

| Module | What it does |
|---|---|
| **1. DSCR Instant Check** | Branded public calculator (`/b/[slug]/check`) and a one-line embed. Purchase or cash-out refi; DSCR, verdict tier ("Looks strong / Borderline / Needs adjustment / Not eligible under current defaults"), payment, cash needed, max loan and **what to change** (rent, down payment, price, buydown). Investors trade contact info (TCPA consent, Turnstile) for a PDF estimate; the lead, broker email and signed webhook follow. |
| **2. Scenario Sheet** | 2–3 loan options side by side (product, rate, points/credit, fees, prepay) on a private mobile page (`/b/[slug]/s/[token]`) with a PDF. Tracks opens, time on page and which option's details were read; emails the LO on the first open and on a return 24 h+ later; "I'm interested in Option B" + optional question. 30-day expiry, revoke. |
| **3. Money List** | Import closed loans from the LOS (CSV mapping, validation, dedupe, re-import updates). Daily re-check for prepay expiry, 6/12-month seasoning, rate drops, ARM resets and anniversaries, ranked by estimated net benefit. AI email + SMS drafts with a code-appended compliance footer; contacted / snooze / not interested / won; monthly digest. |
| **4. Listing Snapshot** | Co-branded one-page flyer for a realtor's listing (2 templates): payment, DSCR, cash flow and cash to close at 20% and 25% down, rent needed for DSCR 1.00/1.20, QR to a live investor page with a financing form. Per-realtor stats and a stats email. RESPA co-marketing note. |
| **5. Notes-to-Scenario** | Paste call notes, an email or a transcript. Claude extracts the deal into a strict schema, the LO reviews it (nothing saved until confirm), and one click creates a draft scenario, a tailored DSCR document checklist and a follow-up email. |
| **Leads CRM-lite** | Status, owner, notes, consents, event timeline, CSV export, CCPA deletion. The webhook stays the main integration. |
| **Agency admin** | Create brokers (onboarding wizard), status and per-module flags, team invites, impersonation with an audit log, usage and churn signals, monthly rollup email. |

No MLS, credit bureau or lender data. No SSNs, documents or audio. **Every integration has a working mock, so the whole product runs with zero API keys.**

## Run it in 3 commands

```bash
npm install
npm run setup      # .env, SQLite database and demo data
npm run dev        # http://localhost:3000/login
```

Node 20+. In development `/login` has one-click demo accounts:

| Account | Role |
|---|---|
| `admin@northbeam.example` | Agency admin (Northbeam Growth Partners) |
| `maya@harborline.example` | Broker admin, Harborline Lending (TX, FL, GA, NC) |
| `theo@harborline.example` | Loan officer, Harborline Lending |
| `daniel@cactusridge.example` | Broker admin, Cactus Ridge Mortgage (AZ, NV, NM, UT) |
| `priya@evergreenkey.example` | Broker admin, Evergreen Key Capital (WA, OR, ID) |

Without `RESEND_API_KEY` every email (magic links, PDFs, alerts, digests) lands in the **dev mailbox** at `/dev/mailbox`. Reseed any time with `npm run seed`. The 10-minute demo script is in [docs/DEMO.md](docs/DEMO.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm test` | Engine golden + property tests, CSV/AI/guard unit tests, cross-tenant isolation tests (needs the seeded DB) |
| `npm run lint` | Project guard rails: banned words, money math only in `lib/dscr`, no raw Prisma on tenant tables, server-action exports |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:e2e` | Playwright against the dev server (mobile Pixel 7 for every module; desktop for admin, Money List, leads) |
| `npm run test:e2e:prod` | Reseed, production build, `next start`, full Playwright run (what CI does) |
| `npm run seed` | Reset demo data |

CI (`.github/workflows/ci.yml`) runs lint → typecheck → unit → production-build e2e on every push.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `file:./dev.db` locally. A Postgres URL on Vercel (the build switches the Prisma provider and pushes the schema). |
| `AUTH_SECRET` | yes | `openssl rand -base64 32` |
| `APP_URL` | yes | Public base URL for links, QR codes and embeds |
| `CRON_SECRET` | yes in prod | Bearer token for `/api/cron/*` (Vercel Cron sends it automatically) |
| `RESEND_API_KEY`, `EMAIL_FROM` | no | Real email. Free tier covers a pilot. Verify the sending domain. |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | no | Notes extraction and outreach/follow-up drafts. Default model `claude-opus-5-5`. Without a key a rule-based parser and templates are used. |
| `RENTCAST_API_KEY` | no | Rent estimates and property-tax records (cached 30 days per address). Without it: deterministic mock estimates. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | no | Cloudflare Turnstile on public forms (free). Honeypot + timing + rate limits always on. |
| `DEMO_LOGIN` | no | `true` enables one-click demo sign-in in production (hosted demo only). |
| `TRANSCRIPTION_ENABLED` | no | Reserved; audio is off in v1. |

## Cost per broker (estimate)

At **200 Instant Checks, 20 scenarios and 10 snapshots a month**:

| Service | Usage | Cost |
|---|---|---|
| Vercel + Neon Postgres | shared across all brokers | Hobby/free tiers cover a pilot; Pro when you need 10-minute webhook retries |
| Resend | ~150 emails (PDFs, alerts, digests, ROI) | inside the free tier for a few brokers |
| RentCast | ≤200 address lookups, fewer with the 30-day cache | free tier is 50/month; a paid plan for real volume |
| Claude | ~10 notes extractions + ~40 drafts | a few cents to low single dollars per broker per month, depending on the model (see anthropic.com/pricing) |
| Turnstile | public forms | free |

Check current vendor pricing before quoting a client; the expensive line is rent data, and the 30-day address cache keeps it predictable.

## Deploy to Vercel

1. Import the repo. Add **Neon Postgres** from the Vercel Marketplace (sets `DATABASE_URL`).
2. Set `AUTH_SECRET`, `APP_URL`, `CRON_SECRET` and any optional keys.
3. Deploy. The build switches Prisma to Postgres and pushes the schema. Seed a demo with `npm run seed` against the production URL only for a demo environment.
4. Crons (`vercel.json`): webhook retries every 10 minutes (Pro; daily on Hobby), weekly ROI emails (Mon), Money List digest and agency rollup (1st of the month).

## Docs

- [docs/SPEC.md](docs/SPEC.md) – product spec · [docs/DESIGN.md](docs/DESIGN.md) – design system (switchable themes)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – how it fits together, units, tenancy
- [docs/DECISIONS.md](docs/DECISIONS.md) – every judgment call
- [docs/ONBOARDING.md](docs/ONBOARDING.md) – agency checklist for a new broker
- [docs/EMBED.md](docs/EMBED.md) – putting the Instant Check on a broker's site
- [docs/WEBHOOKS.md](docs/WEBHOOKS.md) – events, signatures, Zapier and Make recipes
- [docs/COMPLIANCE.md](docs/COMPLIANCE.md) – compliance checklist (not legal advice)
- [docs/DEMO.md](docs/DEMO.md) – 10-minute demo script
