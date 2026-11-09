"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireBroker } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { escrowFromPrice, loanFromLtv } from "@/lib/dscr";
import { processCall, CALL_ERRORS } from "@/lib/calls/process";
import { dscrChecklist } from "@/lib/calls/checklist";
import { CallExtractionSchema, withAiFallback, type CallExtraction } from "@/lib/providers/ai";
import { defaultOption } from "@/lib/scenario-schema";
import { randomToken } from "@/lib/tokens";

export async function processNotes(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const { broker } = await requireBroker();
  const notes = String(formData.get("notes") ?? "").slice(0, 60_000);
  const r = await processCall({ brokerId: broker.id, notes });
  if (!r.ok) return { error: CALL_ERRORS[r.code] };
  redirect(`/dashboard/calls/${r.id}`);
}

export async function saveReview(callId: string, extraction: CallExtraction): Promise<{ ok: boolean; error?: string }> {
  const { broker } = await requireBroker();
  const parsed = CallExtractionSchema.safeParse(extraction);
  if (!parsed.success) return { ok: false, error: "Some fields are invalid." };
  await prisma.callSession.updateMany({ where: { id: callId, brokerId: broker.id }, data: { extraction: JSON.stringify(parsed.data) } });
  return { ok: true };
}

/**
 * One click: draft Scenario Sheet + DSCR document checklist + follow-up email in the broker's tone.
 */
export async function convertCall(callId: string, extraction: CallExtraction): Promise<{ error?: string }> {
  const { broker } = await requireBroker();
  const call = await prisma.callSession.findFirst({ where: { id: callId, brokerId: broker.id } });
  if (!call) return { error: "Call not found" };
  const parsed = CallExtractionSchema.safeParse(extraction);
  if (!parsed.success) return { error: "Some fields are invalid." };
  const x = parsed.data;
  if (!x.deal.purchasePrice) return { error: "Add the purchase price or property value first." };

  const value = Math.round(x.deal.purchasePrice);
  const purpose = x.deal.loanPurpose ?? "PURCHASE";
  const ltv = x.deal.loanAmount ? null : x.deal.downPaymentPct != null ? 1 - x.deal.downPaymentPct : purpose === "CASH_OUT" ? 0.75 : 0.75;
  const loanAmount = x.deal.loanAmount ? Math.round(x.deal.loanAmount) : loanFromLtv(value, ltv!);
  const esc = escrowFromPrice(value, broker.taxRatePct, broker.insuranceRatePct);
  const rate = x.deal.targetRatePct ?? broker.defaultRate;
  const prepay = x.deal.prepayPreference;
  const options = [defaultOption("A", value, rate, 0), defaultOption("B", value, rate, 1), defaultOption("C", value, rate, 2)].map((o) => ({
    ...o,
    loanAmount,
    prepay: o.label === "C" ? (prepay === "5-4-3-2-1" ? "3-2-1" : "NONE") : (prepay ?? o.prepay),
  }));
  // If the investor didn't want IO, make C a shorter-prepay alternative instead.
  if (x.deal.wantsInterestOnly === false) Object.assign(options[2]!, { interestOnly: false, ioYears: null, ratePct: rate + 0.25 });

  const firstName = (x.investor.name ?? "there").split(" ")[0]!;
  const scenario = await prisma.scenario.create({
    data: {
      brokerId: broker.id,
      token: randomToken(20),
      status: "DRAFT",
      origin: "CALL",
      investorName: x.investor.name ?? "Investor",
      investorEmail: x.investor.email,
      investorPhone: x.investor.phone,
      propertyAddress: x.deal.propertyAddress ?? "Property address TBD",
      loanPurpose: purpose,
      propertyValue: value,
      monthlyRent: Math.round(x.deal.monthlyRent ?? 0),
      taxesMonthly: x.deal.taxesMonthly ?? Math.round(esc.taxesMonthly),
      insuranceMonthly: x.deal.insuranceMonthly ?? Math.round(esc.insuranceMonthly),
      hoaMonthly: x.deal.hoaMonthly ?? 0,
      note: `Hi ${firstName}, great talking with you. Here are the options we discussed${x.goals[0] ? `, built around your goal to ${x.goals[0].replace(/^(i |to )/i, "").replace(/\.$/, "").toLowerCase()}` : ""}.`,
      options: { create: options.map((o, i) => ({ ...o, sortOrder: i })) },
    },
  });
  const checklist = dscrChecklist(x);
  const { value: email } = await withAiFallback("calls.followup", (ai) =>
    ai.draftFollowUpEmail(
      {
        brokerName: broker.name,
        companyName: broker.companyName,
        brokerPhone: broker.phone,
        investorFirstName: firstName,
        propertyAddress: x.deal.propertyAddress,
        summary: x.summary,
        nextSteps: x.nextSteps,
        checklist,
        scenarioUrl: `${env.appUrl}/b/${broker.slug}/s/${scenario.token}`,
      },
      broker.messageTone,
    ),
  );
  await prisma.callSession.update({
    where: { id: call.id },
    data: { status: "CONVERTED", scenarioId: scenario.id, extraction: JSON.stringify(x), checklist: JSON.stringify(checklist), followUpEmail: JSON.stringify(email) },
  });
  revalidatePath("/dashboard/calls");
  redirect(`/dashboard/calls/${call.id}?converted=1`);
}

export async function deleteCall(callId: string) {
  const { broker } = await requireBroker();
  await prisma.callSession.deleteMany({ where: { id: callId, brokerId: broker.id } });
  revalidatePath("/dashboard/calls");
  redirect("/dashboard/calls");
}
