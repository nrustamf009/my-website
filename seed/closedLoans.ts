/**
 * Generates a closed-loans CSV relative to `now`, designed so the Money List rules
 * (prepay window 60d, seasoning 6/12 months, rate drop >= 0.75 pts) find a known set
 * of opportunities. Pure function so a unit test can assert the count.
 */
import { addMonths } from "../lib/dscr/prepay";

const FIRST = ["Avery", "Jordan", "Riley", "Morgan", "Quinn", "Rowan", "Skyler", "Emerson", "Hayden", "Parker", "Reese", "Sawyer", "Dakota", "Finley", "Harper", "Kendall", "Logan", "Marley", "Peyton", "Sage", "Tatum", "Blair", "Cameron", "Devon", "Elliot", "Frankie", "Gray", "Hollis", "Indigo", "Jules"];
const LAST = ["Whitfield", "Okonkwo", "Delacroix", "Brennan", "Castellanos", "Lindqvist", "Nakamura", "Abernathy", "Fairbanks", "Holloway", "Ivers", "Kessler", "Marchetti", "Northcott", "Oyelaran", "Pemberton", "Quintero", "Ravensworth", "Saltonstall", "Thornbury", "Underhill", "Vasquez", "Wexford", "Yarborough", "Zeller", "Ashdown", "Birchall", "Cordero", "Draper", "Ellsworth"];
const STREETS = ["Magnolia Bend", "Copper Kettle", "Heron Point", "Old Mill", "Larkspur", "Sable Ridge", "Juniper Hollow", "Quarry Stone", "Windrose", "Bramble", "Saltgrass", "Cottonwood Bluff", "Pelican Cove", "Foxglove", "Ironwood", "Silver Maple", "Tidewater", "Briar Patch", "Lantern Hill", "Meadowlark"];
const SUFFIX = ["Ln", "Dr", "Ct", "Way", "Rd", "Ave", "Trl", "Pl"];

export interface CityInfo {
  city: string;
  state: string;
  zip: string;
}

export interface LoanSpec {
  monthsAgo: number;
  extraDays?: number;
  rateDelta: number;
  prepay: "5-4-3-2-1" | "3-2-1" | "NONE";
  io: boolean;
  amount: number;
  expectOpportunity: boolean;
}

/** 10 designed opportunities + filler loans that intentionally match no rule. */
export function loanSpecs(count = 60): LoanSpec[] {
  const opps: LoanSpec[] = [
    { monthsAgo: 30, rateDelta: 1.25, prepay: "5-4-3-2-1", io: false, amount: 412_000, expectOpportunity: true }, // rate drop
    { monthsAgo: 34, rateDelta: 1.375, prepay: "5-4-3-2-1", io: true, amount: 298_000, expectOpportunity: true }, // rate drop (IO)
    { monthsAgo: 41, rateDelta: 0.875, prepay: "5-4-3-2-1", io: false, amount: 535_000, expectOpportunity: true }, // rate drop
    { monthsAgo: 36, extraDays: 22, rateDelta: 0.125, prepay: "3-2-1", io: false, amount: 276_500, expectOpportunity: true }, // prepay ends in ~22 days
    { monthsAgo: 60, extraDays: 35, rateDelta: 0.25, prepay: "5-4-3-2-1", io: false, amount: 318_000, expectOpportunity: true }, // prepay ends in ~35 days
    { monthsAgo: 38, rateDelta: 0, prepay: "3-2-1", io: true, amount: 244_000, expectOpportunity: true }, // prepay ended ~2 months ago
    { monthsAgo: 7, rateDelta: 0.25, prepay: "5-4-3-2-1", io: false, amount: 365_000, expectOpportunity: true }, // 6-month seasoning
    { monthsAgo: 7, extraDays: -10, rateDelta: 0.375, prepay: "3-2-1", io: true, amount: 452_000, expectOpportunity: true }, // 6-month seasoning
    { monthsAgo: 13, rateDelta: 0.375, prepay: "5-4-3-2-1", io: false, amount: 289_000, expectOpportunity: true }, // 12-month seasoning
    { monthsAgo: 36, extraDays: 15, rateDelta: 1.375, prepay: "3-2-1", io: false, amount: 386_000, expectOpportunity: true }, // prepay ending + rate drop
  ];
  const fillerMonths = [1, 2, 3, 4, 5, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 44, 46, 48, 50, 52];
  const fillerRates = [-0.375, -0.25, -0.125, 0, 0.125, 0.25, 0.375, 0.5];
  const filler: LoanSpec[] = [];
  for (let i = 0; filler.length < count - opps.length; i++) {
    const m = fillerMonths[i % fillerMonths.length]!;
    // 3-2-1 only where its 36-month expiry is far from today's window.
    const prepay = i % 5 === 0 ? "NONE" : i % 3 === 0 && (m <= 31 || m >= 44) ? "3-2-1" : "5-4-3-2-1";
    filler.push({ monthsAgo: m, extraDays: (i * 3) % 9, rateDelta: fillerRates[(i * 5) % fillerRates.length]!, prepay, io: i % 4 === 1, amount: 160_000 + ((i * 37_919) % 460_000), expectOpportunity: false });
  }
  // Interleave so the CSV doesn't list all opportunities first.
  const out: LoanSpec[] = [];
  let f = 0;
  for (let i = 0; i < count; i++) out.push(i % 6 === 2 && opps.length ? opps.shift()! : filler[f++] ?? opps.shift()!);
  return out;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function closedLoansCsv(params: { now: Date; marketRate: number; city: CityInfo[]; count?: number; offset?: number }): string {
  const { now, marketRate, city, count = 60, offset = 0 } = params;
  const rows = ["borrower,email,phone,property_address,loan_amount,rate,closing_date,prepay_type,prepay_term_years,interest_only"];
  loanSpecs(count).forEach((s, i) => {
    const k = i + offset;
    const first = FIRST[k % FIRST.length]!;
    const last = LAST[(k * 7 + Math.floor(k / FIRST.length) * 3) % LAST.length]!;
    const c = city[k % city.length]!;
    const addr = `${1000 + ((k * 389) % 8900)} ${STREETS[(k * 3) % STREETS.length]} ${SUFFIX[k % SUFFIX.length]}, ${c.city}, ${c.state} ${c.zip}`;
    const closing = addMonths(now, -s.monthsAgo);
    closing.setUTCDate(closing.getUTCDate() + (s.extraDays ?? 0));
    const rate = Math.round((marketRate + s.rateDelta) * 1000) / 1000;
    const term = s.prepay === "5-4-3-2-1" ? 5 : s.prepay === "3-2-1" ? 3 : 0;
    const phone = `(555) 01${String(k % 100).padStart(2, "0")}-${String(1000 + ((k * 73) % 9000)).slice(0, 4)}`.replace(/^\(555\) 01(\d\d)-/, "(555) 010-$1");
    rows.push([`${first} ${last}`, `${first}.${last}@example.com`.toLowerCase(), phone, `"${addr}"`, s.amount, rate.toFixed(3), iso(closing), s.prepay === "NONE" ? "none" : s.prepay, term, s.io ? "yes" : "no"].join(","));
  });
  return rows.join("\n") + "\n";
}
