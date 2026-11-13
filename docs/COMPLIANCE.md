# Compliance checklist

**Not legal advice.** This is a product checklist of what the toolkit does and what each broker must confirm with their own compliance counsel before going live.

## What the product enforces
- **Licensing disclosure on every public page, PDF and email:** LO name + individual NMLS ID, company + company NMLS ID, licensed states, NMLS Consumer Access link, Equal Housing Opportunity. Rendered by `BrokerFooter`, `PdfFooter` and the email layout.
- **Estimate, not an offer:** a versioned disclaimer (Settings → Compliance) appears on every page, PDF and email; the version each lead saw is stored on the lead. A custom disclaimer must keep "estimate" and "not a commitment to lend".
- **Banned words** in UI, PDFs, emails and AI drafts: approved, pre-approved, pre-qualified, qualifies, guaranteed, commitment (the disclaimer's negation is the only exception). Enforced by `npm run lint`, a strings test and the AI draft guard.
- **No APR** is shown (we don't compute finance charges). Rates are labeled as estimates with an as-of date; scenarios expire after 30 days.
- **Investment property only:** the lead form requires "This is an investment property. I will not live in it." (DSCR loans are business-purpose.)
- **TCPA consent:** separate, unticked checkboxes for contact (calls/texts incl. automated) and marketing, with the exact text, version, timestamp, IP and user agent stored per consent. Consent is never a condition of a loan. SMS drafts end with "Reply STOP to opt out." Privacy policy link on every form.
- **RESPA (co-marketing):** listing flyers, pages and realtor emails state that the lender and brokerage are independent, that no fee or thing of value is paid for referrals, and that the buyer may choose any lender. The product never pays or tracks referral compensation.
- **Data minimization:** no SSNs, DOBs, bank details, credit pulls, documents or audio. AI extraction is instructed to ignore sensitive identifiers. Pasted notes are not retained unless the LO opts in.
- **Consumer privacy (CCPA-style):** broker admins can export leads (CSV) and permanently delete a person's data (lead, consents; scenarios anonymized).
- **Security:** tenant isolation enforced in the data layer and tested; ≥128-bit public tokens; rate limits and bot checks on public forms; signed webhooks; secrets only in environment variables; no PII in logs.

## What each broker must confirm
- [ ] Their state licenses match the "licensed states" shown, and the Instant Check is only promoted in those states.
- [ ] The disclaimer text, TCPA consent text and privacy policy are approved by their counsel.
- [ ] Marketing texts/emails go only to people with marketing consent; quiet hours and DNC scrubbing in their dialer/CRM.
- [ ] Program grid numbers are realistic for their lenders (estimates, but they shape expectations).
- [ ] Realtor co-marketing arrangements are documented and paid at fair market value if any costs are shared (RESPA §8).
- [ ] Record retention for leads and consents meets their state requirements before deleting data.
- [ ] Advertising rules (e.g., Reg Z trigger terms in social posts that link to the calculator) are reviewed.
