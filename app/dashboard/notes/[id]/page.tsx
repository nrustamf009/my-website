import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { features, parseJson } from "@/lib/broker";
import { deleteSavedNote, forgetSourceText } from "@/lib/actions/notes";
import type { NotesReview } from "@/lib/notes/review";
import { Button, Card, CardHeader, LinkButton, Notice } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";

export const metadata = { title: "Notes result" };

export default async function NoteResult({ params }: { params: Promise<{ id: string }> }) {
  const { broker, db } = await requireBroker();
  if (!features(broker).notes) redirect("/dashboard");
  const { id } = await params;
  const n = await db.savedNote.findFirst({ where: { id } });
  if (!n) notFound();
  const r = parseJson<Partial<NotesReview>>(n.extraction, {});
  const checklist = parseJson<string[]>(n.checklist, []);
  const follow = parseJson<{ subject: string; body: string; mode?: string }>(n.followUp, { subject: "", body: "" });
  const scenario = n.scenarioId ? await db.scenario.findFirst({ where: { id: n.scenarioId }, include: { options: true } }) : null;
  const checklistText = checklist.map((c) => `- ${c}`).join("\n");
  const mailto = r.investorEmail ? `mailto:${r.investorEmail}?subject=${encodeURIComponent(follow.subject)}&body=${encodeURIComponent(follow.body)}` : null;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/notes" className="text-sm text-muted hover:text-ink">← Notes-to-Scenario</Link>
      <h1 className="mb-1 mt-2 font-display text-3xl tracking-tight text-ink">{n.title}</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">{r.summary}</p>
      <div className="mb-6"><Notice tone="good">Done. The scenario is a draft: check the options, then share it. The follow-up email already includes the link.</Notice></div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Scenario (draft)" subtitle={scenario ? `${scenario.options.length} options · ${scenario.propertyAddress}` : "Deleted"} action={scenario && <LinkButton href={`/dashboard/scenarios/${scenario.id}`} size="sm" variant="accent" data-testid="open-scenario">Review & share</LinkButton>} />
          <div className="space-y-2 px-5 pb-5 text-sm">
            {r.goals?.length ? <p><span className="font-medium">Goals:</span> {r.goals.join("; ")}</p> : null}
            {r.objections?.length ? <p><span className="font-medium">Concerns:</span> {r.objections.join("; ")}</p> : null}
            {r.nextSteps?.length ? <p><span className="font-medium">Next steps:</span> {r.nextSteps.join("; ")}</p> : null}
            {r.missingInfo?.length ? <p className="text-warn"><span className="font-medium">Still missing:</span> {r.missingInfo.join(", ")}</p> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Document checklist" subtitle="Tailored to this deal" action={<CopyButton text={checklistText} label="Copy" />} />
          <ul className="list-disc space-y-1 px-5 pb-5 pl-10 text-sm text-ink-2" data-testid="checklist">{checklist.map((c) => <li key={c}>{c}</li>)}</ul>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Follow-up email" subtitle={follow.mode === "mock" ? "Drafted from a template (AI not configured)" : "Drafted in your tone"} action={<div className="flex gap-2"><CopyButton text={`${follow.subject}\n\n${follow.body}`} label="Copy" />{mailto && <LinkButton href={mailto} size="sm" variant="secondary">Open in mail</LinkButton>}</div>} />
        <div className="px-5 pb-5">
          <div className="mb-2 text-sm"><span className="text-muted">Subject: </span><span className="font-medium" data-testid="followup-subject">{follow.subject}</span></div>
          <pre className="whitespace-pre-wrap rounded-xl bg-paper p-4 font-sans text-sm leading-relaxed text-ink-2" data-testid="followup-body">{follow.body}</pre>
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-muted">
        {n.sourceText ? (
          <form action={async () => { "use server"; await forgetSourceText(n.id); }}><span>Original text is saved with this record. </span><Button size="sm" variant="ghost">Delete the original text</Button></form>
        ) : (
          <span data-testid="text-not-saved">The pasted text was not saved.</span>
        )}
        <form action={async () => { "use server"; await deleteSavedNote(n.id); }}><Button size="sm" variant="danger">Delete this record</Button></form>
      </div>
    </div>
  );
}
