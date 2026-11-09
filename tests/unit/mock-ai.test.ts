import { describe, expect, it } from "vitest";
import { MockAi } from "@/lib/providers/ai/mock";
import { SAMPLE_CALLS } from "@/lib/calls/samples";
import { dscrChecklist } from "@/lib/calls/checklist";
import { CallExtractionSchema } from "@/lib/providers/ai/schemas";

describe("mock AI extraction on sample calls", () => {
  it("extracts the duplex purchase", async () => {
    const x = await new MockAi().extractCall(SAMPLE_CALLS[0]!.text);
    expect(CallExtractionSchema.safeParse(x).success).toBe(true);
    expect(x.investor.name).toBe("Marcus Bellweather");
    expect(x.investor.email).toBe("marcus.bellweather@example.com");
    expect(x.deal).toMatchObject({ loanPurpose: "PURCHASE", purchasePrice: 468000, downPaymentPct: 0.25, monthlyRent: 3850, ficoRange: "720-759", taxesMonthly: 640, insuranceMonthly: 310, units: 2 });
    expect(x.deal.propertyAddress).toContain("2714 Palmetto Grove Way");
    expect(x.objections.length).toBeGreaterThan(0);
    const list = dscrChecklist(x);
    expect(list.some((l) => l.includes("rent roll"))).toBe(true);
    expect(list.some((l) => l.includes("purchase contract"))).toBe(true);
  });

  it("extracts the cash-out notes", async () => {
    const x = await new MockAi().extractCall(SAMPLE_CALLS[1]!.text);
    expect(x.deal).toMatchObject({ loanPurpose: "CASH_OUT", purchasePrice: 415000, monthlyRent: 2375, ficoRange: "680-719", taxesMonthly: 190, insuranceMonthly: 105 });
    expect(x.investor.phone).toBe("(555) 010-4417");
    expect(dscrChecklist(x).some((l) => l.includes("seasoning"))).toBe(true);
  });
});

describe("mock AI extraction details", () => {
  it("reads address, prepay preference, IO reluctance and goals from LO notes", async () => {
    const x = await new MockAi().extractCall(SAMPLE_CALLS[1]!.text);
    expect(x.deal.propertyAddress).toContain("9021 Desert Willow Trl");
    expect(x.deal.prepayPreference).toBe("5-4-3-2-1");
    expect(x.deal.wantsInterestOnly).toBe(false);
    expect(x.goals.join(" ")).toMatch(/pull cash/i);
  });
});
