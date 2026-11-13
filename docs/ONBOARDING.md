# Onboarding a new broker (agency checklist)

Target: live in one 30-minute call. Everything below can be done by the agency while impersonating.

## Before the call
- [ ] Company legal name, **company NMLS ID**, licensed states, website, privacy policy URL
- [ ] Logo (PNG/SVG, square works best) and brand color
- [ ] Each LO: name, title, email, phone, **individual NMLS ID**, headshot (optional)
- [ ] Where leads should go: notification emails and, if they use a CRM, a webhook URL (Zapier/Make/GoHighLevel/Follow Up Boss)
- [ ] Their typical DSCR pricing: base rate, FICO and DSCR adjustments, max LTVs, prepay pricing (we start from defaults)

## In the admin
1. **Admin → Brokers → New broker**. Pick the plan's modules (sell tiers by turning modules on/off).
2. The broker admin gets a magic-link invite; or click **Impersonate** to pre-fill the wizard.
3. Wizard (6 steps): Branding → Licensing (NMLS, states) → Program grid → State defaults → Notifications + webhook → Share.
4. Settings → Team: invite each LO. Each LO gets their own links (`?lo=slug`) so leads route to them.
5. Settings → Compliance: review the disclaimer (versioned; every lead records the version it saw).

## Go-live checks
- [ ] Open `/b/<slug>/check` on a phone: logo, colors, both NMLS IDs, licensed states and EHO in the footer
- [ ] Submit a test lead: PDF arrives, broker alert arrives, webhook delivery shows **Delivered** (Settings → Integrations)
- [ ] Paste the embed on their site ([EMBED.md](EMBED.md))
- [ ] Import closed loans (Money List → Import) and set the market rate
- [ ] Make one listing snapshot for a realtor they work with
- [ ] Turn the Money List digest and weekly ROI email on for the right inbox

## First 30 days
- Weekly ROI email shows leads, checks, scenario opens, QR scans and past clients contacted. The agency rollup (1st of the month) flags brokers with no activity in 14+ days.
