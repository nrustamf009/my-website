import { describe, expect, it } from "vitest";
import { closedLoansCsv } from "../../seed/closedLoans";
import { autoMap, parseCsv, validateRows } from "@/lib/moneylist/csv";
import { evaluateAll } from "@/lib/dscr";

describe("demo closed-loans CSV", () => {
  for (const offsetDays of [0, 17, 45, 200]) {
    it(`yields 8–12 Money List opportunities (now + ${offsetDays}d)`, () => {
      const now = new Date(Date.now() + offsetDays * 86400_000);
      const csv = closedLoansCsv({ now, marketRate: 6.625, city: [{ city: "Tampa", state: "FL", zip: "33611" }] });
      const { headers, rows } = parseCsv(csv);
      const { loans, errors } = validateRows(rows, autoMap(headers), now);
      expect(errors).toEqual([]);
      expect(loans).toHaveLength(60);
      const opps = evaluateAll(
        loans.map((l, i) => ({ ...l, id: String(i) })),
        { marketRate: 6.625, rateDropThreshold: 0.75, prepayWindowDays: 60, seasoningMonths: [6, 12], lookbackDays: 120 },
        now,
      );
      expect(opps.length).toBeGreaterThanOrEqual(8);
      expect(opps.length).toBeLessThanOrEqual(12);
      const kinds = new Set(opps.flatMap((o) => o.opp.reasons.map((r) => r.kind)));
      expect(kinds).toEqual(new Set(["RATE", "PREPAY", "SEASONING"]));
    });
  }
});
