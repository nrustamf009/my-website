import { describe, expect, it } from "vitest";
import { autoMap, CSV_TEMPLATE, parseCsv, parseDate, parseLtvRatio, parseMoneyCents, parsePrepay, parseProduct, parseRateMilli, validateRows } from "@/lib/moneylist/csv";

describe("Money List CSV import", () => {
  it("parses the downloadable template with auto-mapping and no errors", () => {
    const { headers, rows } = parseCsv(CSV_TEMPLATE);
    const mapping = autoMap(headers);
    const { loans, errors } = validateRows(rows, mapping);
    expect(errors).toEqual([]);
    expect(loans).toHaveLength(3);
    expect(loans[0]).toMatchObject({ borrowerName: "Jordan Sample", loanAmountCents: 32_000_000, rateMilli: 7875, prepayType: "5-4-3-2-1", prepayTermMonths: 60, product: "FIXED", closingValueCents: 43_000_000 });
    expect(loans[1]).toMatchObject({ product: "IO", ltvAtClosingRatio: 7500, notes: "Owns 4 doors", prepayTermMonths: 36 });
    expect(loans[2]).toMatchObject({ product: "ARM", prepayType: "NONE", prepayTermMonths: 0 });
    expect(loans[2]!.armFirstResetDate?.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(loans[0]!.addressKey).toBe("118 maple ave austin tx 78704");
  });

  it("maps common header variants", () => {
    const m = autoMap(["Client Name", "E-mail", "Subject Property", "Loan Amt", "Note Rate", "Funding Date", "PPP", "I/O", "First Change Date", "Appraised Value"]);
    expect(m).toMatchObject({ borrower: "Client Name", email: "E-mail", propertyAddress: "Subject Property", loanAmount: "Loan Amt", rate: "Note Rate", closingDate: "Funding Date", prepayType: "PPP", product: "I/O", armResetDate: "First Change Date", closingValue: "Appraised Value" });
  });

  it("returns clear row-level errors", () => {
    const csv = `borrower,property_address,loan_amount,rate,closing_date,prepay_type,product\nA B,"1 Main St, X",abc,7.5,2024-13-01,4-3-2-1,maybe\n`;
    const { headers, rows } = parseCsv(csv);
    const { loans, errors } = validateRows(rows, autoMap(headers));
    expect(loans).toHaveLength(0);
    expect(errors.map((e) => `${e.row}:${e.field}`)).toEqual(["2:Loan amount", "2:Closing date", "2:Product", "2:Prepay type"]);
    expect(errors[0]!.message).toContain("325000");
  });

  it("flags duplicates within the file (same email + address)", () => {
    const csv = `borrower,email,property_address,loan_amount,rate,closing_date,prepay_type\nA B,a@x.com,"1 Main Street, Austin, TX 78701",200000,7,2024-01-01,none\nA B,A@x.com,"1 Main St., Austin TX 78701",200000,7,2024-01-01,none\n`;
    const { headers, rows } = parseCsv(csv);
    const { loans, errors } = validateRows(rows, autoMap(headers));
    expect(loans).toHaveLength(1);
    expect(errors[0]!.message).toContain("Duplicate of row 2");
  });

  it("reports unmapped required columns", () => {
    const { errors } = validateRows([{ x: "1" }], { borrower: "x" });
    expect(errors.some((e) => e.message.includes("Loan amount"))).toBe(true);
  });

  it("normalizes values into integer units", () => {
    expect(parseRateMilli("0.0725")).toBe(7250);
    expect(parseRateMilli("7.125%")).toBe(7125);
    expect(parseMoneyCents("$325,000.5")).toBe(32_500_050);
    expect(parseMoneyCents("325k")).toBe(32_500_000);
    expect(parseLtvRatio("0.75")).toBe(7500);
    expect(parseDate("3/5/24")?.toISOString().slice(0, 10)).toBe("2024-03-05");
    expect(parseDate("2023-02-30")).toBeNull();
    expect(parsePrepay("5/4/3/2/1")).toBe("5-4-3-2-1");
    expect(parsePrepay("5% for 5 years")).toBe("5-5-5-5-5");
    expect(parsePrepay("No prepay")).toBe("NONE");
    expect(parseProduct("5/6 ARM")).toBe("ARM");
    expect(parseProduct("Interest Only")).toBe("IO");
    expect(parseProduct("")).toBe("FIXED");
  });
});

import { randomToken, PUBLIC_TOKEN_LENGTH } from "@/lib/tokens";
describe("public tokens", () => {
  it("are ≥128 bits and URL-safe", () => {
    expect(PUBLIC_TOKEN_LENGTH * Math.log2(54)).toBeGreaterThanOrEqual(128);
    const t = randomToken();
    expect(t).toMatch(/^[A-Za-z2-9]{24}$/);
    expect(new Set(Array.from({ length: 200 }, () => randomToken())).size).toBe(200);
  });
});
