import Link from "next/link";
import { redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features } from "@/lib/broker";
import { SAMPLE_NOTES } from "@/lib/notes/samples";
import { relativeTime } from "@/lib/format";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { NotesConverter } from "@/components/notes/Converter";

export const metadata = { title: "Notes-to-Scenario" };

export default async function NotesPage() {
  const { broker, db } = await requireBroker();
  if (!features(broker).notes) redirect("/dashboard");
  const saved = await db.savedNote.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, createdAt: true, scenarioId: true } });
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Notes-to-Scenario" subtitle="Paste what you heard on the call. We pull out the deal, you check it, and one click builds the scenario, the document checklist and a follow-up email." />
      <NotesConverter samples={SAMPLE_NOTES.map((s) => ({ id: s.id, label: s.label.replace("Sample: ", "Try: "), text: s.text }))} />
      {saved.length > 0 && (
        <Card className="mt-8">
          <CardHeader title="Recent" />
          <ul className="divide-y divide-line">
            {saved.map((n) => <li key={n.id}><Link href={`/dashboard/notes/${n.id}`} className="flex justify-between gap-3 px-5 py-3 text-sm hover:bg-paper/60"><span className="font-medium text-ink">{n.title}</span><span className="text-muted">{relativeTime(n.createdAt)}</span></Link></li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
