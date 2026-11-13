"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { requireBroker } from "@/lib/auth/session";
import { moneyListRules, staffBrand, toneOf, features } from "@/lib/broker";
import { parseRateToMilli } from "@/lib/format";
import { prisma } from "@/lib/db";
import { emit } from "@/lib/events";
import { dispatchWebhook } from "@/lib/webhooks";
import { draftOutreach } from "@/lib/providers/ai";
import { LOAN_FIELDS, autoMap, parseCsv, validateRows, type ColumnMapping, type RowError } from "@/lib/moneylist/csv";
import { evaluateLoan } from "@/lib/moneylist/list";
import { describeOpportunity, emailFooter, outreachFacts, smsFooter } from "@/lib/moneylist/describe";
import { sendMoneyListDigest } from "@/lib/moneylist/digest";

const MAX_BYTES = 2_000_000;
const MAX_ROWS = 5_000;

async function ctx() {
  const c = await requireBroker();
  if (!features(c.broker).moneyList) throw new Error("Money List is not enabled for this account");
  return c;
}

export interface ImportPreview {
  ok: boolean;
  error?: string;
  headers: string[];
  mapping: ColumnMapping;
  errors: RowError[];
  errorCount: number;
  validCount: number;
  newCount: number;
  updateCount: number;
  sample: { borrowerName: string; propertyAddress: string; loanAmountCents: number; rateMilli: number; closingDate: string; product: string; prepayType: string }[];
}

function readCsv(csv: string) {
  if (csv.length > MAX_BYTES) return { error: "File is over 2 MB. Split it into smaller files." } as const;
  const parsed = parseCsv(csv);
  if (!parsed.headers.length) return { error: "We couldn't read any columns. Is this a CSV with a header row?" } as const;
  if (parsed.rows.length > MAX_ROWS) return { error: `Up to ${MAX_ROWS.toLocaleString()} rows per import.` } as const;
  return parsed;
}

/** Validate a CSV (with an optional manual mapping) without saving anything. */
export async function previewImport(csv: string, mapping?: ColumnMapping): Promise<ImportPreview> {
  const { db } = await ctx();
  const empty: ImportPreview = { ok: false, headers: [], mapping: {}, errors: [], errorCount: 0, validCount: 0, newCount: 0, updateCount: 0, sample: [] };
  const parsed = readCsv(csv);
  if ("error" in parsed) return { ...empty, error: parsed.error };
  const map = mapping && Object.keys(mapping).length ? mapping : autoMap(parsed.headers);
  const { loans, errors } = validateRows(parsed.rows, map);
  const existing = await db.closedLoan.findMany({ select: { email: true, addressKey: true } });
  const keys = new Set(existing.map((e) => `${e.email}|${e.addressKey}`));
  const updateCount = loans.filter((l) => keys.has(`${l.email}|${l.addressKey}`)).length;
  return {
    ok: true,
    headers: parsed.headers,
    mapping: map,
    errors: errors.slice(0, 50),
    errorCount: errors.length,
    validCount: loans.length,
    newCount: loans.length - updateCount,
    updateCount,
    sample: loans.slice(0, 5).map((l) => ({ ...l, closingDate: l.closingDate.toISOString() })),
  };
}

/** Save valid rows: new loans are created, existing ones (same email + address) updated. Status and history are kept. */
export async function commitImport(csv: string, mapping: ColumnMapping, fileName: string): Promise<{ ok: boolean; error?: string; created: number; updated: number; skipped: number }> {
  const { db, broker, user } = await ctx();
  const parsed = readCsv(csv);
  if ("error" in parsed) return { ok: false, error: parsed.error, created: 0, updated: 0, skipped: 0 };
  const { loans, errors } = validateRows(parsed.rows, mapping);
  if (!loans.length) return { ok: false, error: "No valid rows to import. Fix the errors and try again.", created: 0, updated: 0, skipped: errors.length };
  const imp = await db.loanImport.create({ data: { brokerId: broker.id, filename: fileName.slice(0, 120) || "import.csv", rowCount: parsed.rows.length, mapping: JSON.stringify(mapping) } });
  const existing = await db.closedLoan.findMany({ select: { id: true, email: true, addressKey: true } });
  const byKey = new Map(existing.map((e) => [`${e.email}|${e.addressKey}`, e.id]));
  let created = 0;
  let updated = 0;
  for (const l of loans) {
    const id = byKey.get(`${l.email}|${l.addressKey}`);
    const data = { ...l, importId: imp.id };
    if (id) {
      await db.closedLoan.update({ where: { id }, data });
      updated++;
    } else {
      await db.closedLoan.create({ data: { ...data, brokerId: broker.id, history: { create: { fromState: "", toState: "OPEN", note: "Imported", userId: user?.id ?? null } } } });
      created++;
    }
  }
  await db.loanImport.update({ where: { id: imp.id }, data: { created, updated } });
  await emit(db, "moneylist.imported", "LoanImport", imp.id, { created, updated, skipped: errors.length }, user?.id);
  revalidatePath("/dashboard/money-list");
  return { ok: true, created, updated, skipped: errors.length };
}

export type AddLoanState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string> };

/** Manual add: reuses CSV validation so the rules are identical. */
export async function addLoan(_p: AddLoanState, fd: FormData): Promise<AddLoanState> {
  const { db, broker, user } = await ctx();
  const row: Record<string, string> = {};
  for (const f of LOAN_FIELDS) row[f.key] = String(fd.get(f.key) ?? "");
  const mapping = Object.fromEntries(LOAN_FIELDS.map((f) => [f.key, f.key])) as ColumnMapping;
  const { loans, errors } = validateRows([row], mapping);
  if (!loans.length) {
    const byField = Object.fromEntries(errors.map((e) => [LOAN_FIELDS.find((f) => f.label === e.field)?.key ?? e.field, e.message]));
    return { fieldErrors: byField };
  }
  const l = loans[0]!;
  const dupe = await db.closedLoan.findFirst({ where: { email: l.email, addressKey: l.addressKey } });
  if (dupe) return { error: "This loan is already on your list (same email and property)." };
  await db.closedLoan.create({ data: { ...l, brokerId: broker.id, history: { create: { fromState: "", toState: "OPEN", note: "Added manually", userId: user?.id ?? null } } } });
  revalidatePath("/dashboard/money-list");
  return { ok: true };
}

export type RateState = { ok?: boolean; error?: string };

export async function saveMarketRate(_p: RateState, fd: FormData): Promise<RateState> {
  const { broker, canManage } = await ctx();
  if (!canManage) return { error: "Only a broker admin can change the market rate." };
  const milli = parseRateToMilli(String(fd.get("marketRate") ?? ""));
  if (milli == null || milli < 2_000 || milli > 15_000) return { error: "Enter a rate between 2% and 15%, like 7.125" };
  await prisma.broker.update({ where: { id: broker.id }, data: { marketRateMilli: milli } });
  revalidatePath("/dashboard/money-list");
  return { ok: true };
}

/** Generate (or regenerate) the email + SMS draft for one loan. */
export async function generateDraft(loanId: string): Promise<{ ok: boolean; error?: string; subject?: string; email?: string; sms?: string; mode?: string }> {
  const { db, broker, user } = await ctx();
  const loan = await db.closedLoan.findFirst({ where: { id: loanId } });
  if (!loan) return { ok: false, error: "Loan not found" };
  const ev = evaluateLoan(loan, broker);
  const op = describeOpportunity(ev, moneyListRules(broker).horizonMonths);
  const brand = await staffBrand(broker, user);
  const { value, mode } = await draftOutreach(outreachFacts(loan, op, brand), toneOf(broker));
  const email = `${value.emailBody.trim()}${emailFooter(brand)}`;
  const sms = `${value.sms.trim()}${smsFooter(brand)}`;
  await db.closedLoan.update({ where: { id: loan.id }, data: { draftEmail: JSON.stringify({ subject: value.emailSubject, body: email }), draftSms: sms, draftedAt: new Date() } });
  await emit(db, "moneylist.drafted", "ClosedLoan", loan.id, { mode }, user?.id);
  revalidatePath(`/dashboard/money-list/${loan.id}`);
  return { ok: true, subject: value.emailSubject, email, sms, mode };
}

const StatusSchema = z.object({
  loanId: z.string().min(1),
  status: z.enum(["OPEN", "CONTACTED", "SNOOZED", "NOT_INTERESTED", "WON"]),
  snoozeDays: z.coerce.number().int().optional(),
  channel: z.enum(["EMAIL", "SMS", "CALL"]).optional(),
  note: z.string().trim().max(500).optional(),
});

const EVENT = { CONTACTED: "moneylist.contacted", SNOOZED: "moneylist.snoozed", NOT_INTERESTED: "moneylist.not_interested", WON: "moneylist.won" } as const;

export async function setLoanStatus(input: z.input<typeof StatusSchema>): Promise<{ ok: boolean; error?: string }> {
  const { db, broker, user } = await ctx();
  const p = StatusSchema.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request" };
  const { loanId, status, snoozeDays, channel, note } = p.data;
  if (status === "SNOOZED" && ![30, 60, 90].includes(snoozeDays ?? 0)) return { ok: false, error: "Snooze for 30, 60 or 90 days" };
  const loan = await db.closedLoan.findFirst({ where: { id: loanId } });
  if (!loan) return { ok: false, error: "Loan not found" };
  const snoozedUntil = status === "SNOOZED" ? new Date(Date.now() + snoozeDays! * 86_400_000) : null;
  const label = status === "SNOOZED" ? `Snoozed ${snoozeDays} days` : status === "CONTACTED" && channel ? `Contacted by ${channel.toLowerCase()}` : null;
  await db.closedLoan.update({
    where: { id: loan.id },
    data: { status, snoozedUntil, history: { create: { fromState: loan.status, toState: status, note: [label, note].filter(Boolean).join(" · ") || null, userId: user?.id ?? null } } },
  });
  if (status !== "OPEN") await emit(db, EVENT[status], "ClosedLoan", loan.id, { channel, snoozeDays }, user?.id);
  if (status === "CONTACTED") {
    const ev = evaluateLoan(loan, broker);
    await dispatchWebhook(db, broker, "money_list.contacted", {
      loanId: loan.id,
      borrowerName: loan.borrowerName,
      email: loan.email || null,
      phone: loan.phone,
      propertyAddress: loan.propertyAddress,
      channel: channel ?? null,
      triggers: ev.triggers.map((x) => x.kind),
      estimatedBenefitCents: ev.estimatedBenefitCents,
      benefitKind: ev.benefitKind,
      contactedBy: user?.email ?? null,
    });
  }
  revalidatePath("/dashboard/money-list");
  revalidatePath(`/dashboard/money-list/${loan.id}`);
  return { ok: true };
}

export async function saveLoanNotes(loanId: string, notes: string): Promise<{ ok: boolean }> {
  const { db } = await ctx();
  const loan = await db.closedLoan.findFirst({ where: { id: loanId } });
  if (!loan) return { ok: false };
  await db.closedLoan.update({ where: { id: loan.id }, data: { notes: notes.trim().slice(0, 2_000) || null } });
  revalidatePath(`/dashboard/money-list/${loan.id}`);
  return { ok: true };
}

export async function deleteLoan(loanId: string): Promise<{ ok: boolean }> {
  const { db, canManage } = await ctx();
  if (!canManage) return { ok: false };
  await db.closedLoan.deleteMany({ where: { id: loanId } });
  revalidatePath("/dashboard/money-list");
  return { ok: true };
}

export async function sendDigestNow(): Promise<{ ok: boolean; count: number; error?: string }> {
  const { broker, user } = await ctx();
  const r = await sendMoneyListDigest(broker, { userId: user?.id ?? null, manual: true });
  return { ok: r.sent, count: r.count, error: r.sent ? undefined : r.reason };
}
