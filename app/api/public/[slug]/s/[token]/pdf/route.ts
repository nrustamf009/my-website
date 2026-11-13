import { NextResponse } from "next/server";
import { renderScenarioPdf } from "@/lib/pdf/ScenarioPdf";
import { computeOptions, publicState } from "@/lib/scenarios";
import { isStaff, loadPublicScenario } from "@/lib/scenario-public";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const r = await loadPublicScenario(slug, token);
  if (!r || r.pc.unavailable) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { pc, s } = r;
  if (publicState(s) !== "LIVE" && !(await isStaff(pc.broker.id, pc.broker.agencyId))) return NextResponse.json({ error: "This scenario is no longer available." }, { status: 410 });
  const pdf = await renderScenarioPdf({
    brand: pc.brand,
    investorName: s.investorName,
    address: s.propertyAddress,
    mode: s.mode as "PURCHASE",
    valueCents: s.valueCents,
    rentCents: s.rentCents,
    rows: computeOptions(s, pc.ctx.grid),
    note: s.note,
    createdAt: s.updatedAt,
    expiresAt: s.expiresAt,
  });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="loan-options.pdf"`, "Cache-Control": "private, no-store" } });
}
