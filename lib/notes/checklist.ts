import type { NotesExtraction } from "@/lib/providers/ai";

export interface ChecklistFacts {
  mode: "PURCHASE" | "RATE_TERM" | "CASH_OUT";
  propertyType: string;
  units?: number | null;
  use: "LTR" | "STR" | null;
  entity: "LLC" | "PERSONAL" | "" | null;
  experience: string | null;
}

export const checklistFactsOf = (x: NotesExtraction): ChecklistFacts => ({
  mode: x.deal.loanPurpose ?? "PURCHASE",
  propertyType: x.deal.propertyType ?? "SFR",
  units: x.deal.units,
  use: x.deal.use,
  entity: x.entity,
  experience: x.investor.experience,
});

/**
 * DSCR document checklist tailored to the deal. No SSNs or documents are collected
 * by this app; the checklist tells the investor what the lender will ask for.
 */
export function dscrChecklist(f: ChecklistFacts): string[] {
  const purpose = f.mode;
  const units = f.units ?? (f.propertyType === "2-4" ? 2 : 1);
  const items = ["Government-issued photo ID"];
  items.push(f.entity === "PERSONAL" ? "Confirm vesting: closing in your personal name (some DSCR lenders require an LLC)" : "Entity documents for the LLC: articles, operating agreement, EIN letter, certificate of good standing");
  if (purpose === "PURCHASE") {
    items.push("Fully executed purchase contract with all addenda", "Proof of earnest money deposit", "Two most recent bank statements showing down payment and closing costs");
  } else {
    items.push("Most recent mortgage statement (or proof the property is owned free and clear)", "Two most recent bank statements for reserves");
    if (purpose === "CASH_OUT") items.push("Settlement statement from your original purchase (for seasoning)");
  }
  items.push("Six months of reserves (PITIA) in verifiable accounts");
  items.push(units > 1 ? "Current lease for every unit, plus a rent roll" : "Current lease agreement (if the property is rented)");
  if (purpose !== "PURCHASE") items.push("Proof of rent receipt: last two months of deposits or a rent ledger");
  if (f.use === "STR") items.push("12 months of short-term rental booking history (Airbnb/VRBO statements)");
  if (f.propertyType === "CONDO") items.push("HOA contact information for the condo questionnaire");
  items.push("Homeowner's insurance quote or declarations page with rent-loss coverage");
  if (f.experience && /own|rental|propert|door|unit/i.test(f.experience)) items.push("Schedule of real estate owned (addresses, balances, rents)");
  items.push("Signed credit authorization (completed securely in the lender's portal)");
  return items;
}
