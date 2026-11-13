import Papa from "papaparse";
import { PREPAYS, prepayTermMonths, type LoanProduct, type Prepay } from "@/lib/dscr";
import { normalizeAddress } from "@/lib/providers/address";

/** Fields we import from a closed-loans CSV (LOS export). */
export const LOAN_FIELDS = [
  { key: "borrower", label: "Borrower name", required: true, synonyms: ["borrower", "borrower name", "name", "client", "client name", "customer", "primary borrower"] },
  { key: "email", label: "Email", required: false, synonyms: ["email", "e-mail", "borrower email", "email address"] },
  { key: "phone", label: "Phone", required: false, synonyms: ["phone", "phone number", "mobile", "cell", "borrower phone"] },
  { key: "propertyAddress", label: "Property address", required: true, synonyms: ["property address", "address", "subject property", "property", "subject address", "subject property address"] },
  { key: "loanAmount", label: "Loan amount", required: true, synonyms: ["loan amount", "amount", "loan amt", "original balance", "base loan amount", "original loan amount"] },
  { key: "rate", label: "Interest rate", required: true, synonyms: ["rate", "interest rate", "note rate", "int rate"] },
  { key: "closingDate", label: "Closing date", required: true, synonyms: ["closing date", "close date", "closed", "funding date", "funded date", "closing", "note date"] },
  { key: "product", label: "Product", required: false, synonyms: ["product", "loan product", "amortization", "amortization type", "loan type", "interest only", "io", "interest-only", "i/o", "is io"] },
  { key: "armResetDate", label: "ARM first reset date", required: false, synonyms: ["arm reset date", "first reset date", "first change date", "arm first reset", "rate change date", "first rate change"] },
  { key: "prepayType", label: "Prepay type", required: true, synonyms: ["prepay type", "prepay", "prepayment", "ppp", "prepayment penalty", "prepay structure"] },
  { key: "prepayTerm", label: "Prepay term", required: false, synonyms: ["prepay term", "prepay term months", "prepay term years", "ppp term", "prepay years", "prepay months", "prepayment term"] },
  { key: "closingValue", label: "Value at closing", required: false, synonyms: ["value", "appraised value", "purchase price", "property value", "closing value", "sales price"] },
  { key: "ltv", label: "LTV at closing", required: false, synonyms: ["ltv", "ltv at closing", "loan to value", "original ltv"] },
  { key: "notes", label: "Notes", required: false, synonyms: ["notes", "note", "comments", "memo"] },
] as const;

export type LoanFieldKey = (typeof LOAN_FIELDS)[number]["key"];
export type ColumnMapping = Partial<Record<LoanFieldKey, string>>;

export interface ParsedLoan {
  borrowerName: string;
  email: string;
  phone: string | null;
  propertyAddress: string;
  addressKey: string;
  loanAmountCents: number;
  rateMilli: number;
  closingDate: Date;
  product: LoanProduct;
  armFirstResetDate: Date | null;
  prepayType: Prepay;
  prepayTermMonths: number;
  closingValueCents: number | null;
  ltvAtClosingRatio: number | null;
  notes: string | null;
}

export interface RowError {
  row: number; // 1-based, counting the header as row 1
  field: string;
  value: string;
  message: string;
}

export const CSV_TEMPLATE =
  [
    "borrower,email,phone,property_address,loan_amount,rate,closing_date,product,arm_reset_date,prepay_type,prepay_term_months,appraised_value,ltv,notes",
    'Jordan Sample,jordan@example.com,(555) 010-0100,"118 Maple Ave, Austin, TX 78704",320000,7.875,2024-03-15,fixed,,5-4-3-2-1,60,430000,,',
    'Casey Example,casey@example.com,(555) 010-0101,"42 Harbor View Dr, Tampa, FL 33611",255000,7.25,2025-06-02,interest only,,3-2-1,36,,75,Owns 4 doors',
    'Riley Placeholder,riley@example.com,,"9 Elm Ct, Columbus, OH 43215",188000,6.99,2021-09-10,5/6 arm,2026-10-01,none,0,250000,,',
  ].join("\n") + "\n";

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[]; parseErrors: string[] } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  return {
    headers: res.meta.fields ?? [],
    rows: res.data,
    parseErrors: res.errors.slice(0, 5).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[_\-./()]+/g, " ").replace(/\s+/g, " ").trim();

/** Guess which CSV column feeds each field. */
export function autoMap(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  for (const f of LOAN_FIELDS) {
    const hit = headers.find((h) => !used.has(h) && (f.synonyms as readonly string[]).some((syn) => norm(syn) === norm(h)));
    if (hit) {
      mapping[f.key] = hit;
      used.add(hit);
    }
  }
  return mapping;
}

/** "$325,000" | "325k" → cents. */
export function parseMoneyCents(v: string): number | null {
  const s = v.replace(/[$,\s]/g, "");
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d{1,2})?)(k|m)?$/i);
  if (!m) return null;
  const [whole, frac = ""] = m[1]!.split(".");
  let cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (m[2]?.toLowerCase() === "k") cents *= 1000;
  if (m[2]?.toLowerCase() === "m") cents *= 1_000_000;
  return Number.isSafeInteger(cents) ? cents : null;
}

/** "7.875" | "7.875%" | "0.07875" → milli-percent. */
export function parseRateMilli(v: string): number | null {
  const s = v.replace(/[%\s]/g, "");
  if (!s || !/^\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  const pct = n > 0 && n < 1 ? n * 100 : n;
  return Math.round(pct * 1000);
}

/** "75" | "75%" | "0.75" → ratio ×10,000. */
export function parseLtvRatio(v: string): number | null {
  const s = v.replace(/[%\s]/g, "");
  if (!s || !/^\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  return Math.round((n <= 1 ? n * 100 : n) * 100);
}

export function parseDate(v: string): Date | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3]!.length === 2 ? 2000 + +m[3]! : +m[3]!;
    return validDate(y, +m[1]!, +m[2]!);
  }
  return null;
}

function validDate(y: number, mo: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d ? dt : null;
}

export function parsePrepay(v: string): Prepay | null {
  const s = v.toLowerCase().replace(/\s+/g, "");
  if (!s || ["none", "no", "0", "n/a", "na", "noprepay", "nopenalty", "nopp", "noppp"].includes(s)) return "NONE";
  const digits = s.replace(/[^0-9]/g, "");
  const byDigits: Record<string, Prepay> = { "54321": "5-4-3-2-1", "321": "3-2-1", "55555": "5-5-5-5-5", "333": "3-3-3", "21": "2-1", "1": "1" };
  if (byDigits[digits]) return byDigits[digits]!;
  // "5% for 5 years", "3% 3yr", "1yr"
  const flat = s.match(/^(\d)%?(?:for|x)?(\d)(?:y|yr|yrs|year|years)$/);
  if (flat) {
    const k = Array(Number(flat[2])).fill(flat[1]).join("-");
    return (PREPAYS as string[]).includes(k) ? (k as Prepay) : null;
  }
  return null;
}

export function parseProduct(v: string): LoanProduct | null {
  const s = v.toLowerCase().trim();
  if (!s || ["fixed", "30 yr fixed", "30yr fixed", "30-year fixed", "amortizing", "p&i", "pi", "no", "n", "false", "0", "fully amortizing"].includes(s)) return "FIXED";
  if (/arm|adjustable|\d\/\d/.test(s)) return "ARM";
  if (["io", "i/o", "yes", "y", "true", "1", "interest only", "interest-only"].includes(s) || /interest[- ]only/.test(s)) return "IO";
  if (/fixed/.test(s)) return "FIXED";
  return null;
}

/** Validate every row. Returns valid loans plus clear, row-numbered error messages. */
export function validateRows(rows: Record<string, string>[], mapping: ColumnMapping, now = new Date()): { loans: ParsedLoan[]; errors: RowError[] } {
  const errors: RowError[] = [];
  const loans: ParsedLoan[] = [];
  const missing = LOAN_FIELDS.filter((f) => f.required && !mapping[f.key]);
  if (missing.length) {
    return { loans, errors: missing.map((f) => ({ row: 1, field: f.label, value: "", message: `Map a column to "${f.label}"` })) };
  }
  const termHeader = (mapping.prepayTerm ?? "").toLowerCase();
  const termUnit = /month|mo\b/.test(termHeader) ? "months" : /year|yr/.test(termHeader) ? "years" : "guess";
  const get = (r: Record<string, string>, k: LoanFieldKey) => (mapping[k] ? String(r[mapping[k]!] ?? "").trim() : "");
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const row = i + 2;
    const rowErrors: RowError[] = [];
    const err = (field: string, value: string, message: string) => rowErrors.push({ row, field, value, message });

    const borrowerName = get(r, "borrower");
    if (borrowerName.length < 2) err("Borrower name", borrowerName, "Borrower name is required");
    const email = get(r, "email").toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err("Email", email, "Not a valid email address");
    const phone = get(r, "phone");
    if (phone && phone.replace(/\D/g, "").length < 10) err("Phone", phone, "Phone needs 10 digits");
    const propertyAddress = get(r, "propertyAddress");
    if (propertyAddress.length < 6) err("Property address", propertyAddress, "Property address is required");
    const amountRaw = get(r, "loanAmount");
    const loanAmountCents = parseMoneyCents(amountRaw);
    if (loanAmountCents == null) err("Loan amount", amountRaw, "Use a number like 325000 or $325,000");
    else if (loanAmountCents < 1_000_000 || loanAmountCents > 2_000_000_000) err("Loan amount", amountRaw, "Loan amount should be between $10,000 and $20,000,000");
    const rateRaw = get(r, "rate");
    const rateMilli = parseRateMilli(rateRaw);
    if (rateMilli == null) err("Interest rate", rateRaw, "Use a rate like 7.25 or 7.25%");
    else if (rateMilli < 1_000 || rateMilli > 20_000) err("Interest rate", rateRaw, "Rate should be between 1% and 20%");
    const dateRaw = get(r, "closingDate");
    const closingDate = parseDate(dateRaw);
    if (!closingDate) err("Closing date", dateRaw, "Use YYYY-MM-DD or MM/DD/YYYY");
    else if (closingDate > now) err("Closing date", dateRaw, "Closing date is in the future");
    const productRaw = get(r, "product");
    const product = parseProduct(productRaw);
    if (!product) err("Product", productRaw, 'Use "fixed", "interest only" or "ARM"');
    const resetRaw = get(r, "armResetDate");
    let armFirstResetDate: Date | null = null;
    if (resetRaw) {
      armFirstResetDate = parseDate(resetRaw);
      if (!armFirstResetDate) err("ARM first reset date", resetRaw, "Use YYYY-MM-DD or MM/DD/YYYY");
      else if (closingDate && armFirstResetDate <= closingDate) err("ARM first reset date", resetRaw, "Reset date must be after closing");
    }
    if (product === "ARM" && !resetRaw && closingDate) {
      // 5/6 ARM default: first reset 60 months after closing.
      armFirstResetDate = new Date(Date.UTC(closingDate.getUTCFullYear() + 5, closingDate.getUTCMonth(), closingDate.getUTCDate()));
    }
    const prepayRaw = get(r, "prepayType");
    const prepayType = parsePrepay(prepayRaw);
    if (!prepayType) err("Prepay type", prepayRaw, 'Use "5-4-3-2-1", "3-2-1", "5-5-5-5-5", "3-3-3", "2-1", "1" or "none"');
    const termRaw = get(r, "prepayTerm");
    let term = prepayType ? prepayTermMonths(prepayType) : 0;
    if (termRaw) {
      const n = Number(termRaw.replace(/[^\d.]/g, ""));
      const years = termUnit === "years" || (termUnit === "guess" && n > 0 && n <= 5 && !/mo/i.test(termRaw));
      const months = years ? n * 12 : n;
      if (!Number.isInteger(months) || months < 0 || months > 120) err("Prepay term", termRaw, "Use whole months (0–120) or years (0–10)");
      else if (prepayType === "NONE" && months > 0) err("Prepay term", termRaw, 'Prepay type is "none" but a term was given');
      else term = months;
    }
    const valueRaw = get(r, "closingValue");
    const closingValueCents = valueRaw ? parseMoneyCents(valueRaw) : null;
    if (valueRaw && closingValueCents == null) err("Value at closing", valueRaw, "Use a number like 425000");
    else if (closingValueCents != null && loanAmountCents != null && closingValueCents < loanAmountCents) err("Value at closing", valueRaw, "Value is lower than the loan amount");
    const ltvRaw = get(r, "ltv");
    const ltvAtClosingRatio = ltvRaw ? parseLtvRatio(ltvRaw) : null;
    if (ltvRaw && (ltvAtClosingRatio == null || ltvAtClosingRatio < 1_000 || ltvAtClosingRatio > 10_000)) err("LTV at closing", ltvRaw, "Use a percentage like 75");
    const notes = get(r, "notes").slice(0, 500) || null;

    const addressKey = propertyAddress ? normalizeAddress(propertyAddress).key : "";
    const dedupeKey = `${email}|${addressKey}`;
    if (!rowErrors.length && seen.has(dedupeKey)) err("Property address", propertyAddress, `Duplicate of row ${seen.get(dedupeKey)} (same email and address)`);

    if (rowErrors.length) errors.push(...rowErrors);
    else {
      seen.set(dedupeKey, row);
      loans.push({
        borrowerName,
        email,
        phone: phone || null,
        propertyAddress,
        addressKey,
        loanAmountCents: loanAmountCents!,
        rateMilli: rateMilli!,
        closingDate: closingDate!,
        product: product!,
        armFirstResetDate,
        prepayType: prepayType!,
        prepayTermMonths: term,
        closingValueCents,
        ltvAtClosingRatio,
        notes,
      });
    }
  });
  return { loans, errors };
}
