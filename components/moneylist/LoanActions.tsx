"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateDraft, saveLoanNotes, setLoanStatus } from "@/lib/actions/moneylist";
import { Button, Textarea, cx } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";

export interface Draft {
  subject: string;
  email: string;
  sms: string;
}

export function DraftPanel({ loanId, initial, hasEmail, hasPhone }: { loanId: string; initial: Draft | null; hasEmail: boolean; hasPhone: boolean }) {
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [tab, setTab] = useState<"email" | "sms">(hasEmail || !hasPhone ? "email" : "sms");
  const [mode, setMode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      setError(null);
      const r = await generateDraft(loanId);
      if (!r.ok) return setError(r.error ?? "Could not draft");
      setDraft({ subject: r.subject!, email: r.email!, sms: r.sms! });
      setMode(r.mode ?? null);
    });

  return (
    <section className="rounded-2xl border border-line bg-card" aria-label="Outreach draft" data-testid="draft-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex rounded-lg bg-paper p-0.5 text-sm" role="tablist">
          {(["email", "sms"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx("rounded-md px-3 py-1.5 font-medium transition", tab === k ? "bg-white text-ink shadow-sm" : "text-muted")}>
              {k === "email" ? "Email" : "Text"}
            </button>
          ))}
        </div>
        <Button size="sm" variant={draft ? "ghost" : "accent"} onClick={run} disabled={pending}>
          {pending ? "Drafting…" : draft ? "Redraft" : "Draft message"}
        </Button>
      </div>
      <div className="p-4">
        {error && <p className="mb-2 text-sm text-bad" role="alert">{error}</p>}
        {!draft ? (
          <p className="py-6 text-center text-sm text-muted">Draft a short, personal note in your tone. Figures come from the estimate above; the compliance footer is added automatically.</p>
        ) : tab === "email" ? (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0 truncate text-sm"><span className="text-muted">Subject: </span><span className="font-medium" data-testid="draft-subject">{draft.subject}</span></div>
              <CopyButton text={draft.subject} label="Copy subject" />
            </div>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-3 font-sans text-sm leading-relaxed text-ink-2" data-testid="draft-email">{draft.email}</pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={draft.email} label="Copy email" variant="primary" size="md" />
              {hasEmail ? null : <span className="self-center text-xs text-muted">No email on file for this borrower.</span>}
            </div>
          </div>
        ) : (
          <div>
            <pre className="whitespace-pre-wrap rounded-xl bg-paper p-3 font-sans text-sm leading-relaxed text-ink-2" data-testid="draft-sms">{draft.sms}</pre>
            <div className="mt-1 text-right text-xs text-muted">{draft.sms.length} characters{draft.sms.length > 320 ? " · may send as 3+ messages" : draft.sms.length > 160 ? " · 2 messages" : ""}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <CopyButton text={draft.sms} label="Copy text" variant="primary" size="md" />
              {!hasPhone && <span className="self-center text-xs text-muted">No phone on file.</span>}
            </div>
          </div>
        )}
        {mode === "mock" && <p className="mt-3 text-xs text-muted">Drafted from a template (AI not configured or unavailable).</p>}
      </div>
    </section>
  );
}

export function StatusActions({ loanId, status }: { loanId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const act = (input: Parameters<typeof setLoanStatus>[0], done: string) =>
    start(async () => {
      const r = await setLoanStatus(input);
      setMsg(r.ok ? done : (r.error ?? "Something went wrong"));
      router.refresh();
    });
  return (
    <div className="space-y-3" data-testid="status-actions">
      <div className="flex flex-wrap gap-2">
        <Button variant="accent" disabled={pending} onClick={() => act({ loanId, status: "CONTACTED", channel: "EMAIL" }, "Marked contacted by email")}>Mark contacted (email)</Button>
        <Button variant="secondary" disabled={pending} onClick={() => act({ loanId, status: "CONTACTED", channel: "SMS" }, "Marked contacted by text")}>Texted</Button>
        <Button variant="secondary" disabled={pending} onClick={() => act({ loanId, status: "CONTACTED", channel: "CALL" }, "Marked contacted by phone")}>Called</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted">Snooze</span>
        {[30, 60, 90].map((d) => (
          <Button key={d} size="sm" variant="secondary" disabled={pending} onClick={() => act({ loanId, status: "SNOOZED", snoozeDays: d }, `Snoozed ${d} days`)}>{d}d</Button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act({ loanId, status: "NOT_INTERESTED" }, "Marked not interested")}>Not interested</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act({ loanId, status: "WON" }, "Marked won 🎉")}>Won</Button>
        {status !== "OPEN" && <Button size="sm" variant="ghost" disabled={pending} onClick={() => act({ loanId, status: "OPEN" }, "Reopened")}>Reopen</Button>}
      </div>
      {msg && <p className="text-sm text-good" role="status">{msg}</p>}
    </div>
  );
}

export function NotesForm({ loanId, initial }: { loanId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div>
      <Textarea aria-label="Notes" rows={3} value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }} placeholder="Owns 4 doors, wants to buy a 5th next spring…" />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={pending || value === initial} onClick={() => start(async () => { await saveLoanNotes(loanId, value); setSaved(true); })}>Save notes</Button>
        {saved && <span className="text-xs text-good">Saved</span>}
      </div>
    </div>
  );
}
