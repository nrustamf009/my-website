import Papa from "papaparse";
import { requireBroker } from "@/lib/auth/session";
import { parseJson } from "@/lib/broker";
import { dscr, usd } from "@/lib/format";
import { LEAD_SOURCE_LABEL, leadWhere } from "@/lib/leads-meta";

export const dynamic = "force-dynamic";

/** CSV of the filtered lead list. Broker staff only; tenant-scoped. */
export async function GET(req: Request) {
  const { db, user } = await requireBroker();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const leads = await db.lead.findMany({ where: leadWhere(sp, user?.id), orderBy: { createdAt: "desc" }, include: { realtor: true, consents: true }, take: 10_000 });
  const users = await db.user.findMany({ select: { id: true, name: true } });
  const rows = leads.map((l) => {
    const out = parseJson<{ verdict?: string; dscrRatio?: number | null; loanAmountCents?: number }>(l.engineOutput, {});
    return {
      created_at: l.createdAt.toISOString(),
      name: l.name,
      email: l.email,
      phone: l.phone ?? "",
      status: l.status,
      source: LEAD_SOURCE_LABEL[l.source] ?? l.source,
      owner: users.find((u) => u.id === l.ownerUserId)?.name ?? "",
      property_address: l.propertyAddress ?? "",
      state: l.state ?? "",
      estimate: out.verdict ?? "",
      dscr: out.dscrRatio != null ? dscr(out.dscrRatio) : "",
      loan_amount: out.loanAmountCents ? usd(out.loanAmountCents) : "",
      realtor: l.realtor ? `${l.realtor.name} (${l.realtor.brokerage})` : "",
      utm_source: l.utmSource ?? "",
      utm_campaign: l.utmCampaign ?? "",
      marketing_consent: l.consents.find((c) => c.kind === "MARKETING")?.granted ? "yes" : "no",
      submissions: l.submissions,
      notes: l.notes ?? "",
    };
  });
  const fields = ["created_at", "name", "email", "phone", "status", "source", "owner", "property_address", "state", "estimate", "dscr", "loan_amount", "realtor", "utm_source", "utm_campaign", "marketing_consent", "submissions", "notes"];
  const csv = Papa.unparse({ fields, data: rows.map((r) => fields.map((f) => r[f as keyof typeof r])) }, { escapeFormulae: true });
  return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
