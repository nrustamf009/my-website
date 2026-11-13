import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features } from "@/lib/broker";
import { shortDate } from "@/lib/format";
import { Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { AddLoanForm, ImportWizard, PasteCsv } from "@/components/moneylist/ImportWizard";

export const metadata = { title: "Import closed loans" };

export default async function ImportPage() {
  const { broker, db } = await requireBroker();
  if (!features(broker).moneyList) redirect("/dashboard");
  const recent = await db.loanImport.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/money-list" className="text-sm text-muted hover:text-ink">← Money List</Link>
      <PageHeader
        title="Import closed loans"
        subtitle="Export closed loans from your LOS and drop the CSV here. We match columns automatically; re-importing the same file updates loans instead of duplicating them."
        actions={<LinkButton href="/api/money-list/template" variant="secondary" prefetch={false}>Download CSV template</LinkButton>}
      />
      <div className="space-y-6">
        <ImportWizard />
        <PasteCsv />
        {recent.length > 0 && (
          <p className="text-xs text-muted">Recent imports: {recent.map((r) => `${r.filename} (${shortDate(r.createdAt)}: ${r.created} new, ${r.updated} updated)`).join(" · ")}</p>
        )}
        <Card>
          <CardHeader title="Add one loan" subtitle="Same checks as the CSV import." />
          <div className="px-5 pb-5"><AddLoanForm /></div>
        </Card>
        <p className="text-xs text-muted">Borrower contact details stay in your account only. We never contact borrowers on your behalf; you send every message yourself.</p>
      </div>
    </div>
  );
}
