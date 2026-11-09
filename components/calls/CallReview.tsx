"use client";

import { useState, useTransition } from "react";
import type { CallExtraction } from "@/lib/providers/ai";
import { convertCall, saveReview } from "@/lib/actions/calls";
import { FICO_RANGES } from "@/lib/dscr";
import { Badge, Button, Card, CardHeader, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { MoneyInput } from "@/components/public/MoneyInput";

const lines = (a: string[]) => a.join("\n");
const toList = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

export function CallReview({ callId, initial, converted }: { callId: string; initial: CallExtraction; converted: boolean }) {
  const [x, setX] = useState<CallExtraction>(initial);
  const [lists, setLists] = useState({ goals: lines(initial.goals), objections: lines(initial.objections), nextSteps: lines(initial.nextSteps), missingInfo: lines(initial.missingInfo) });
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const inv = <K extends keyof CallExtraction["investor"]>(k: K, v: CallExtraction["investor"][K]) => setX((p) => ({ ...p, investor: { ...p.investor, [k]: v } }));
  const deal = <K extends keyof CallExtraction["deal"]>(k: K, v: CallExtraction["deal"][K]) => setX((p) => ({ ...p, deal: { ...p.deal, [k]: v } }));
  const full = (): CallExtraction => ({ ...x, goals: toList(lists.goals), objections: toList(lists.objections), nextSteps: toList(lists.nextSteps), missingInfo: toList(lists.missingInfo) });
  const d = x.deal;

  return (
    <div className="space-y-6">
      <Notice tone="accent"><strong>Summary:</strong> {x.summary}</Notice>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Investor" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Name"><Input value={x.investor.name ?? ""} onChange={(e) => inv("name", e.target.value || null)} /></Field>
            <Field label="Email"><Input value={x.investor.email ?? ""} onChange={(e) => inv("email", e.target.value || null)} /></Field>
            <Field label="Phone"><Input value={x.investor.phone ?? ""} onChange={(e) => inv("phone", e.target.value || null)} /></Field>
            <Field label="Experience"><Input value={x.investor.experience ?? ""} onChange={(e) => inv("experience", e.target.value || null)} /></Field>
          </div>
        </Card>
        <Card>
          <CardHeader title="Deal parameters" action={x.missingInfo.length ? <Badge tone="warn">{x.missingInfo.length} missing</Badge> : <Badge tone="good">Complete</Badge>} />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Property address"><Input value={d.propertyAddress ?? ""} onChange={(e) => deal("propertyAddress", e.target.value || null)} /></Field></div>
            <Field label="Loan purpose">
              <Select value={d.loanPurpose ?? ""} onChange={(e) => deal("loanPurpose", (e.target.value || null) as CallExtraction["deal"]["loanPurpose"])}>
                <option value="">Unknown</option><option value="PURCHASE">Purchase</option><option value="RATE_TERM">Rate & term</option><option value="CASH_OUT">Cash-out</option>
              </Select>
            </Field>
            <Field label="Price / value"><MoneyInput value={d.purchasePrice} onChange={(v) => deal("purchasePrice", v)} /></Field>
            <Field label="Down payment %" hint="Purchase only"><Input type="number" min={0} max={100} value={d.downPaymentPct != null ? Math.round(d.downPaymentPct * 100) : ""} onChange={(e) => deal("downPaymentPct", e.target.value === "" ? null : Number(e.target.value) / 100)} /></Field>
            <Field label="Loan amount (if stated)"><MoneyInput value={d.loanAmount} onChange={(v) => deal("loanAmount", v)} /></Field>
            <Field label="Monthly rent"><MoneyInput value={d.monthlyRent} onChange={(v) => deal("monthlyRent", v)} suffix="/mo" /></Field>
            <Field label="Credit range">
              <Select value={d.ficoRange ?? ""} onChange={(e) => deal("ficoRange", (e.target.value || null) as CallExtraction["deal"]["ficoRange"])}>
                <option value="">Unknown</option>{FICO_RANGES.map((r) => <option key={r}>{r}</option>)}
              </Select>
            </Field>
            <Field label="Taxes / month"><MoneyInput value={d.taxesMonthly} onChange={(v) => deal("taxesMonthly", v)} /></Field>
            <Field label="Insurance / month"><MoneyInput value={d.insuranceMonthly} onChange={(v) => deal("insuranceMonthly", v)} /></Field>
            <Field label="Prepay preference">
              <Select value={d.prepayPreference ?? ""} onChange={(e) => deal("prepayPreference", (e.target.value || null) as CallExtraction["deal"]["prepayPreference"])}>
                <option value="">No preference</option><option value="5-4-3-2-1">5-4-3-2-1</option><option value="3-2-1">3-2-1</option><option value="NONE">None</option>
              </Select>
            </Field>
            <Field label="Interest-only?">
              <Select value={d.wantsInterestOnly == null ? "" : String(d.wantsInterestOnly)} onChange={(e) => deal("wantsInterestOnly", e.target.value === "" ? null : e.target.value === "true")}>
                <option value="">Not discussed</option><option value="true">Interested</option><option value="false">Not interested</option>
              </Select>
            </Field>
            <Field label="Property type"><Input value={d.propertyType ?? ""} onChange={(e) => deal("propertyType", e.target.value || null)} /></Field>
          </div>
        </Card>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {([["goals", "Investor goals"], ["objections", "Objections & concerns"], ["nextSteps", "Next steps"], ["missingInfo", "Still missing"]] as const).map(([k, label]) => (
          <Card key={k}>
            <CardHeader title={label} subtitle="One per line" />
            <div className="p-4"><Textarea rows={4} value={lists[k]} onChange={(e) => setLists((p) => ({ ...p, [k]: e.target.value }))} aria-label={label} /></div>
          </Card>
        ))}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Button variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await saveReview(callId, full()); setMsg(r.ok ? { tone: "good", text: "Review saved." } : { tone: "bad", text: r.error! }); })}>Save review</Button>
        <Button variant="accent" disabled={pending} onClick={() => start(async () => { const r = await convertCall(callId, full()); if (r?.error) setMsg({ tone: "bad", text: r.error }); })}>
          {pending ? "Working…" : converted ? "Create another draft scenario" : "Create draft scenario + checklist + email"}
        </Button>
      </div>
    </div>
  );
}
