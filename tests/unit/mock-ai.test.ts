import { describe, expect, it } from "vitest";
import { MockAi } from "@/lib/providers/ai/mock";
import { SAMPLE_NOTES } from "@/lib/notes/samples";
import { checklistFactsOf, dscrChecklist } from "@/lib/notes/checklist";
import { NotesExtractionSchema } from "@/lib/providers/ai/schemas";
import { checkDraft } from "@/lib/providers/ai/guard";

describe("mock AI extraction on sample notes", () => {
  it("extracts the duplex purchase", async () => {
    const x = await new MockAi().extractNotes(SAMPLE_NOTES[0]!.text);
    expect(NotesExtractionSchema.safeParse(x).success).toBe(true);
    expect(x.investor.name).toBe("Marcus Bellweather");
    expect(x.deal).toMatchObject({ loanPurpose: "PURCHASE", priceOrValueDollars: 468000, downPaymentPercent: 25, monthlyRentDollars: 3850, ficoScore: 748, taxesMonthlyDollars: 640, insuranceMonthlyDollars: 310, units: 2, propertyType: "2-4" });
    expect(x.deal.propertyAddress).toContain("2714 Palmetto Grove Way");
    expect(x.deal.state).toBe("FL");
    expect(x.entity).toBe("LLC");
    expect(x.objections.length).toBeGreaterThan(0);
    const list = dscrChecklist(checklistFactsOf(x));
    expect(list.some((l) => l.includes("rent roll"))).toBe(true);
    expect(list.some((l) => l.includes("purchase contract"))).toBe(true);
  });

  it("extracts the cash-out notes", async () => {
    const x = await new MockAi().extractNotes(SAMPLE_NOTES[1]!.text);
    expect(x.deal).toMatchObject({ loanPurpose: "CASH_OUT", taxesMonthlyDollars: 190, insuranceMonthlyDollars: 105 });
    expect(x.investor.phone).toBe("(555) 010-4417");
    expect(x.deal.propertyAddress).toContain("9021 Desert Willow Trl");
    expect(x.deal.prepayPreference).toBe("5-4-3-2-1");
    expect(x.deal.wantsInterestOnly).toBe(false);
    expect(dscrChecklist(checklistFactsOf(x)).some((l) => l.includes("seasoning"))).toBe(true);
  });
});

describe("draft guard", () => {
  const facts = { benefit: "Save about $412/mo", netOf: "net of a $3,100 penalty", rate: "7.125%" };
  it("accepts figures quoted from the facts", () => {
    expect(checkDraft("You could save about $412/mo, net of a $3,100 penalty, at 7.125%.", facts).ok).toBe(true);
  });
  it("rejects invented figures and banned words", () => {
    expect(checkDraft("You could save $500 a month.", facts).ok).toBe(false);
    expect(checkDraft("Rates near 6.5% now.", facts).ok).toBe(false);
    expect(checkDraft("You are pre-approved!", facts).ok).toBe(false);
  });
  it("mock outreach drafts pass the guard", async () => {
    const f = { loName: "Maya Ortiz", companyName: "Sample Lending", borrowerFirstName: "Jordan", propertyAddress: "118 Maple Ave, Austin, TX 78704", reasons: ["Your prepayment penalty ended on Mar 15"], benefit: "Save about $412/mo", netOf: "net of estimated closing costs of $4,200" };
    const d = await new MockAi().draftOutreach(f, "Friendly");
    expect(checkDraft(`${d.emailSubject}\n${d.emailBody}\n${d.sms}`, f).ok).toBe(true);
  });
});
