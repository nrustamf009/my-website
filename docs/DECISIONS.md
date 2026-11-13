# Decisions log

Every judgment call made while building v2, newest at the bottom. Format: **decision** — why.

## Engine
- **Integer units everywhere** (cents, milli-percent, ratio ×10,000). Floats only inside amortization, rounded half-up once per output. — Avoids penny drift between UI, PDF and webhook payloads.
- **DSCR rounds down, LTV rounds up.** — Conservative: never overstate coverage or understate leverage near a cutoff.
- **Rate↔DSCR fixed point, ≤3 passes, worse bucket on oscillation.** — The grid prices by DSCR bucket, but DSCR depends on the rate.
- **A worse DSCR bucket is never priced cheaper than a better one** (gridRate uses the max adjustment of the bucket and all better ones). — The default `<0.75` adjustment of 0 made DSCR non-monotonic at the 0.75 boundary; the property test caught it.
- **Qualifying payment = initial payment** (interest-only payment for IO products). — Matches how most DSCR lenders qualify IO; the post-IO payment is shown alongside.

## Money List
- **Benefit kinds: SAVINGS, CASH_OUT, NONE.** NONE rows (ARM reset, anniversary, prepay expiry without a positive estimate) show "Review" / "Check-in" instead of a dollar figure. — Never show a $0 or negative "opportunity".
- **What-if rate is a URL parameter, not a saved broker setting.** — Per-user exploration should not change what teammates or the digest see. `Broker.whatIfRateMilli` is unused and kept only for backward compatibility.
- **Dedupe key = lowercase email + normalized address.** Re-importing the same LOS export updates rows instead of duplicating them; status and history are kept.
- **ARM rows without a reset date assume a 5/6 ARM** (first reset 60 months after closing). — The most common DSCR ARM; the LO can edit it.
- **Prepay term column**: header containing "month" means months, "year" means years; otherwise values ≤5 are read as years. — LOS exports use both.
- **AI drafts carry no numbers of their own.** Facts are pre-formatted by the engine; a guard rejects any $ or % figure not present in the facts, plus banned words. One retry, then the deterministic template. The compliance footer (NMLS IDs, EHO, SMS opt-out) is appended by code, never by the model.
- **Money List defaults: 60-month horizon, 3% refi closing costs** (were 36 / 3.5%). — DSCR investors typically hold 5+ years; with 36 months a 1.1-point rate drop on a fresh-penalty loan ranked as "Review", which a broker would never believe.
- **Cash out counts as the benefit only when a seasoning trigger fired.** — Otherwise equity alone ranks every old loan first and buries real rate/prepay opportunities.
- **Slow savings (breakeven past the horizon) are shown to the LO but never pitched**: the row reads "Review" with "$X/mo, breakeven month N" as a hint, and the draft gets no dollar figure.
