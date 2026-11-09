"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { requireBroker } from "@/lib/auth/session";
import { evaluateLoan, settingsFromBroker } from "@/lib/dscr";
import { parseCsv, validateRows, type ColumnMapping, type RowError } from "@/lib/moneylist/csv";
import { sendMoneyListDigest } from "@/lib/moneylist/digest";
import { withAiFallback } from "@/lib/providers/ai";
import { dispatchWebhook } from "@/lib/webhooks";

const MAX_CSV_BYTES = 2_000_000;

export type ImportResult = { ok: boolean; validCount: number; total: number; errors: RowError[]; imported?: number; updated?: number; message?: string };

export async function importLoans(csvText: string, mapping: ColumnMapping, filename: string, dryRun: boolean): Promise<ImportResult> {
  const { broker } = await requireBroker();
  if (csvText.length > MAX_CSV_BYTES) return { ok: false, validCount: 0, total: 0, errors: [], message: "File is too large (max 2 MB)." };
  const { rows, parseErrors } = parseCsv(csvText);
  if (rows.length === 0) return { ok: false, validCount: 0, total: 0, errors: [], message: "The file has no data rows." };
  if (rows.length > 5000) return { ok: false, validCount: 0, total: rows.length, errors: [], message: "Import up to 5,000 rows at a time." };
  const { loans, errors } = validateRows(rows, mapping);
  if (parseErrors.length) errors.unshift(...parseErrors.map((m) => ({ row: 0, field: "File", value: "", message: m })));
  if (dryRun || errors.length) return { ok: errors.length === 0, validCount: loans.length, total: rows.length, errors: errors.slice(0, 200) };

  const batch = await prisma.loanImport.create({ data: { brokerId: broker.id, filename: filename.slice(0, 200), rowCount: loans.length, mapping: JSON.stringify(mapping) } });
  let imported = 0;
  let updated = 0;
  for (const l of loans) {
    const where = { brokerId_propertyAddress_closingDate: { brokerId: broker.id, propertyAddress: l.propertyAddress, closingDate: l.closingDate } };
    const exists = await prisma.closedLoan.findUnique({ where });
    await prisma.closedLoan.upsert({ where, create: { ...l, brokerId: broker.id, importId: batch.id }, update: { ...l, importId: batch.id } });
    if (exists) updated++;
    else imported++;
  }
  revalidatePath("/dashboard/money-list");
  return { ok: true, validCount: loans.length, total: rows.length, errors: [], imported, updated };
}

export async function updateMarketRate(formData: FormData) {
  const { broker } = await requireBroker();
  const rate = z.coerce.number().min(1).max(20).safeParse(formData.get("marketRate"));
  if (!rate.success) return;
  await prisma.broker.update({ where: { id: broker.id }, data: { marketRate: rate.data, marketRateUpdatedAt: new Date() } });
  revalidatePath("/dashboard/money-list");
}

export async function generateDraft(loanId: string): Promise<{ draft?: string; mode?: string; error?: string }> {
  const { broker } = await requireBroker();
  const loan = await prisma.closedLoan.findFirst({ where: { id: loanId, brokerId: broker.id } });
  if (!loan) return { error: "Loan not found" };
  const opp = evaluateLoan(loan, settingsFromBroker(broker));
  if (!opp) return { error: "This loan no longer matches a Money List rule." };
  try {
    const { value, mode } = await withAiFallback("moneylist.draft", (ai) =>
      ai.draftOutreach(
        {
          brokerName: broker.name,
          companyName: broker.companyName,
          borrowerFirstName: loan.borrowerName.split(" ")[0]!,
          propertyAddress: loan.propertyAddress,
          reasons: opp.reasons.map((r) => r.detail),
          benefit: opp.benefit,
        },
        broker.messageTone,
      ),
    );
    await prisma.closedLoan.update({ where: { id: loan.id }, data: { draftMessage: value, draftedAt: new Date() } });
    revalidatePath("/dashboard/money-list");
    return { draft: value, mode };
  } catch {
    return { error: "Couldn't generate a draft right now. Try again in a minute." };
  }
}

export async function saveDraft(loanId: string, text: string) {
  const { broker } = await requireBroker();
  await prisma.closedLoan.updateMany({ where: { id: loanId, brokerId: broker.id }, data: { draftMessage: text.slice(0, 4000) } });
}

export async function setContacted(loanId: string, contacted: boolean) {
  const { broker } = await requireBroker();
  const loan = await prisma.closedLoan.findFirst({ where: { id: loanId, brokerId: broker.id } });
  if (!loan) return;
  await prisma.closedLoan.update({ where: { id: loan.id }, data: { contactedAt: contacted ? new Date() : null } });
  if (contacted) {
    const opp = evaluateLoan(loan, settingsFromBroker(broker));
    await dispatchWebhook(broker, "money_list.contacted", {
      loan: { id: loan.id, borrowerName: loan.borrowerName, email: loan.email, phone: loan.phone, propertyAddress: loan.propertyAddress, ratePct: loan.ratePct, loanAmount: loan.loanAmount },
      reasons: opp?.reasons.map((r) => r.kind) ?? [],
      benefit: opp?.benefit ?? null,
      message: loan.draftMessage,
    });
  }
  revalidatePath("/dashboard/money-list");
}

export async function sendDigestNow(): Promise<{ sent: boolean; count: number }> {
  const { broker } = await requireBroker();
  return sendMoneyListDigest(broker.id);
}
