/**
 * Money List demo data. Loans are dated relative to "now" so the demo never goes stale:
 * a handful are deliberately placed on triggers (one or more of each kind), the rest are
 * generated and re-rolled until the engine finds nothing (so the list stays believable).
 */
import type { Broker, PrismaClient, User } from "@prisma/client";
import { DEFAULT_MONEY_LIST_RULES, addMonths, evaluateClosedLoan, type LoanProduct, type Prepay } from "../lib/dscr";
import { normalizeAddress } from "../lib/providers/address";

const FIRST = ["Jordan", "Casey", "Riley", "Avery", "Morgan", "Quinn", "Rowan", "Skyler", "Emerson", "Hayden", "Reese", "Dakota", "Finley", "Sawyer", "Parker", "Logan", "Kendall", "Blair", "Harper", "Elliot", "Remy", "Sage", "Tatum", "Wren", "Arden", "Marlow", "Shea", "Corin", "Lennox", "Briar"];
const LAST = ["Ashdown", "Bellamy", "Calloway", "Draycott", "Ellery", "Fairbanks", "Galloway", "Hargrove", "Ingram", "Jessup", "Kingsley", "Lockridge", "Merriweather", "Northcott", "Oakhurst", "Pemberton", "Quimby", "Ravenscroft", "Stillwell", "Thornbury", "Underhill", "Vandermeer", "Whitlock", "Yardley", "Ashcombe", "Brightwater", "Coldwell", "Dunmore", "Eastbrook", "Fenwick"];
const STREETS = ["Maple Ave", "Harbor View Dr", "Cypress Ln", "Juniper Ct", "Bluebonnet Trl", "Sable Palm Way", "Magnolia St", "Live Oak Dr", "Pecan Grove Rd", "Heron Bay Cir", "Tidewater Pl", "Cedar Ridge Ln", "Saltmarsh Way", "Pine Hollow Rd", "Sandpiper Ct"];
const CITIES: Record<string, [string, string][]> = {
  TX: [["Austin", "787"], ["San Antonio", "782"], ["Houston", "770"]],
  FL: [["Tampa", "336"], ["Jacksonville", "322"], ["Orlando", "328"]],
  GA: [["Savannah", "314"], ["Atlanta", "303"]],
  NC: [["Charlotte", "282"], ["Raleigh", "276"]],
  AZ: [["Phoenix", "850"], ["Tucson", "857"]],
  NV: [["Las Vegas", "891"]],
  NM: [["Albuquerque", "871"]],
  UT: [["Ogden", "844"]],
  WA: [["Spokane", "992"], ["Tacoma", "984"]],
  OR: [["Salem", "973"]],
  ID: [["Boise", "837"]],
};

/** Small deterministic PRNG so every seed run produces the same book of loans. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface LoanSeed {
  borrowerName: string;
  email: string;
  phone: string | null;
  propertyAddress: string;
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
  status?: string;
  snoozedUntil?: Date | null;
}

const TERM: Record<Prepay, number> = { "5-4-3-2-1": 60, "3-2-1": 36, "5-5-5-5-5": 60, "3-3-3": 36, "2-1": 24, "1": 12, NONE: 0 };
const daysAgo = (now: Date, d: number) => new Date(now.getTime() - d * 86_400_000);
const day = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export function buildLoanBook(now: Date, states: string[], seed: number, count: number, marketRateMilli: number): LoanSeed[] {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]!;
  let n = 0;
  const person = () => {
    const f = FIRST[(seed + n * 7) % FIRST.length]!;
    const l = LAST[(seed * 3 + n * 11) % LAST.length]!;
    n++;
    return { name: `${f} ${l}`, email: `${f}.${l}${n}`.toLowerCase() + "@example.com", phone: r() < 0.85 ? `(555) 010-${String(1000 + Math.floor(r() * 8999)).padStart(4, "0")}` : null };
  };
  const address = () => {
    const st = pick(states);
    const [city, zip3] = pick(CITIES[st] ?? [["Springfield", "000"]]);
    return `${100 + Math.floor(r() * 9800)} ${pick(STREETS)}, ${city}, ${st} ${zip3}${String(Math.floor(r() * 100)).padStart(2, "0")}`;
  };
  const amount = () => (150_000 + Math.floor(r() * 45) * 10_000) * 100;
  const base = (over: Partial<LoanSeed>): LoanSeed => {
    const p = person();
    const loan = over.loanAmountCents ?? amount();
    return {
      borrowerName: p.name,
      email: p.email,
      phone: p.phone,
      propertyAddress: address(),
      loanAmountCents: loan,
      rateMilli: marketRateMilli + 250,
      closingDate: daysAgo(now, 900),
      product: "FIXED",
      armFirstResetDate: null,
      prepayType: "NONE",
      prepayTermMonths: 0,
      closingValueCents: null,
      ltvAtClosingRatio: 7_500,
      notes: null,
      ...over,
    };
  };
  const pp = (t: Prepay) => ({ prepayType: t, prepayTermMonths: TERM[t] });

  // Deliberate opportunities: every trigger kind appears at least once.
  const m = marketRateMilli;
  const hot: LoanSeed[] = [
    base({ closingDate: day(addMonths(daysAgo(now, -25), -60)), rateMilli: m + 1_125, ...pp("5-4-3-2-1"), notes: "Owns 6 doors. Mentioned wanting to buy a 7th." }), // prepay ends in 25 days + rate drop
    base({ closingDate: day(addMonths(daysAgo(now, 40), -36)), rateMilli: m + 1_375, ...pp("3-2-1"), product: "IO" }), // prepay ended 40 days ago + rate drop
    base({ closingDate: day(addMonths(daysAgo(now, -50), -24)), rateMilli: m + 250, ...pp("2-1") }), // prepay ends in 50 days, no rate win → Review
    base({ closingDate: day(addMonths(daysAgo(now, 20), -6)), rateMilli: m + 375, ltvAtClosingRatio: 6_000, closingValueCents: null, ...pp("3-2-1") }), // 6-month seasoning, low LTV → cash out
    base({ closingDate: day(addMonths(daysAgo(now, 35), -12)), rateMilli: m + 500, ltvAtClosingRatio: 6_500, ...pp("NONE"), notes: "Did a BRRRR; rehab finished." }), // 12-month seasoning → cash out at appraised value
    base({ closingDate: day(addMonths(now, -20)), rateMilli: m + 1_625, ...pp("1") }), // rate drop, penalty long gone
    base({ closingDate: day(addMonths(now, -28)), rateMilli: m + 1_250, ...pp("5-5-5-5-5"), product: "IO" }), // rate drop but heavy penalty
    base({ closingDate: day(addMonths(daysAgo(now, -90), -60)), rateMilli: m - 125, product: "ARM", armFirstResetDate: day(daysAgo(now, -90)), ...pp("NONE") }), // ARM resets in 90 days
    base({ closingDate: day(addMonths(daysAgo(now, -150), -84)), rateMilli: m - 250, product: "ARM", armFirstResetDate: day(daysAgo(now, -150)), ...pp("NONE") }), // 7/6 ARM resets in 150 days
    base({ closingDate: day(addMonths(daysAgo(now, -10), -24)), rateMilli: m + 250, ...pp("NONE") }), // 2-year anniversary in 10 days
    base({ closingDate: day(addMonths(daysAgo(now, 5), -36)), rateMilli: m + 125, ...pp("3-3-3") }), // 3-year anniversary + prepay ended 5 days ago
  ];
  // Already worked: contacted (with history) and snoozed — excluded from the active list.
  const worked: LoanSeed[] = [
    base({ closingDate: day(addMonths(daysAgo(now, 15), -60)), rateMilli: m + 1_000, ...pp("5-4-3-2-1"), status: "CONTACTED" }),
    base({ closingDate: day(addMonths(now, -22)), rateMilli: m + 1_500, ...pp("NONE"), status: "SNOOZED", snoozedUntil: daysAgo(now, -45) }),
  ];

  // Quiet loans: random terms, re-rolled until the engine finds no trigger at all.
  const quiet: LoanSeed[] = [];
  const prepays: Prepay[] = ["5-4-3-2-1", "3-2-1", "NONE", "NONE", "1", "5-5-5-5-5"];
  while (quiet.length < count - hot.length - worked.length) {
    const product: LoanProduct = r() < 0.7 ? "FIXED" : r() < 0.8 ? "IO" : "ARM";
    const months = 2 + Math.floor(r() * 70);
    const closingDate = day(daysAgo(addMonths(now, -months), Math.floor(r() * 28)));
    const candidate = base({
      closingDate,
      rateMilli: m - 500 + Math.floor(r() * 9) * 125,
      product,
      armFirstResetDate: product === "ARM" ? day(addMonths(closingDate, 60)) : null,
      ltvAtClosingRatio: r() < 0.5 ? 7_500 : 8_000,
      ...pp(pick(prepays)),
    });
    const ev = evaluateClosedLoan(candidate, DEFAULT_MONEY_LIST_RULES, marketRateMilli, now);
    if (ev.triggers.length === 0) quiet.push(candidate);
    else n--; // reuse the name for the next attempt
  }
  return [...hot, ...worked, ...quiet];
}

export async function seedMoneyList(prisma: PrismaClient, broker: Broker, users: User[], count: number, seed: number) {
  const now = new Date();
  const book = buildLoanBook(now, JSON.parse(broker.licensedStates) as string[], seed, count, broker.marketRateMilli ?? 7_000);
  const imp = await prisma.loanImport.create({ data: { brokerId: broker.id, filename: "closed-loans-los-export.csv", rowCount: book.length, created: book.length, updated: 0, mapping: "{}" } });
  const lo = users[0]!;
  for (const l of book) {
    const { status = "OPEN", snoozedUntil = null, ...rest } = l;
    const history = [{ fromState: "", toState: "OPEN", note: "Imported", userId: lo.id, createdAt: daysAgo(now, 30) }];
    if (status === "CONTACTED") history.push({ fromState: "OPEN", toState: "CONTACTED", note: "Contacted by email · Wants numbers after tax season", userId: lo.id, createdAt: daysAgo(now, 3) });
    if (status === "SNOOZED") history.push({ fromState: "OPEN", toState: "SNOOZED", note: "Snoozed 60 days · Closing on another property first", userId: lo.id, createdAt: daysAgo(now, 15) });
    const loan = await prisma.closedLoan.create({
      data: { ...rest, brokerId: broker.id, importId: imp.id, addressKey: normalizeAddress(l.propertyAddress).key, status, snoozedUntil, history: { create: history } },
    });
    if (status === "CONTACTED") await prisma.event.create({ data: { brokerId: broker.id, type: "moneylist.contacted", entityType: "ClosedLoan", entityId: loan.id, actorUserId: lo.id, meta: JSON.stringify({ channel: "EMAIL" }), createdAt: daysAgo(now, 3) } });
    if (status === "SNOOZED") await prisma.event.create({ data: { brokerId: broker.id, type: "moneylist.snoozed", entityType: "ClosedLoan", entityId: loan.id, actorUserId: lo.id, meta: JSON.stringify({ snoozeDays: 60 }), createdAt: daysAgo(now, 15) } });
  }
  const evs = book.filter((l) => !l.status).map((l) => evaluateClosedLoan(l, DEFAULT_MONEY_LIST_RULES, broker.marketRateMilli, now));
  return { loans: book.length, opportunities: evs.filter((e) => e.triggers.length).length };
}
