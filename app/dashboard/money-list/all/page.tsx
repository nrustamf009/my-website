import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features } from "@/lib/broker";
import { evaluateLoan } from "@/lib/moneylist/list";
import { triggerShort } from "@/lib/moneylist/describe";
import { rate, shortDate, usd } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE } from "@/components/moneylist/labels";

export const metadata = { title: "All closed loans" };

export default async function AllLoans() {
  const { broker, db } = await requireBroker();
  if (!features(broker).moneyList) redirect("/dashboard");
  const loans = await db.closedLoan.findMany({ orderBy: { closingDate: "desc" } });
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/money-list" className="text-sm text-muted hover:text-ink">← Money List</Link>
      <PageHeader title="All closed loans" subtitle={`${loans.length} loans watched, newest closing first.`} />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line" data-testid="all-loans">
          {loans.map((l) => {
            const ev = evaluateLoan(l, broker);
            return (
              <li key={l.id}>
                <Link href={`/dashboard/money-list/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-alt">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{l.borrowerName}</div>
                    <div className="truncate text-xs text-muted">{l.propertyAddress} · closed {shortDate(l.closingDate)} · {usd(l.loanAmountCents)} at {rate(l.rateMilli)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {ev.triggers.length > 0 && <span className="hidden text-xs text-muted sm:inline">{ev.triggers.map(triggerShort).join(" · ")}</span>}
                    <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
