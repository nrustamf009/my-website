# 10-minute demo script

Setup: `npm run setup && npm run dev`. Use a phone (or devtools mobile view) for the investor parts. Dev mailbox: `/dev/mailbox`.

**0:00 · The pitch (30 s).** "Your broker clients lose DSCR investors because quotes take a day. This gives every broker a branded, compliant toolkit that answers investors in seconds and tells the LO exactly who to call."

**0:30 · Instant Check (2 min).** Open `/b/harborline/check?lo=theo&utm_source=instagram` on a phone. Type `4410 Bayshore Ct, Tampa, FL 33611`, price 400,000, rent 2,300. Point at the verdict (**Needs adjustment**) and **what to change** (the simplest path first: more rent, more down, a lower price or a buydown). Change rent to 3,900 → **Looks strong**. Fill the form (both consent boxes are explicit) → PDF arrives in the dev mailbox; show the footer: both NMLS IDs, licensed states, EHO, disclaimer version.

**2:30 · The broker sees it (1 min).** Sign in as `maya@harborline.example`. Overview: this week's leads/checks/opens/scans vs last week, **Call new leads**, **Hot scenarios**, **Money List**. Open the new lead: estimate numbers, UTM source, consent records, owner Theo, timeline. Click **Build scenario**.

**3:30 · Scenario Sheet (2 min).** Builder is prefilled from the lead. **Build options** → A fixed (recommended), B interest-only, C fixed with 1 point (breakeven vs A). Save → **Share: copy link** → open it on the phone. Expand Option C details (prepay table by year), tap **I'm interested in Option C**, ask "Can we close in 3 weeks?". Back on the dashboard: LO email "picked Option C", the question, visits with time on page. (Seeded example: *Marcus Bellweather*.)

**5:30 · Money List refi (2 min).** Money List: 60 closed loans, ~11 worth a call, ranked by estimated net benefit. Filter **Prepay ending**. Open *Blair Vandermeer*: prepay ends in ~25 days, rate 1.125 below market, the numbers (balance, penalty today, savings, breakeven). **Draft message** → email + text with the NMLS/EHO footer added by code → **Mark contacted** (webhook fires). Try **What if 6.0%** to show who a rate drop unlocks.

**7:30 · Realtor flyer (1.5 min).** Listing Snapshots → open *4410 Bayshore Ct* → **Download PDF flyer** (Classic and Modern). Scan the QR on the phone → live numbers at 20%/25% down, "Adjust the assumptions", financing request tagged to the realtor. Back in the dashboard: realtor stats → **Email stats** to the agent.

**9:00 · Notes-to-Scenario (40 s).** Notes → **Try: duplex purchase** → Extract → review form (nothing saved yet) → Create → draft scenario + document checklist + follow-up email with the scenario link.

**9:20 · Theme switch (20 s).** Settings → Appearance: pick Terminal, watch the preview, save; open the Instant Check: same numbers, a completely different look. (Cactus Ridge is terminal, Evergreen Key is atelier out of the box.)

**9:40 · Agency view (20 s).** Sign in as `admin@northbeam.example`: brokers with leads, opens, scans, contacted, refi opportunities and a churn flag; impersonate (audited); turn a module off to sell tiers.
