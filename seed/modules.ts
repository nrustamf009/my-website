import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Broker, PrismaClient } from "@prisma/client";
import { analyzeDeal, escrowFromPrice, type FicoRange } from "../lib/dscr";
import { brokerDefaults } from "../lib/broker";
import { autoMap, parseCsv, validateRows } from "../lib/moneylist/csv";
import { CONSENT_TEXT } from "../lib/validation";
import { MockAi } from "../lib/providers/ai/mock";
import { closedLoansCsv, type CityInfo } from "./closedLoans";

const DAY = 86400_000;
let seedState = 42;
const rand = () => ((seedState = (seedState * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]!;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 3600_000);
const token = (n = 16) => Array.from({ length: n }, () => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(rand() * 54)]).join("");

const CITIES: Record<string, CityInfo[]> = {
  harborline: [
    { city: "Tampa", state: "FL", zip: "33611" },
    { city: "St. Petersburg", state: "FL", zip: "33704" },
    { city: "Houston", state: "TX", zip: "77008" },
    { city: "Savannah", state: "GA", zip: "31401" },
    { city: "Charlotte", state: "NC", zip: "28205" },
  ],
  "cactus-ridge": [
    { city: "Phoenix", state: "AZ", zip: "85016" },
    { city: "Mesa", state: "AZ", zip: "85212" },
    { city: "Henderson", state: "NV", zip: "89052" },
    { city: "Tucson", state: "AZ", zip: "85719" },
  ],
  "evergreen-key": [
    { city: "Boise", state: "ID", zip: "83706" },
    { city: "Spokane", state: "WA", zip: "99203" },
    { city: "Salem", state: "OR", zip: "97302" },
  ],
};

const INVESTORS = ["Nadia Okoro", "Theo Lindgren", "Priscilla Vance", "Gabriel Achebe", "Lena Morrow", "Felix Ortega", "Imani Brooks", "Owen Castellano", "Sofia Petrakis", "Darius Kemp", "Hana Whitlock", "Mateo Ruiz", "Yara Haddad", "Silas Thorne", "Celeste Navarro", "Ezra Collins"];
const STREETS = ["Bayberry Ct", "Oleander Way", "Cypress Run", "Granite Ridge Dr", "Pinyon Pl", "Ocotillo Ln", "Spruce Hollow Rd", "Alder Creek Dr", "Sandpiper Ln", "Mesquite Trl"];

export async function seedModules(prisma: PrismaClient, brokers: Broker[]) {
  const outDir = path.join(process.cwd(), "seed", "out");
  mkdirSync(outDir, { recursive: true });
  let leads = 0;
  let scenarios = 0;
  let snapshots = 0;
  let loans = 0;

  for (const broker of brokers) {
    const defaults = brokerDefaults(broker);
    const cities = CITIES[broker.slug]!;
    const addr = () => {
      const c = pick(cities);
      return `${1000 + Math.floor(rand() * 8900)} ${pick(STREETS)}, ${c.city}, ${c.state} ${c.zip}`;
    };

    // ---- Realtors + 4 snapshots total (2 / 1 / 1) ----
    const realtorDefs =
      broker.slug === "harborline"
        ? [["Dana Whitcomb", "Coastline Realty Group"], ["Marco Esposito", "Bay & Palm Properties"], ["Keisha Langford", "Gulf Gate Homes"]]
        : broker.slug === "cactus-ridge"
          ? [["Travis Holloway", "Red Mesa Realty"], ["Ana Lucero", "Sonoran Key Realty"]]
          : [["Grace Ishikawa", "Northfork Realty Co."]];
    const realtors = [];
    for (const [name, brokerage] of realtorDefs) {
      realtors.push(await prisma.realtor.create({ data: { brokerId: broker.id, name: name!, brokerage: brokerage!, email: `${name!.split(" ")[0]!.toLowerCase()}@${brokerage!.split(" ")[0]!.toLowerCase()}.example`, phone: `(555) 010-${String(3000 + Math.floor(rand() * 999))}` } }));
    }
    const snapCount = broker.slug === "harborline" ? 2 : 1;
    for (let i = 0; i < snapCount; i++) {
      const price = 300_000 + Math.round(rand() * 25) * 10_000;
      const esc = escrowFromPrice(price, broker.taxRatePct, broker.insuranceRatePct);
      const snap = await prisma.snapshot.create({
        data: {
          brokerId: broker.id,
          realtorId: realtors[i % realtors.length]!.id,
          token: token(12),
          address: addr(),
          price,
          monthlyRent: Math.round((price * (0.0078 + rand() * 0.001)) / 25) * 25,
          rentSource: i === 0 ? "MOCK" : "MANUAL",
          ratePct: broker.defaultRate,
          taxesMonthly: Math.round(esc.taxesMonthly),
          insuranceMonthly: Math.round(esc.insuranceMonthly),
          createdAt: ago(20 - i * 6),
        },
      });
      snapshots++;
      const scans = 6 + Math.floor(rand() * 20);
      for (let s = 0; s < scans; s++) await prisma.snapshotScan.create({ data: { snapshotId: snap.id, device: rand() < 0.8 ? "mobile" : "desktop", createdAt: ago(Math.floor(rand() * 18), Math.floor(rand() * 20)) } });
      const listingLeads = 1 + Math.floor(rand() * 3);
      for (let l = 0; l < listingLeads; l++) {
        const name = pick(INVESTORS);
        const down = pick([0.2, 0.25]);
        const fico = pick(["760+", "720-759", "680-719"] as FicoRange[]);
        const a = analyzeDeal({ price: snap.price, downPaymentPct: down, monthlyRent: snap.monthlyRent, fico, ratePct: snap.ratePct, taxesMonthly: snap.taxesMonthly, insuranceMonthly: snap.insuranceMonthly }, defaults);
        await prisma.lead.create({
          data: {
            brokerId: broker.id,
            source: "LISTING",
            name,
            email: `${name.toLowerCase().replace(/\s+/g, ".")}.${l}@example.com`,
            phone: `(555) 010-${String(1000 + Math.floor(rand() * 8999))}`,
            consentAt: ago(10 - l),
            consentText: CONSENT_TEXT,
            propertyAddress: snap.address,
            purchasePrice: snap.price,
            downPaymentPct: down,
            monthlyRent: snap.monthlyRent,
            ficoRange: fico,
            resultJson: JSON.stringify({ dscr: a.dscr, verdict: a.verdict, pitia: a.pitia, maxLoan: a.maxLoan, loanAmount: a.loanAmount, ratePct: a.ratePct }),
            snapshotId: snap.id,
            realtorId: snap.realtorId,
            createdAt: ago(10 - l * 2, Math.floor(rand() * 12)),
          },
        });
        leads++;
      }
    }

    // ---- Instant Check leads ----
    const checkLeads = broker.slug === "harborline" ? 9 : 6;
    for (let i = 0; i < checkLeads; i++) {
      const name = INVESTORS[(i * 3 + broker.slug.length) % INVESTORS.length]!;
      const price = 220_000 + Math.round(rand() * 40) * 10_000;
      const down = pick([0.2, 0.25, 0.25, 0.3]);
      const rent = Math.round((price * (0.0062 + rand() * 0.0028)) / 25) * 25;
      const fico = pick(["760+", "720-759", "720-759", "680-719", "660-679"] as FicoRange[]);
      const a = analyzeDeal({ price, downPaymentPct: down, monthlyRent: rent, fico }, defaults);
      const created = ago(Math.floor(rand() * 40), Math.floor(rand() * 20));
      await prisma.lead.create({
        data: {
          brokerId: broker.id,
          source: "CHECK",
          name,
          email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          phone: rand() < 0.8 ? `(555) 010-${String(1000 + Math.floor(rand() * 8999))}` : null,
          consentAt: created,
          consentText: CONSENT_TEXT,
          propertyAddress: addr(),
          purchasePrice: price,
          downPaymentPct: down,
          monthlyRent: rent,
          ficoRange: fico,
          resultJson: JSON.stringify({ dscr: a.dscr, verdict: a.verdict, pitia: a.pitia, maxLoan: a.maxLoan, loanAmount: a.loanAmount, ratePct: a.ratePct }),
          status: i < 3 ? "NEW" : pick(["NEW", "CONTACTED", "CONTACTED"]),
          createdAt: created,
        },
      });
      leads++;
    }

    // ---- Scenarios (5 total: 3 / 1 / 1) with open history ----
    const scenarioDefs =
      broker.slug === "harborline"
        ? [
            { investor: "Nadia Okoro", purpose: "PURCHASE", value: 425_000, rent: 3_150, opens: [[6, 0, 240], [6, 3, 95], [2, 1, 410]], interested: "B" },
            { investor: "Theo Lindgren", purpose: "CASH_OUT", value: 510_000, rent: 3_600, opens: [[1, 2, 180]], interested: null },
            { investor: "Imani Brooks", purpose: "PURCHASE", value: 289_000, rent: 2_250, opens: [], interested: null },
          ]
        : broker.slug === "cactus-ridge"
          ? [{ investor: "Felix Ortega", purpose: "RATE_TERM", value: 365_000, rent: 2_550, opens: [[4, 0, 130], [0, 2, 75]], interested: null }]
          : [{ investor: "Hana Whitlock", purpose: "PURCHASE", value: 449_000, rent: 3_050, opens: [[3, 5, 320]], interested: "A" }];
    for (const [idx, sd] of scenarioDefs.entries()) {
      const esc = escrowFromPrice(sd.value, broker.taxRatePct, broker.insuranceRatePct);
      const loan = Math.round((sd.value * (sd.purpose === "PURCHASE" ? 0.75 : 0.7)) / 1000) * 1000;
      const created = ago(9 - idx * 2);
      const sc = await prisma.scenario.create({
        data: {
          brokerId: broker.id,
          token: token(20),
          status: sd.opens.length || idx < 2 ? "SHARED" : "DRAFT",
          investorName: sd.investor,
          investorEmail: `${sd.investor.toLowerCase().replace(/\s+/g, ".")}@example.com`,
          propertyAddress: addr(),
          loanPurpose: sd.purpose,
          propertyValue: sd.value,
          monthlyRent: sd.rent,
          taxesMonthly: Math.round(esc.taxesMonthly),
          insuranceMonthly: Math.round(esc.insuranceMonthly),
          note: `Hi ${sd.investor.split(" ")[0]}, here are the options we discussed. Option B is my pick if you plan to hold 3+ years. Happy to walk through any of it.`,
          createdAt: created,
          options: {
            create: [
              { label: "A", loanAmount: loan, ratePct: broker.defaultRate, termYears: 30, interestOnly: false, prepay: "5-4-3-2-1", pointsPct: 0, lenderFees: 1495, sortOrder: 0 },
              { label: "B", loanAmount: loan, ratePct: broker.defaultRate - 0.375, termYears: 30, interestOnly: false, prepay: "5-4-3-2-1", pointsPct: 1, lenderFees: 1495, sortOrder: 1 },
              { label: "C", loanAmount: loan, ratePct: broker.defaultRate + 0.25, termYears: 30, interestOnly: true, ioYears: 10, prepay: "3-2-1", pointsPct: 0, lenderFees: 1495, sortOrder: 2 },
            ],
          },
        },
        include: { options: true },
      });
      scenarios++;
      for (const [k, [d, h, secs]] of sd.opens.entries()) {
        const start = ago(d!, h!);
        await prisma.scenarioView.create({ data: { scenarioId: sc.id, visitKey: token(24), device: k % 2 ? "desktop" : "mobile", startedAt: start, lastSeenAt: new Date(start.getTime() + secs! * 1000), activeSeconds: secs! } });
      }
      const first = sd.opens.length ? ago(sd.opens[0]![0]!, sd.opens[0]![1]!) : null;
      const opt = sd.interested ? sc.options.find((o) => o.label === sd.interested) : null;
      await prisma.scenario.update({ where: { id: sc.id }, data: { firstOpenedAt: first, lastNotifiedAt: sd.opens.length ? ago(sd.opens.at(-1)![0]!, sd.opens.at(-1)![1]!) : null, interestedOptionId: opt?.id ?? null, interestedAt: opt ? ago(2) : null } });
    }

    // ---- Closed loans via the real CSV pipeline ----
    const count = broker.slug === "harborline" ? 60 : broker.slug === "cactus-ridge" ? 24 : 18;
    const csv = closedLoansCsv({ now: new Date(), marketRate: broker.marketRate ?? 6.75, city: cities, count, offset: broker.slug.length * 5 });
    writeFileSync(path.join(outDir, `closed-loans-${broker.slug}.csv`), csv);
    const { headers, rows } = parseCsv(csv);
    const mapping = autoMap(headers);
    const { loans: parsed, errors } = validateRows(rows, mapping);
    if (errors.length) throw new Error(`Seed CSV invalid: ${JSON.stringify(errors.slice(0, 3))}`);
    const batch = await prisma.loanImport.create({ data: { brokerId: broker.id, filename: `closed-loans-${broker.slug}.csv`, rowCount: parsed.length, mapping: JSON.stringify(mapping) } });
    await prisma.closedLoan.createMany({ data: parsed.map((l) => ({ ...l, brokerId: broker.id, importId: batch.id })) });
    loans += parsed.length;
  }

  // ---- Call-to-Scenario: one processed sample for Harborline ----
  const harbor = brokers.find((b) => b.slug === "harborline")!;
  const transcript = readFileSync(path.join(process.cwd(), "seed", "transcripts", "call-1-purchase.txt"), "utf8");
  const extraction = await new MockAi().extractCall(transcript);
  await prisma.callSession.create({
    data: { brokerId: harbor.id, inputType: "NOTES", status: "EXTRACTED", title: "Marcus Bellweather · duplex purchase", transcript, extraction: JSON.stringify(extraction), createdAt: ago(0, 3) },
  });

  return { leads, scenarios, snapshots, closedLoans: loans, csvFiles: "seed/out/*.csv", transcripts: "seed/transcripts/*.txt" };
}
