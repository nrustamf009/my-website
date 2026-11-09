import Papa from "papaparse";
import type { PrepayType } from "@/lib/dscr";

/** Fields we import from a closed-loans CSV. */
export const LOAN_FIELDS = [
  { key: "borrower", label: "Borrower name", required: true, synonyms: ["borrower", "borrower name", "name", "client", "client name", "customer"] },
  { key: "email", label: "Email", required: false, synonyms: ["email", "e-mail", "borrower email", "email address"] },
  { key: "phone", label: "Phone", required: false, synonyms: ["phone", "phone number", "mobile", "cell", "borrower phone"] },
  { key: "propertyAddress", label: "Property address", required: true, synonyms: ["property address", "address", "subject property", "property", "subject address"] },
  { key: "loanAmount", label: "Loan amount", required: true, synonyms: ["loan amount", "amount", "loan amt", "original balance", "base loan amount"] },
  { key: "rate", label: "Interest rate", required: true, synonyms: ["rate", "interest rate", "note rate", "int rate"] },
  { key: "closingDate", label: "Closing date", required: true, synonyms: ["closing date", "close date", "closed", "funding date", "funded date", "closing"] },
  { key: "prepayType", label: "Prepay type", required: true, synonyms: ["prepay type", "prepay", "prepayment", "ppp", "prepayment penalty", "prepay structure"] },
  { key: "prepayTerm", label: "Prepay term (years)", required: false, synonyms: ["prepay term", "prepay term years", "ppp term", "prepay years", "prepayment term"] },
  { key: "interestOnly", label: "Interest-only", required: true, synonyms: ["interest only", "io", "interest-only", "i/o", "is io"] },
] as const;

export type LoanFieldKey = (typeof LOAN_FIELDS)[number]["key"];
export type ColumnMapping = Partial<Record<LoanFieldKey, string>>;

export interface ParsedLoan {
  borrowerName: string;
  email: string | null;
  phone: string | null;
  propertyAddress: string;
  loanAmount: number;
  ratePct: number;
  closingDate: Date;
  prepayType: PrepayType;
  prepayTermYears: number;
  interestOnly: boolean;
}

export interface RowError {
  row: number; // 1-based, counting the header as row 1
  field: string;
  value: string;
  message: string;
}

export const CSV_TEMPLATE = [
  "borrower,email,phone,property_address,loan_amount,rate,closing_date,prepay_type,prepay_term_years,interest_only",
  'Jordan Sample,jordan@example.com,(555) 010-0100,"118 Maple Ave, Austin, TX 78704",320000,7.875,2024-03-15,5-4-3-2-1,5,no',
  'Casey Example,casey@example.com,(555) 010-0101,"42 Harbor View Dr, Tampa, FL 33611",255000,7.25,2025-06-02,3-2-1,3,yes',
].join("\n") + "\n";

export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[]; parseErrors: string[] } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim() });
  return {
    headers: res.meta.fields ?? [],
    rows: res.data,
    parseErrors: res.errors.slice(0, 5).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[_\-./]+/g, " ").replace(/\s+/g, " ").trim();

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

export function parseMoney(v: string): number | null {
  const s = v.replace(/[$,\s]/g, "");
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]!) * (m[2]?.toLowerCase() === "k" ? 1000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1);
  return Number.isFinite(n) ? n : null;
}

export function parseRate(v: string): number | null {
  const s = v.replace(/[%\s]/g, "");
  if (!s || !/^\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  return n > 0 && n < 1 ? n * 100 : n;
}

export function parseDate(v: string): Date | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
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

export function parsePrepay(v: string): PrepayType | null {
  const s = v.toLowerCase().replace(/\s+/g, "");
  if (!s || ["none", "no", "0", "n/a", "na", "noprepay", "nopenalty"].includes(s)) return "NONE";
  const digits = s.replace(/[^0-9]/g, "");
  if (digits === "54321") return "5-4-3-2-1";
  if (digits === "321") return "3-2-1";
  return null;
}

export function parseBool(v: string): boolean | null {
  const s = v.toLowerCase().trim();
  if (["yes", "y", "true", "1", "io", "interest only", "interest-only"].includes(s)) return true;
  if (["no", "n", "false", "0", "", "amortizing", "fixed", "p&i", "pi"].includes(s)) return false;
  return null;
}

const DEFAULT_TERM: Record<PrepayType, number> = { "5-4-3-2-1": 5, "3-2-1": 3, NONE: 0 };

/** Validate every row. Returns valid loans plus clear, row-numbered error messages. */
export function validateRows(rows: Record<string, string>[], mapping: ColumnMapping, now = new Date()): { loans: ParsedLoan[]; errors: RowError[] } {
  const errors: RowError[] = [];
  const loans: ParsedLoan[] = [];
  const missing = LOAN_FIELDS.filter((f) => f.required && !mapping[f.key]);
  if (missing.length) {
    return { loans, errors: missing.map((f) => ({ row: 1, field: f.label, value: "", message: `Map a column to "${f.label}"` })) };
  }
  const get = (r: Record<string, string>, k: LoanFieldKey) => (mapping[k] ? String(r[mapping[k]!] ?? "").trim() : "");
  rows.forEach((r, i) => {
    const row = i + 2;
    const rowErrors: RowError[] = [];
    const err = (field: string, value: string, message: string) => rowErrors.push({ row, field, value, message });

    const borrowerName = get(r, "borrower");
    if (borrowerName.length < 2) err("Borrower name", borrowerName, "Borrower name is required");
    const email = get(r, "email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err("Email", email, "Not a valid email address");
    const phone = get(r, "phone");
    if (phone && phone.replace(/\D/g, "").length < 10) err("Phone", phone, "Phone needs 10 digits");
    const propertyAddress = get(r, "propertyAddress");
    if (propertyAddress.length < 6) err("Property address", propertyAddress, "Property address is required");
    const amountRaw = get(r, "loanAmount");
    const loanAmount = parseMoney(amountRaw);
    if (loanAmount == null) err("Loan amount", amountRaw, "Use a number like 325000 or $325,000");
    else if (loanAmount < 10_000 || loanAmount > 20_000_000) err("Loan amount", amountRaw, "Loan amount should be between $10,000 and $20,000,000");
    const rateRaw = get(r, "rate");
    const ratePct = parseRate(rateRaw);
    if (ratePct == null) err("Interest rate", rateRaw, "Use a rate like 7.25 or 7.25%");
    else if (ratePct < 1 || ratePct > 20) err("Interest rate", rateRaw, "Rate should be between 1% and 20%");
    const dateRaw = get(r, "closingDate");
    const closingDate = parseDate(dateRaw);
    if (!closingDate) err("Closing date", dateRaw, "Use YYYY-MM-DD or MM/DD/YYYY");
    else if (closingDate > now) err("Closing date", dateRaw, "Closing date is in the future");
    const prepayRaw = get(r, "prepayType");
    const prepayType = parsePrepay(prepayRaw);
    if (!prepayType) err("Prepay type", prepayRaw, 'Use "5-4-3-2-1", "3-2-1" or "none"');
    const termRaw = get(r, "prepayTerm");
    let prepayTermYears = prepayType ? DEFAULT_TERM[prepayType] : 0;
    if (termRaw) {
      const t = Number(termRaw.replace(/[^\d.]/g, ""));
      if (!Number.isInteger(t) || t < 0 || t > 10) err("Prepay term (years)", termRaw, "Use whole years between 0 and 10");
      else if (prepayType === "NONE" && t > 0) err("Prepay term (years)", termRaw, 'Prepay type is "none" but a term was given');
      else prepayTermYears = t;
    }
    const ioRaw = get(r, "interestOnly");
    const interestOnly = parseBool(ioRaw);
    if (interestOnly == null) err("Interest-only", ioRaw, 'Use "yes" or "no"');

    if (rowErrors.length) errors.push(...rowErrors);
    else
      loans.push({
        borrowerName,
        email: email || null,
        phone: phone || null,
        propertyAddress,
        loanAmount: Math.round(loanAmount!),
        ratePct: ratePct!,
        closingDate: closingDate!,
        prepayType: prepayType!,
        prepayTermYears,
        interestOnly: interestOnly!,
      });
  });
  return { loans, errors };
}
