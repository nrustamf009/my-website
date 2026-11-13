"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireBroker } from "@/lib/auth/session";
import { engineContext, features, licensedStates, staffBrand, toneOf } from "@/lib/broker";
import { annual, defaultScenarioLoan, estimateEscrow, ficoBucketOf, priceScenarioOption, type Mode, type Prepay, type Product, type ScenarioPropertyInput, type UsState } from "@/lib/dscr";
import { extractNotes as runExtraction, draftFollowUp, type NotesExtraction } from "@/lib/providers/ai";
import { rateLimit } from "@/lib/request";
import { parsePctToRatio } from "@/lib/format";
import { randomToken } from "@/lib/tokens";
import { emit } from "@/lib/events";
import { env } from "@/lib/env";
import { e164 } from "@/lib/check/form";
import { dscrChecklist } from "@/lib/notes/checklist";
import { emailFooter } from "@/lib/moneylist/describe";
import { NotesReviewSchema, reviewFromExtraction, type NotesReview, type NotesReviewDraft } from "@/lib/notes/review";
import { expiryFrom } from "@/lib/scenarios";
import { DEFAULT_LENDER_FEES_CENTS } from "@/lib/scenario-builder";

const MAX_CHARS = 20_000;

async function ctx() {
  const c = await requireBroker();
  if (!features(c.broker).notes) throw new Error("Notes-to-Scenario is not enabled for this account");
  return c;
}

/** Step 1: extract. Nothing is written to the database and the text is not logged. */
export async function extractFromNotes(text: string): Promise<{ ok: boolean; error?: string; review?: NotesReviewDraft; extraction?: NotesExtraction; mode?: string }> {
  const { broker, user } = await ctx();
  const clean = text.trim();
  if (clean.length < 40) return { ok: false, error: "Paste at least a few sentences of notes, an email or a transcript." };
  if (clean.length > MAX_CHARS) return { ok: false, error: `That's over ${MAX_CHARS.toLocaleString()} characters. Paste the relevant part of the conversation.` };
  if (!(await rateLimit(`notes:${user?.id ?? broker.id}`, 40, 3600))) return { ok: false, error: "You've reached the hourly limit. Try again in a bit." };
  try {
    const { value, mode } = await runExtraction(clean);
    const states = licensedStates(broker);
    return { ok: true, extraction: value, review: reviewFromExtraction(value, states.length === 1 ? states[0] : undefined), mode };
  } catch {
    return { ok: false, error: "We couldn't read those notes. Try again, or fill in the form by hand." };
  }
}

/**
 * Step 2: the LO confirmed the reviewed fields. Creates a draft scenario (engine-priced options),
 * a tailored document checklist and a follow-up email; optionally keeps the pasted text.
 */
export async function convertNotes(input: { review: NotesReview; saveText: boolean; text: string }): Promise<{ ok: false; error: string; fieldErrors?: Record<string, string> } | never> {
  const { db, broker, user } = await ctx();
  const p = NotesReviewSchema.safeParse(input.review);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the highlighted fields", fieldErrors: Object.fromEntries(p.error.issues.map((i) => [i.path.join("."), i.message])) };
  const r = p.data;
  const c = engineContext(broker);
  const state = r.state as UsState;
  const mode = r.mode as Mode;
  const est = estimateEscrow(state, r.valueCents, c);
  const property: ScenarioPropertyInput = {
    mode,
    valueCents: r.valueCents,
    rentCents: r.rentCents,
    taxesAnnualCents: r.taxesMonthlyCents != null ? annual(r.taxesMonthlyCents) : est.taxesAnnualCents,
    insuranceAnnualCents: r.insuranceMonthlyCents != null ? annual(r.insuranceMonthlyCents) : est.insuranceAnnualCents,
    hoaMonthlyCents: r.hoaMonthlyCents,
    currentBalanceCents: mode === "PURCHASE" ? null : r.currentBalanceCents,
  };
  const fico = r.ficoScore ? ficoBucketOf(r.ficoScore) : "740+";
  const loan = defaultScenarioLoan(mode, r.valueCents, r.downPaymentPercent != null ? parsePctToRatio(r.downPaymentPercent) : null);
  const prepay: Prepay = (r.prepayPreference || "5-4-3-2-1") as Prepay;
  const structures: [Product, Prepay, number][] = r.wantsInterestOnly === false
    ? [["FIXED30", prepay, 0], ["FIXED30", prepay, 100], ["ARM7_6", prepay, 0]]
    : r.wantsInterestOnly === true
      ? [["IO30", prepay, 0], ["FIXED30", prepay, 0], ["IO30", prepay, 100]]
      : [["FIXED30", prepay, 0], ["IO30", prepay, 0], ["FIXED30", prepay, 100]];
  const options = structures.map(([product, pp, pointsRatio], i) => {
    const o = { product, prepay: pp, pointsRatio, feesCents: DEFAULT_LENDER_FEES_CENTS, loanAmountCents: loan };
    return { ...o, label: "ABC"[i]!, sortOrder: i, recommended: i === 0, rateMilli: priceScenarioOption(property, o, c.grid, fico) };
  });

  // CRM: the investor becomes (or updates) a lead with source NOTES. No web consent is implied.
  const email = r.investorEmail.toLowerCase();
  const phoneE164 = e164(r.investorPhone);
  const existing = email || phoneE164 ? await db.lead.findFirst({ where: { OR: [...(email ? [{ email }] : []), ...(phoneE164 ? [{ phoneE164 }] : [])] } }) : null;
  const lead = existing
    ? await db.lead.update({ where: { id: existing.id }, data: { propertyAddress: r.propertyAddress, state } })
    : await db.lead.create({ data: { brokerId: broker.id, source: "NOTES", status: "IN_PROGRESS", name: r.investorName, email, phone: r.investorPhone || null, phoneE164, propertyAddress: r.propertyAddress, state, ownerUserId: user?.id ?? broker.primaryUserId ?? null, engineInput: "{}", engineOutput: "{}" } });

  const scenario = await db.scenario.create({
    data: {
      brokerId: broker.id,
      ownerUserId: user?.id ?? broker.primaryUserId ?? "",
      token: randomToken(14),
      status: "DRAFT",
      origin: "NOTES",
      expiresAt: expiryFrom(),
      mode,
      investorName: r.investorName,
      investorEmail: email || null,
      investorPhone: r.investorPhone || null,
      leadId: lead.id,
      propertyAddress: r.propertyAddress,
      state,
      propertyType: r.propertyType,
      use: r.use,
      valueCents: property.valueCents,
      currentBalanceCents: property.currentBalanceCents ?? null,
      rentCents: property.rentCents,
      taxesAnnualCents: property.taxesAnnualCents,
      insuranceAnnualCents: property.insuranceAnnualCents,
      hoaMonthlyCents: property.hoaMonthlyCents,
      ficoBucket: fico,
      options: { create: options },
    },
  });

  const checklist = dscrChecklist({ mode, propertyType: r.propertyType, use: r.use, entity: r.entity || null, experience: r.experience || null });
  const brand = await staffBrand(broker, user);
  const follow = await draftFollowUp(
    {
      loName: brand.lo.name,
      companyName: brand.companyName,
      loPhone: brand.lo.phone,
      investorFirstName: r.investorName.split(" ")[0]!,
      propertyAddress: r.propertyAddress,
      summary: r.summary,
      nextSteps: r.nextSteps,
      checklist,
      scenarioUrl: `${env.appUrl}/b/${broker.slug}/s/${scenario.token}`,
    },
    toneOf(broker),
  );
  const note = await db.savedNote.create({
    data: {
      brokerId: broker.id,
      userId: user?.id ?? "",
      title: `${r.investorName} · ${r.propertyAddress.split(",")[0]}`,
      extraction: JSON.stringify(r),
      sourceText: input.saveText ? input.text.slice(0, MAX_CHARS) : null,
      checklist: JSON.stringify(checklist),
      followUp: JSON.stringify({ subject: follow.value.subject, body: `${follow.value.body.trim()}${emailFooter(brand)}`, mode: follow.mode }),
      scenarioId: scenario.id,
    },
  });
  await emit(db, "notes.converted", "SavedNote", note.id, { scenarioId: scenario.id, aiMode: follow.mode, savedText: input.saveText }, user?.id);
  await emit(db, "scenario.created", "Scenario", scenario.id, { origin: "NOTES" }, user?.id);
  revalidatePath("/dashboard/notes");
  redirect(`/dashboard/notes/${note.id}`);
}

export async function deleteSavedNote(id: string) {
  const { db } = await ctx();
  await db.savedNote.deleteMany({ where: { id } });
  revalidatePath("/dashboard/notes");
  redirect("/dashboard/notes");
}

export async function forgetSourceText(id: string) {
  const { db } = await ctx();
  await db.savedNote.updateMany({ where: { id }, data: { sourceText: null } });
  revalidatePath(`/dashboard/notes/${id}`);
}

