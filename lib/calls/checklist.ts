import type { CallExtraction } from "@/lib/providers/ai";

/**
 * DSCR document checklist tailored to the deal. No SSNs or documents are collected
 * by this app; the checklist tells the investor what the lender will ask for.
 */
export function dscrChecklist(x: CallExtraction): string[] {
  const purpose = x.deal.loanPurpose ?? "PURCHASE";
  const type = (x.deal.propertyType ?? "").toLowerCase();
  const units = x.deal.units ?? (/(2-4|duplex|triplex|four|multi)/.test(type) ? 2 : 1);
  const items = ["Government-issued photo ID", "Entity documents if closing in an LLC: articles, operating agreement, EIN letter, certificate of good standing"];
  if (purpose === "PURCHASE") {
    items.push("Fully executed purchase contract with all addenda", "Proof of earnest money deposit", "Two most recent bank statements showing down payment and closing costs");
  } else {
    items.push("Most recent mortgage statement (or proof the property is owned free and clear)", "Two most recent bank statements for reserves");
    if (purpose === "CASH_OUT") items.push("Settlement statement from your original purchase (for seasoning)");
  }
  items.push("Six months of reserves (PITIA) in verifiable accounts");
  items.push(units > 1 ? "Current lease for every unit, plus a rent roll" : "Current lease agreement (if the property is rented)");
  if (purpose !== "PURCHASE") items.push("Proof of rent receipt: last two months of deposits or a rent ledger");
  if (/short|str|airbnb|vrbo/.test(type)) items.push("12 months of short-term rental booking history (Airbnb/VRBO statements)");
  if (/condo/.test(type)) items.push("HOA contact information for the condo questionnaire");
  items.push("Homeowner's insurance quote or declarations page with rent-loss coverage");
  if (x.investor.experience && /own|rental|propert|door|unit/i.test(x.investor.experience)) items.push("Schedule of real estate owned (addresses, balances, rents)");
  items.push("Signed credit authorization (completed securely in the lender's portal)");
  return items;
}
