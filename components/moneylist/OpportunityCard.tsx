"use client";

import { useState, useTransition } from "react";
import { generateDraft, saveDraft, setContacted } from "@/lib/actions/moneylist";
import { Badge, Button, Card, Textarea, cx } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";

export interface OpportunityView {
  loanId: string;
  borrowerName: string;
  email: string | null;
  phone: string | null;
  propertyAddress: string;
  facts: string;
  reasons: { kind: string; label: string; detail: string }[];
  benefit: string;
  draft: string | null;
  contacted: boolean;
  rank: number;
}

const TONE = { PREPAY: "accent", SEASONING: "warn", RATE: "good" } as const;

export function OpportunityCard({ o }: { o: OpportunityView }) {
  const [draft, setDraft] = useState(o.draft ?? "");
  const [open, setOpen] = useState(Boolean(o.draft));
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [contacted, setC] = useState(o.contacted);

  return (
    <Card className={cx("overflow-hidden transition", contacted && "opacity-60")} data-testid="opportunity">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="num hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-deep sm:grid">{o.rank}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{o.borrowerName}</h3>
            {o.reasons.map((r) => <Badge key={r.kind} tone={TONE[r.kind as keyof typeof TONE] ?? "neutral"}>{r.label}</Badge>)}
            {contacted && <Badge>Contacted</Badge>}
          </div>
          <div className="mt-0.5 text-sm text-muted">{o.propertyAddress} · {o.facts}</div>
          <ul className="mt-2 space-y-0.5 text-sm text-ink-2">{o.reasons.map((r) => <li key={r.kind}>• {r.detail}</li>)}</ul>
          <div className="mt-3 rounded-lg bg-paper px-3 py-2 text-sm font-medium text-ink"><span className="text-muted">Estimated benefit: </span>{o.benefit}</div>
        </div>
        <div className="flex shrink-0 gap-2 sm:flex-col">
          <Button
            size="sm"
            variant={draft ? "secondary" : "accent"}
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await generateDraft(o.loanId);
                if (r.error) setError(r.error);
                else {
                  setDraft(r.draft!);
                  setMode(r.mode ?? null);
                  setOpen(true);
                }
              })
            }
          >
            {pending ? "Drafting…" : draft ? "Regenerate" : "Draft message"}
          </Button>
          <Button
            size="sm"
            variant={contacted ? "ghost" : "secondary"}
            onClick={() => start(async () => { await setContacted(o.loanId, !contacted); setC(!contacted); })}
          >
            {contacted ? "Undo contacted" : "Mark contacted"}
          </Button>
        </div>
      </div>
      {error && <p className="px-5 pb-3 text-sm text-bad">{error}</p>}
      {open && draft && (
        <div className="border-t border-line bg-paper/60 p-5">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>Message draft{mode === "mock" ? " · mock AI (add ANTHROPIC_API_KEY for Claude)" : mode === "claude" ? " · written by Claude" : ""}. Edit before sending.</span>
            <span>{[o.phone, o.email].filter(Boolean).join(" · ")}</span>
          </div>
          <Textarea rows={7} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => saveDraft(o.loanId, draft)} data-testid="draft" />
          <div className="mt-2 flex gap-2">
            <CopyButton text={draft} label="Copy" variant="primary" />
            {o.email && <a className="inline-flex h-8 items-center rounded-lg px-3 text-sm text-ink-2 hover:bg-black/5" href={`mailto:${o.email}?body=${encodeURIComponent(draft)}`}>Open in email</a>}
          </div>
        </div>
      )}
    </Card>
  );
}
