import Link from "next/link";
import { requireBroker } from "@/lib/auth/session";
import { parseJson } from "@/lib/broker";
import { dscr, relativeTime } from "@/lib/format";
import { t } from "@/lib/strings/en";
import { LEAD_SOURCES, LEAD_SOURCE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_STATUS_TONE, leadWhere, type LeadStatus } from "@/lib/leads-meta";
import type { Verdict } from "@/lib/dscr";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader, Select, Td, Th, cx } from "@/components/ui";

export const metadata = { title: "Leads" };
type SP = { status?: string; source?: string; owner?: string; q?: string; deleted?: string };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { db, user } = await requireBroker();
  const sp = await searchParams;
  const where = leadWhere(sp, user?.id);
  const [leads, counts, users] = await Promise.all([
    db.lead.findMany({ where, orderBy: { createdAt: "desc" }, include: { realtor: true }, take: 300 }),
    db.lead.groupBy({ by: ["status"], _count: true }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "deleted") as [string, string][]).toString();
  const chip = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch, deleted: undefined }).filter(([, v]) => v) as [string, string][]);
    return `/dashboard/leads${p.toString() ? `?${p}` : ""}`;
  };
  const total = counts.reduce((n, c) => n + c._count, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Leads"
        subtitle="Everyone who asked for an estimate, a listing quote or a scenario. Your webhook sends each one to your CRM too."
        actions={<><LinkButton href={`/api/leads/export${qs ? `?${qs}` : ""}`} prefetch={false} variant="secondary" data-testid="export-csv">Export CSV</LinkButton><LinkButton href="/dashboard/leads/new" variant="accent">Add lead</LinkButton></>}
      />
      {sp.deleted && <div className="mb-4"><Notice tone="good">Personal data deleted.</Notice></div>}
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        <Link href={chip({ status: undefined })} className={pill(!sp.status)}>All <span className="num opacity-70">{total}</span></Link>
        {LEAD_STATUSES.map((s) => <Link key={s} href={chip({ status: s })} className={pill(sp.status === s)}>{LEAD_STATUS_LABEL[s]} <span className="num opacity-70">{counts.find((c) => c.status === s)?._count ?? 0}</span></Link>)}
      </div>
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" method="get">
        {sp.status && <input type="hidden" name="status" value={sp.status} />}
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search name, email, phone or address" aria-label="Search leads" className="h-10 rounded-lg border border-line bg-white px-3 text-sm" />
        <Select name="source" defaultValue={sp.source ?? ""} aria-label="Source"><option value="">All sources</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>)}</Select>
        <Select name="owner" defaultValue={sp.owner ?? "all"} aria-label="Owner"><option value="all">Everyone</option><option value="me">Mine</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select>
        <button className="h-10 rounded-lg bg-ink px-4 text-sm font-medium text-white">Filter</button>
      </form>
      {leads.length === 0 ? (
        <EmptyState title={total ? "No leads match" : "No leads yet"} body={total ? "Try clearing a filter." : "Share your Instant Check link (Share & embed) or put a listing snapshot in front of a realtor's buyers."} action={!total ? <LinkButton href="/dashboard/share" variant="accent">Share & embed</LinkButton> : undefined} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]" data-testid="lead-table">
              <thead className="border-b border-line"><tr><Th>Lead</Th><Th>Status</Th><Th>Source</Th><Th>Estimate</Th><Th>Owner</Th><Th>When</Th></tr></thead>
              <tbody className="divide-y divide-line">
                {leads.map((l) => {
                  const out = parseJson<{ verdict?: Verdict; dscrRatio?: number | null }>(l.engineOutput, {});
                  return (
                    <tr key={l.id} className="hover:bg-paper/60">
                      <Td><Link href={`/dashboard/leads/${l.id}`} className="font-medium text-ink hover:text-accent">{l.name}</Link><div className="max-w-[16rem] truncate text-xs text-muted">{l.propertyAddress ?? l.email}</div></Td>
                      <Td><Badge tone={LEAD_STATUS_TONE[l.status as LeadStatus]}>{LEAD_STATUS_LABEL[l.status as LeadStatus] ?? l.status}</Badge></Td>
                      <Td>{LEAD_SOURCE_LABEL[l.source] ?? l.source}{l.realtor && <div className="text-xs text-muted">via {l.realtor.name}</div>}{l.utmSource && <div className="text-xs text-muted">{l.utmSource}</div>}</Td>
                      <Td>{out.verdict ? <span>{t.verdict[out.verdict]} <span className="num text-muted">· {dscr(out.dscrRatio ?? null)}</span></span> : <span className="text-muted">—</span>}</Td>
                      <Td className="text-muted">{users.find((u) => u.id === l.ownerUserId)?.name ?? "Unassigned"}</Td>
                      <Td className="text-muted">{relativeTime(l.createdAt)}{l.submissions > 1 && <div className="text-xs">{l.submissions}× submitted</div>}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function pill(active: boolean) {
  return cx("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm", active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2");
}
