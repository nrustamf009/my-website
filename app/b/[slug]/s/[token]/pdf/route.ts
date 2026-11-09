import { prisma } from "@/lib/db";
import { pickPublic } from "@/lib/leads";
import { renderScenarioPdf } from "@/lib/pdf/ScenarioPdf";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; token: string }> }) {
  const { slug, token } = await params;
  const s = await prisma.scenario.findFirst({ where: { token, broker: { slug, active: true }, status: { not: "ARCHIVED" } }, include: { broker: true, options: true } });
  if (!s) return new Response("Not found", { status: 404 });
  const pdf = await renderScenarioPdf(pickPublic(s.broker), s);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Loan-options-${s.propertyAddress.split(",")[0]!.replace(/[^a-z0-9]+/gi, "-")}.pdf"`, "X-Robots-Tag": "noindex" } });
}
