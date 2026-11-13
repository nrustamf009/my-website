"use client";

import { useActionState, useState, useTransition } from "react";
import { createSnapshot, emailRealtorStats, saveRealtor, setSnapshotTemplate, type FormState } from "@/lib/actions/snapshots";
import { normalizeAddress } from "@/lib/providers/address";
import { PROPERTY_TYPES, US_STATES } from "@/lib/dscr";
import { t } from "@/lib/strings/en";
import { Button, Field, Input, Notice, Select, cx } from "@/components/ui";
import { ImageInput } from "@/components/settings/forms";

export interface RealtorOption {
  id: string;
  name: string;
  brokerage: string;
}

export function SnapshotForm({ realtors, defaultRealtorId }: { realtors: RealtorOption[]; defaultRealtorId?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSnapshot, {});
  const [address, setAddress] = useState("");
  const [st, setSt] = useState("");
  const [realtorId, setRealtorId] = useState(defaultRealtorId ?? realtors[0]?.id ?? "");
  const [template, setTemplate] = useState<"CLASSIC" | "MODERN">("CLASSIC");
  const err = (k: string) => state.fieldErrors?.[k];
  return (
    <form action={action} className="space-y-6">
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <section className="space-y-3">
        <h2 className="font-display text-xl">Property</h2>
        <Field label="Property address" htmlFor="address" error={err("address")}>
          <Input id="address" name="address" value={address} placeholder="4410 Bayshore Ct, Tampa, FL 33611" onChange={(e) => { setAddress(e.target.value); const s = normalizeAddress(e.target.value).state; if (s) setSt(s); }} required />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="State" htmlFor="state" error={err("state")}>
            <Select id="state" name="state" value={st} onChange={(e) => setSt(e.target.value)}>
              <option value="">Choose…</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Property type" htmlFor="propertyType">
            <Select id="propertyType" name="propertyType" defaultValue="SFR">
              {PROPERTY_TYPES.map((p) => <option key={p} value={p}>{t.propertyType[p]}</option>)}
            </Select>
          </Field>
          <Field label="List price" htmlFor="listPrice" error={err("listPrice")}><Input id="listPrice" name="listPrice" inputMode="decimal" placeholder="425,000" required /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Monthly rent" htmlFor="rent" hint="Leave blank to estimate" error={err("rent")}><Input id="rent" name="rent" inputMode="decimal" placeholder="Auto" /></Field>
          <Field label="Taxes per year" htmlFor="taxes" hint="Blank: public record or state average" error={err("taxes")}><Input id="taxes" name="taxes" inputMode="decimal" placeholder="Auto" /></Field>
          <Field label="Insurance per year" htmlFor="insurance" hint="Blank: state average" error={err("insurance")}><Input id="insurance" name="insurance" inputMode="decimal" placeholder="Auto" /></Field>
          <Field label="HOA per month" htmlFor="hoa" error={err("hoa")}><Input id="hoa" name="hoa" inputMode="decimal" placeholder="0" /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Rate to quote" htmlFor="rate" hint="Blank: your program grid's best-tier rate" error={err("rate")}><Input id="rate" name="rate" inputMode="decimal" placeholder="Auto" /></Field>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Listing photo (optional)</span>
            <ImageInput name="photoUrl" initial={null} max={1400} label="Upload photo" />
            {err("photoUrl") && <p className="mt-1 text-xs text-bad">{err("photoUrl")}</p>}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Listing agent</h2>
        <Field label="Realtor" htmlFor="realtorId" error={err("realtorId")}>
          <Select id="realtorId" name="realtorId" value={realtorId} onChange={(e) => setRealtorId(e.target.value)}>
            {realtors.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.brokerage}</option>)}
            <option value="">+ Add a new realtor</option>
          </Select>
        </Field>
        {!realtorId && (
          <div className="grid gap-3 rounded-xl border border-line bg-paper/50 p-4 sm:grid-cols-2">
            <Field label="Agent name" htmlFor="newRealtorName" error={err("newRealtorName")}><Input id="newRealtorName" name="newRealtorName" /></Field>
            <Field label="Brokerage" htmlFor="newRealtorBrokerage" error={err("newRealtorBrokerage")}><Input id="newRealtorBrokerage" name="newRealtorBrokerage" /></Field>
            <Field label="Email" htmlFor="newRealtorEmail" error={err("newRealtorEmail")}><Input id="newRealtorEmail" name="newRealtorEmail" type="email" /></Field>
            <Field label="Phone" htmlFor="newRealtorPhone"><Input id="newRealtorPhone" name="newRealtorPhone" type="tel" /></Field>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">Flyer style</h2>
        <input type="hidden" name="template" value={template} />
        <TemplatePicker value={template} onChange={setTemplate} />
      </section>

      <Button variant="accent" size="lg" disabled={pending}>{pending ? "Building the snapshot…" : "Create snapshot"}</Button>
    </form>
  );
}

export function TemplatePicker({ value, onChange }: { value: "CLASSIC" | "MODERN"; onChange: (v: "CLASSIC" | "MODERN") => void }) {
  const opts = [
    { v: "CLASSIC" as const, title: "Classic", body: "Clean one-pager: address, QR, side-by-side table." },
    { v: "MODERN" as const, title: "Modern", body: "Photo-led header with big DSCR cards. Best with a listing photo." },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Flyer template">
      {opts.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={cx("rounded-xl border p-4 text-left transition", value === o.v ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink/30")}>
          <div className="font-medium text-ink">{o.title}</div>
          <div className="text-sm text-muted">{o.body}</div>
        </button>
      ))}
    </div>
  );
}

export function TemplateSwitch({ id, value }: { id: string; value: "CLASSIC" | "MODERN" }) {
  const [v, setV] = useState(value);
  const [, start] = useTransition();
  return <TemplatePicker value={v} onChange={(nv) => { setV(nv); start(async () => { await setSnapshotTemplate(id, nv); }); }} />;
}

export function RealtorForm({ initial }: { initial?: { id: string; name: string; brokerage: string; phone: string | null; email: string | null; headshotUrl: string | null; logoUrl: string | null } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRealtor, {});
  const err = (k: string) => state.fieldErrors?.[k];
  return (
    <form action={action} className="space-y-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {state.ok && <Notice tone="good">Saved.</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Agent name" htmlFor={`rn-${initial?.id ?? "new"}`} error={err("name")}><Input id={`rn-${initial?.id ?? "new"}`} name="name" defaultValue={initial?.name} /></Field>
        <Field label="Brokerage" htmlFor={`rb-${initial?.id ?? "new"}`} error={err("brokerage")}><Input id={`rb-${initial?.id ?? "new"}`} name="brokerage" defaultValue={initial?.brokerage} /></Field>
        <Field label="Email" htmlFor={`re-${initial?.id ?? "new"}`} error={err("email")}><Input id={`re-${initial?.id ?? "new"}`} name="email" type="email" defaultValue={initial?.email ?? ""} /></Field>
        <Field label="Phone" htmlFor={`rp-${initial?.id ?? "new"}`}><Input id={`rp-${initial?.id ?? "new"}`} name="phone" defaultValue={initial?.phone ?? ""} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <ImageInput name="headshotUrl" initial={initial?.headshotUrl ?? null} label="Headshot" round />
        <ImageInput name="logoUrl" initial={initial?.logoUrl ?? null} label="Brokerage logo" />
      </div>
      <Button variant="secondary" disabled={pending}>{pending ? "Saving…" : initial ? "Save realtor" : "Add realtor"}</Button>
    </form>
  );
}

export function EmailStatsButton({ realtorId, disabled }: { realtorId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="secondary" disabled={pending || disabled} title={disabled ? "Add the agent's email first" : undefined} onClick={() => start(async () => { const r = await emailRealtorStats(realtorId); setMsg(r.ok ? "Sent" : (r.error ?? "Failed")); })}>
        {pending ? "Sending…" : "Email stats"}
      </Button>
      {msg && <span className="text-xs text-muted" role="status">{msg}</span>}
    </span>
  );
}
