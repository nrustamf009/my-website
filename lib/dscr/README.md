# lib/dscr: the financial engine

Pure TypeScript, no framework imports, deterministic. **Every number shown anywhere comes from here.**

## Units
| Kind | Type | Example |
|---|---|---|
| Money | integer cents | $1,995.91 → `199591` |
| Rate | integer milli-percent | 7.125% → `7125` |
| Ratio (LTV, DSCR, % of value) | integer × 10,000 | 80% → `8000`, DSCR 1.20 → `12000` |

## Rounding rules
1. Amortization uses float64 (exponentiation can't be integer), then is **rounded half-up to whole cents once** per payment.
2. All sums/differences of money are exact integer-cent arithmetic.
3. Annual → monthly: half-up to cents.
4. **DSCR is rounded down** and **LTV is rounded up** to 4 decimals, so the engine never overstates coverage or understates leverage.
5. Percent-of-amount (closing costs, points, penalties): half-up to cents.

## Rate ↔ DSCR fixed point
The program grid prices by DSCR bucket, but DSCR depends on the rate. `core()` starts at the best bucket and re-prices until the bucket is stable (≤ 3 passes). If it oscillates, the worse (more conservative) bucket wins.

## Qualifying payment
DSCR uses the **initial** payment (the interest-only payment for IO products), which is common across DSCR programs. The post-IO payment and DSCR are always shown next to it.

## Files
- `analyze.ts`: purchase / rate-term / cash-out analysis, verdict, "what to change", solvers
- `scenario.ts`: Scenario Sheet options, 5-year cost, break-even
- `money-list.ts`: prepay status, seasoning, refi savings, triggers, ranking
- `grid.ts`, `data/state-defaults.ts`: defaults (editable per broker)
- `__tests__/golden.test.ts`: hand-verified scenarios with arithmetic in comments
- `__tests__/property.test.ts`: monotonicity invariants
