# Webhooks

Set the URL in **Settings → Integrations**. Use **Send test** to fire a `test` event; the delivery log shows every attempt with status code and lets you redeliver.

## Delivery

- `POST` JSON, `Content-Type: application/json`, 5-second timeout.
- Headers: `X-DSCR-Event` (event name), `X-DSCR-Delivery` (unique id; use it to dedupe), `X-DSCR-Signature: sha256=<hex HMAC of the raw body with your secret>`.
- Retries: immediately, after 1 s and 5 s; then 2 min, 10 min, 1 h, 6 h (cron). After 7 failed attempts the delivery is marked **Failed** (redeliver by hand).
- Any 2xx counts as delivered. Respond fast; do heavy work async.

### Verify the signature (Node)

```js
import crypto from "node:crypto";
const expected = "sha256=" + crypto.createHmac("sha256", process.env.DSCR_WEBHOOK_SECRET).update(rawBody).digest("hex");
const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers["x-dscr-signature"]));
```

## Envelope

```json
{ "id": "evt_…", "event": "lead.created", "version": 1, "brokerSlug": "harborline", "occurredAt": "2026-11-13T17:48:02.000Z", "data": { … } }
```

## Events

| Event | When | `data` highlights |
|---|---|---|
| `lead.created` | Instant Check lead | `lead {id, source, status, name, email, phone}`, `property`, `estimate {verdict, dscr, pitia, loanAmount, ltv, rate, cashFlow}` (formatted strings), `consent`, `utm`, `dashboardUrl` |
| `snapshot.lead` | Financing request from a listing page | same as `lead.created` + `realtor {id, name, brokerage}` |
| `lead.updated` | Same person submits again, or status changes | `lead` (+ `previousStatus` on status changes), `changedBy` |
| `scenario.viewed` | First open, or a return 24 h+ after the last visit | `scenarioId`, `investorName`, `investorEmail`, `propertyAddress`, `firstView`, `device` |
| `scenario.option_interest` | Investor picks an option | `option {label, product, loanAmountCents, rateMilli, pointsRatio, prepay, pitiaCents, dscrRatio}`, `question` |
| `money_list.contacted` | LO marks a past client contacted | `borrowerName`, `email`, `phone`, `propertyAddress`, `channel`, `triggers[]`, `estimatedBenefitCents`, `benefitKind` |
| `test` | "Send test" button | `message` |

Money in `*Cents` fields is integer cents; `rateMilli` is milli-percent (7125 = 7.125%); `*Ratio` is ×10,000 (12000 = 1.20). Human-formatted strings are provided wherever a CRM is likely to display them.

## Zapier recipe: new lead → CRM + SMS alert

1. **Trigger:** Webhooks by Zapier → *Catch Raw Hook* (raw so you can verify the signature in a Code step; *Catch Hook* also works if you skip verification). Paste the Zapier URL into Settings → Integrations and click **Send test**.
2. **Filter:** `X-DSCR-Event` is `lead.created` or `snapshot.lead`.
3. **Action:** your CRM (Follow Up Boss, HubSpot, GoHighLevel…) → *Create/Update contact* with `data.lead.name`, `data.lead.email`, `data.lead.phone`; put `data.estimate.dscr` and `data.estimate.verdict` in a note; tag with `data.lead.source` and `data.utm.utm_source`.
4. **Action (optional):** SMS to the LO: "New DSCR lead: {{name}}, DSCR {{estimate.dscr}} ({{estimate.verdict}}). {{dashboardUrl}}".
5. Add a second Zap path for `scenario.option_interest` → create a CRM task "Call {{investorName}} about Option {{option.label}}".

## Make (Integromat) recipe

1. **Webhooks → Custom webhook**, copy the URL into Settings → Integrations, click **Send test** so Make learns the structure.
2. **Router** on `event`: `lead.created` / `snapshot.lead` → CRM *Upsert contact*; `scenario.viewed` with `firstView = true` → Slack message to the LO channel; `money_list.contacted` → Google Sheets *Add row* (simple refi pipeline).
3. Optional signature check: a **Tools → Set variable** with `sha256=` + `sha256(raw body; secret)` HMAC compared to the header (Make's built-in `hmac` function).
