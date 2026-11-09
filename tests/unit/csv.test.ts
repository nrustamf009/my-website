import { describe, expect, it } from "vitest";
import { autoMap, CSV_TEMPLATE, parseCsv, parseDate, parsePrepay, parseRate, validateRows } from "@/lib/moneylist/csv";

describe("Money List CSV import", () => {
  it("parses the downloadable template with auto-mapping and no errors", () => {
    const { headers, rows } = parseCsv(CSV_TEMPLATE);
    const mapping = autoMap(headers);
    const { loans, errors } = validateRows(rows, mapping);
    expect(errors).toEqual([]);
    expect(loans).toHaveLength(2);
    expect(loans[0]).toMatchObject({ borrowerName: "Jordan Sample", loanAmount: 320000, ratePct: 7.875, prepayType: "5-4-3-2-1", prepayTermYears: 5, interestOnly: false });
    expect(loans[1]!.interestOnly).toBe(true);
  });

  it("maps common header variants", () => {
    const m = autoMap(["Client Name", "E-mail", "Subject Property", "Loan Amt", "Note Rate", "Funding Date", "PPP", "I/O"]);
    expect(m).toMatchObject({ borrower: "Client Name", email: "E-mail", propertyAddress: "Subject Property", loanAmount: "Loan Amt", rate: "Note Rate", closingDate: "Funding Date", prepayType: "PPP", interestOnly: "I/O" });
  });

  it("returns clear row-level errors", () => {
    const csv = `borrower,property_address,loan_amount,rate,closing_date,prepay_type,interest_only\nA B,"1 Main St, X",abc,7.5,2024-13-01,4-3-2-1,maybe\n`;
    const { headers, rows } = parseCsv(csv);
    const { loans, errors } = validateRows(rows, autoMap(headers));
    expect(loans).toHaveLength(0);
    const msgs = errors.map((e) => `${e.row}:${e.field}`);
    expect(msgs).toEqual(["2:Loan amount", "2:Closing date", "2:Prepay type", "2:Interest-only"]);
    expect(errors[0]!.message).toContain("325000");
  });

  it("reports unmapped required columns", () => {
    const { errors } = validateRows([{ x: "1" }], { borrower: "x" });
    expect(errors.some((e) => e.message.includes("Loan amount"))).toBe(true);
  });

  it("normalizes values", () => {
    expect(parseRate("0.0725")).toBeCloseTo(7.25);
    expect(parseRate("7.125%")).toBe(7.125);
    expect(parseDate("3/5/24")?.toISOString().slice(0, 10)).toBe("2024-03-05");
    expect(parseDate("2023-02-30")).toBeNull();
    expect(parsePrepay("5/4/3/2/1")).toBe("5-4-3-2-1");
    expect(parsePrepay("No prepay")).toBe("NONE");
  });
});
