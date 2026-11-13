"use client";

import { useState, useTransition } from "react";
import { convertNotes, extractFromNotes } from "@/lib/actions/notes";
import type { NotesReview, NotesReviewDraft } from "@/lib/notes/review";
import { PROPERTY_TYPES, US_STATES } from "@/lib/dscr";
import { normalizeAddress } from "@/lib/providers/address";
import { t } from "@/lib/strings/en";
import { Button, Card, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";
import { MoneyInput } from "@/components/public/MoneyInput";

export function NotesConverter({ samples }: { samples: { id: string; label: string; text: string }[] }) {
  const [text, setText] = useState("");
  const [review, setReview] = useState<NotesReviewDraft | null>(null);
  const [aiMode, setAiMode] = useState<string | null>(null);
  const [saveText, setSaveText] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof NotesReviewDraft>(k: K, v: NotesReviewDraft[K]) => setReview((r) => (r ? { ...r, [k]: v } : r));

  const extract = () =>
    start(async () => {
      setError(null);
      const r = await extractFromNotes(text);
      if (!r.ok) return setError(r.error ?? "Something went wrong");
      setReview(r.review!);
      setAiMode(r.mode ?? null);
    });
  const confirm = () =>
    start(async () => {
      setError(null);
      setFieldErrors({});
      try {
        const r = await convertNotes({ review: review as NotesReview, saveText, text });
        if (r && !r.ok) {
          setError(r.error);
          setFieldErrors(r.fieldErrors ?? {});
        }
      } catch (e) {
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
        setError("Couldn't create the scenario. Try again.");
      }
    });

  if (!review) {
    return (
      <Card className="p-5">
        <label htmlFor="notes-text" className="mb-2 block font-display text-xl">Paste call notes, an email thread or a transcript</label>
        <Textarea id="notes-text" rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Spoke with Jordan about a duplex in Tampa, under contract at $468k, 25% down, rents $3,850 combined…"} maxLength={20_000} />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>{text.length.toLocaleString()} / 20,000 · Nothing is saved until you confirm. Don&apos;t paste SSNs or account numbers.</span>
          <span className="flex flex-wrap gap-2">
            {samples.map((s) => <button key={s.id} type="button" className="text-accent underline" onClick={() => setText(s.text)}>{s.label}</button>)}
          </span>
        </div>
        {error && <div className="mt-3"><Notice tone="bad">{error}</Notice></div>}
        <Button className="mt-4" variant="accent" size="lg" onClick={extract} disabled={pending || text.trim().length < 40}>{pending ? "Reading the notes…" : "Extract the deal"}</Button>
      </Card>
    );
  }

  const r = review;
  const err = (k: string) => fieldErrors[k];
  const purchase = r.mode === "PURCHASE";
  const List = ({ k, label }: { k: "goals" | "objections" | "nextSteps" | "missingInfo"; label: string }) => (
    <Field label={label} htmlFor={`nl-${k}`} hint="One per line">
      <Textarea id={`nl-${k}`} rows={3} value={r[k].join("\n")} onChange={(e) => set(k, e.target.value.split("\n").filter((x, i, a) => x.trim() || i < a.length - 1).slice(0, 8))} />
    </Field>
  );

  return (
    <div className="space-y-5" data-testid="notes-review">
      <Notice tone={r.missingInfo.length ? "warn" : "good"}>
        <b>Review before anything is saved.</b> {aiMode === "mock" ? "Extracted with the built-in parser (AI not configured). " : ""}
        {r.missingInfo.length ? `Missing from the notes: ${r.missingInfo.join(", ")}.` : "Everything we need was in the notes."}
      </Notice>
      <Card className="p-5">
        <h2 className="mb-3 font-display text-xl">Investor</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" htmlFor="nr-name" error={err("investorName")}><Input id="nr-name" value={r.investorName} onChange={(e) => set("investorName", e.target.value)} /></Field>
          <Field label="Email" htmlFor="nr-email" error={err("investorEmail")}><Input id="nr-email" type="email" value={r.investorEmail} onChange={(e) => set("investorEmail", e.target.value)} /></Field>
          <Field label="Phone" htmlFor="nr-phone"><Input id="nr-phone" value={r.investorPhone} onChange={(e) => set("investorPhone", e.target.value)} /></Field>
          <Field label="Experience" htmlFor="nr-exp"><Input id="nr-exp" value={r.experience} onChange={(e) => set("experience", e.target.value)} /></Field>
          <Field label="Vesting" htmlFor="nr-entity"><Select id="nr-entity" value={r.entity} onChange={(e) => set("entity", e.target.value as NotesReviewDraft["entity"])}><option value="">Not discussed</option><option value="LLC">LLC</option><option value="PERSONAL">Personal name</option></Select></Field>
          <Field label="Timeline" htmlFor="nr-timeline"><Input id="nr-timeline" value={r.timeline} onChange={(e) => set("timeline", e.target.value)} /></Field>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 font-display text-xl">Deal</h2>
        <div className="mb-3 flex gap-1 rounded-xl bg-paper p-1 text-sm">
          {(["PURCHASE", "RATE_TERM", "CASH_OUT"] as const).map((m) => <button key={m} type="button" aria-pressed={r.mode === m} onClick={() => set("mode", m)} className={cx("flex-1 rounded-lg px-3 py-2 font-medium", r.mode === m ? "bg-surface shadow-sm" : "text-muted")}>{t.mode[m]}</button>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Property address" htmlFor="nr-address" error={err("propertyAddress")}><Input id="nr-address" value={r.propertyAddress} onChange={(e) => { set("propertyAddress", e.target.value); const s = normalizeAddress(e.target.value).state; if (s) set("state", s); }} /></Field>
          <Field label="State" htmlFor="nr-state" error={err("state")}><Select id="nr-state" value={r.state} onChange={(e) => set("state", e.target.value)}><option value="">…</option>{US_STATES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Property type" htmlFor="nr-type"><Select id="nr-type" value={r.propertyType} onChange={(e) => set("propertyType", e.target.value)}>{PROPERTY_TYPES.map((p) => <option key={p} value={p}>{t.propertyType[p]}</option>)}</Select></Field>
          <Field label={purchase ? "Purchase price" : "Estimated value"} htmlFor="nr-value" error={err("valueCents")}><MoneyInput id="nr-value" value={r.valueCents} onChange={(v) => set("valueCents", v)} /></Field>
          {purchase ? (
            <Field label="Down payment %" htmlFor="nr-down"><Input id="nr-down" inputMode="decimal" value={r.downPaymentPercent ?? ""} onChange={(e) => set("downPaymentPercent", e.target.value ? Number(e.target.value) : null)} placeholder="25" /></Field>
          ) : (
            <Field label="Current loan payoff" htmlFor="nr-balance"><MoneyInput id="nr-balance" value={r.currentBalanceCents} onChange={(v) => set("currentBalanceCents", v)} /></Field>
          )}
          <Field label="Monthly rent" htmlFor="nr-rent" error={err("rentCents")}><MoneyInput id="nr-rent" value={r.rentCents} onChange={(v) => set("rentCents", v)} suffix="/mo" /></Field>
          <Field label="Taxes per month" htmlFor="nr-taxes" hint="Blank: state average"><MoneyInput id="nr-taxes" value={r.taxesMonthlyCents} onChange={(v) => set("taxesMonthlyCents", v)} /></Field>
          <Field label="Insurance per month" htmlFor="nr-ins" hint="Blank: state average"><MoneyInput id="nr-ins" value={r.insuranceMonthlyCents} onChange={(v) => set("insuranceMonthlyCents", v)} /></Field>
          <Field label="Credit score" htmlFor="nr-fico"><Input id="nr-fico" inputMode="numeric" value={r.ficoScore ?? ""} onChange={(e) => set("ficoScore", e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null)} placeholder="Not stated" /></Field>
          <Field label="Interest-only" htmlFor="nr-io"><Select id="nr-io" value={r.wantsInterestOnly == null ? "" : r.wantsInterestOnly ? "yes" : "no"} onChange={(e) => set("wantsInterestOnly", e.target.value === "" ? null : e.target.value === "yes")}><option value="">Not discussed</option><option value="yes">Interested</option><option value="no">Prefers amortizing</option></Select></Field>
          <Field label="Prepay preference" htmlFor="nr-prepay"><Select id="nr-prepay" value={r.prepayPreference} onChange={(e) => set("prepayPreference", e.target.value as NotesReviewDraft["prepayPreference"])}><option value="">Not discussed</option><option value="5-4-3-2-1">5-4-3-2-1</option><option value="3-2-1">3-2-1</option><option value="NONE">No prepay</option></Select></Field>
          <Field label="Use" htmlFor="nr-use"><Select id="nr-use" value={r.use} onChange={(e) => set("use", e.target.value as "LTR" | "STR")}><option value="LTR">Long-term rental</option><option value="STR">Short-term rental</option></Select></Field>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 font-display text-xl">Conversation</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Summary" htmlFor="nr-summary"><Textarea id="nr-summary" rows={3} value={r.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
          <List k="goals" label="Goals" />
          <List k="objections" label="Concerns" />
          <List k="nextSteps" label="Next steps" />
        </div>
      </Card>
      <label className="flex items-start gap-2 text-sm text-ink-2">
        <input type="checkbox" className="mt-1" checked={saveText} onChange={(e) => setSaveText(e.target.checked)} />
        <span>Keep the pasted text with this record (off by default; you can delete it later).</span>
      </label>
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button variant="accent" size="lg" onClick={confirm} disabled={pending}>{pending ? "Building the scenario…" : "Create scenario, checklist and follow-up"}</Button>
        <Button variant="ghost" onClick={() => setReview(null)} disabled={pending}>Back to the notes</Button>
      </div>
    </div>
  );
}
