import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBroker } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/broker";
import { dateTime } from "@/lib/format";
import type { CallExtraction, FollowUpEmail } from "@/lib/providers/ai";
import { deleteCall } from "@/lib/actions/calls";
import { Button, Card, CardHeader, LinkButton, Notice, PageHeader } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";
import { CallReview } from "@/components/calls/CallReview";

export default async function CallPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ converted?: string }> }) {
  const { broker } = await requireBroker();
  const { id } = await params;
  const { converted } = await searchParams;
  const call = await prisma.callSession.findFirst({ where: { id, brokerId: broker.id } });
  if (!call) notFound();
  const extraction = parseJson<CallExtraction | null>(call.extraction, null);
  const checklist = parseJson<string[]>(call.checklist, []);
  const email = parseJson<FollowUpEmail | null>(call.followUpEmail, null);
  const to = extraction?.investor.email;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={call.title ?? "Call"} subtitle={`${call.inputType === "AUDIO" ? "Recording (audio deleted after transcription)" : "Notes"} · ${dateTime(call.createdAt)}`} actions={call.scenarioId ? <LinkButton href={`/dashboard/scenarios/${call.scenarioId}/edit`} variant="accent">Open draft scenario</LinkButton> : undefined} />
      {converted && <Notice tone="good">Draft scenario, document checklist and follow-up email are ready. Review the scenario, then share it.</Notice>}

      {call.status === "CONVERTED" && (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader title="Follow-up email" subtitle={`In your tone: “${broker.messageTone}”`} action={email ? <CopyButton text={`Subject: ${email.subject}\n\n${email.body}`} label="Copy email" /> : undefined} />
            {email && (
              <div className="p-5">
                <div className="text-sm"><span className="text-muted">Subject:</span> <strong>{email.subject}</strong></div>
                <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-2" data-testid="followup-body">{email.body}</pre>
                {to && <a className="mt-3 inline-block text-sm text-accent underline" href={`mailto:${to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`}>Open in your email app</a>}
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="DSCR document checklist" action={<CopyButton text={checklist.map((c) => `- ${c}`).join("\n")} label="Copy" />} />
            <ul className="space-y-2 p-5 text-sm" data-testid="checklist">
              {checklist.map((c) => <li key={c} className="flex gap-2"><span className="mt-0.5 h-4 w-4 shrink-0 rounded border border-line" />{c}</li>)}
            </ul>
          </Card>
        </div>
      )}

      {extraction ? <CallReview callId={call.id} initial={extraction} converted={call.status === "CONVERTED"} /> : <Notice tone="bad">Extraction failed for this call.</Notice>}

      {call.transcript && (
        <details className="rounded-2xl border border-line bg-white">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium">Transcript</summary>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-line p-5 font-sans text-sm text-ink-2">{call.transcript}</pre>
        </details>
      )}
      <div className="flex items-center gap-3">
        <form action={deleteCall.bind(null, call.id)}><Button variant="danger" size="sm">Delete call and transcript</Button></form>
        <Link href="/dashboard/calls" className="text-sm text-muted">Back to calls</Link>
      </div>
    </div>
  );
}
