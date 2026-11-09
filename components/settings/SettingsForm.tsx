"use client";

import { useActionState, useState } from "react";
import type { Broker } from "@prisma/client";
import { saveSettings, type SettingsState } from "@/lib/actions/settings";
import { FICO_RANGES, type FicoLtvCap } from "@/lib/dscr";
import { Button, Card, CardHeader, Field, Input, Notice, Textarea } from "@/components/ui";
import { BrokerAvatar } from "@/components/brand/BrokerAvatar";

export function SettingsForm({ broker, caps, seasoning }: { broker: Broker; caps: FicoLtvCap[]; seasoning: number[] }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  const e = state.fieldErrors ?? {};
  const [color, setColor] = useState(broker.accentColor);
  const [logo, setLogo] = useState(broker.logoUrl ?? "");
  const [logoErr, setLogoErr] = useState<string | null>(null);

  function onLogo(f: File | undefined) {
    setLogoErr(null);
    if (!f) return;
    if (!/image\/(png|jpeg|svg\+xml)/.test(f.type)) return setLogoErr("Use a PNG, JPG or SVG file.");
    if (f.size > 256 * 1024) return setLogoErr("Logo must be under 256 KB.");
    const r = new FileReader();
    r.onload = () => setLogo(String(r.result));
    r.readAsDataURL(f);
  }

  const capFor = (range: string) => Math.round((caps.find((c) => c.range === range)?.maxLtv ?? 0) * 100);

  return (
    <form action={action} className="space-y-6" style={{ "--accent": color } as React.CSSProperties}>
      <Card>
        <CardHeader title="Branding" subtitle="Shown on every public page, PDF and email." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <BrokerAvatar broker={{ logoUrl: logo || null, companyName: broker.companyName, accentColor: color }} size={64} />
            <div className="space-y-1">
              <input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={(ev) => onLogo(ev.target.files?.[0])} className="block text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-black/5 file:px-3 file:py-2" aria-label="Upload logo" />
              <p className="text-xs text-muted">PNG/JPG appear on PDFs too (SVG shows on web; PDFs use a monogram). Max 256 KB.</p>
              {logo && <button type="button" onClick={() => setLogo("")} className="text-xs text-bad">Remove logo</button>}
              {(logoErr || e.logoUrl) && <p className="text-xs text-bad">{logoErr ?? e.logoUrl}</p>}
            </div>
            <input type="hidden" name="logoUrl" value={logo} />
          </div>
          <Field label="Accent color" error={e.accentColor}>
            <div className="flex gap-2">
              <input type="color" value={color} onChange={(ev) => setColor(ev.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-white p-1" aria-label="Pick accent color" />
              <Input name="accentColor" value={color} onChange={(ev) => setColor(ev.target.value)} />
            </div>
          </Field>
          <div className="flex items-end"><span className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-on-accent">Button preview</span></div>
          <Field label="Your name" error={e.name}><Input name="name" defaultValue={broker.name} /></Field>
          <Field label="Title" error={e.title}><Input name="title" defaultValue={broker.title} /></Field>
          <Field label="Company name" error={e.companyName}><Input name="companyName" defaultValue={broker.companyName} /></Field>
          <Field label="Licensed states" hint="e.g. TX, FL, GA"><Input name="licensedStates" defaultValue={broker.licensedStates ?? ""} /></Field>
          <Field label="Individual NMLS ID" error={e.nmlsId}><Input name="nmlsId" defaultValue={broker.nmlsId} /></Field>
          <Field label="Company NMLS ID" error={e.companyNmlsId}><Input name="companyNmlsId" defaultValue={broker.companyNmlsId ?? ""} /></Field>
          <Field label="Public email" error={e.email}><Input name="email" type="email" defaultValue={broker.email} /></Field>
          <Field label="Phone"><Input name="phone" defaultValue={broker.phone ?? ""} /></Field>
          <div className="sm:col-span-2"><Field label="Website" error={e.website}><Input name="website" defaultValue={broker.website ?? ""} placeholder="https://" /></Field></div>
          <div className="sm:col-span-2"><Field label="Disclaimer (shown on every public page, PDF and email)" error={e.disclaimerText}><Textarea name="disclaimerText" rows={4} defaultValue={broker.disclaimerText} /></Field></div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Notifications & AI tone" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Notification email" hint="Lead alerts, scenario opens, digests" error={e.notificationEmail}><Input name="notificationEmail" type="email" defaultValue={broker.notificationEmail} /></Field>
          <Field label="Webhook URL (your CRM, Zapier, Make…)" hint="JSON POST, signed with your secret" error={e.webhookUrl}><Input name="webhookUrl" defaultValue={broker.webhookUrl ?? ""} placeholder="https://hooks.zapier.com/..." /></Field>
          <div className="sm:col-span-2"><Field label="Message tone for AI drafts" error={e.messageTone}><Textarea name="messageTone" rows={2} defaultValue={broker.messageTone} /></Field></div>
        </div>
      </Card>

      <Card>
        <CardHeader title="DSCR defaults" subtitle="Used by the Instant Check, snapshots and scenarios." />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Minimum DSCR" error={e.minDscr}><Input name="minDscr" type="number" step="0.01" defaultValue={broker.minDscr} /></Field>
          <Field label="Max LTV %" error={e.maxLtv}><Input name="maxLtv" type="number" step="1" defaultValue={Math.round(broker.maxLtv * 100)} /></Field>
          <Field label="Default rate %" error={e.defaultRate}><Input name="defaultRate" type="number" step="0.125" defaultValue={broker.defaultRate} /></Field>
          <Field label="Taxes, % of price per year" error={e.taxRatePct}><Input name="taxRatePct" type="number" step="0.05" defaultValue={broker.taxRatePct} /></Field>
          <Field label="Insurance, % of price per year" error={e.insuranceRatePct}><Input name="insuranceRatePct" type="number" step="0.05" defaultValue={broker.insuranceRatePct} /></Field>
          <Field label="Borderline band (DSCR)" hint="How far below the minimum is still Borderline" error={e.borderlineBand}><Input name="borderlineBand" type="number" step="0.01" defaultValue={broker.borderlineBand} /></Field>
        </div>
        <div className="border-t border-line p-5">
          <div className="mb-2 text-sm font-medium text-ink-2">Max LTV % by credit range (0 = not eligible)</div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {FICO_RANGES.map((r) => (
              <label key={r} className="block text-xs text-muted">{r}<Input name={`cap_${r}`} type="number" step="1" min={0} max={90} defaultValue={capFor(r)} className="mt-1 h-9" /></label>
            ))}
          </div>
        </div>
      </Card>

      <Card id="money-list">
        <CardHeader title="Money List rules" />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Rate drop threshold (points)" error={e.rateDropThreshold}><Input name="rateDropThreshold" type="number" step="0.125" defaultValue={broker.rateDropThreshold} /></Field>
          <Field label="Prepay ending within (days)" error={e.prepayWindowDays}><Input name="prepayWindowDays" type="number" defaultValue={broker.prepayWindowDays} /></Field>
          <Field label="Cash-out seasoning (months)" error={e.seasoningMonths}><Input name="seasoningMonths" defaultValue={seasoning.join(", ")} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" name="digestEnabled" defaultChecked={broker.digestEnabled} className="h-4 w-4 accent-[var(--accent)]" /> Email me a monthly Money List digest</label>
        </div>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        {state.ok && <span className="text-sm text-good">Saved ✓</span>}
        {Object.keys(e).length > 0 && <span className="text-sm text-bad">Please fix the highlighted fields.</span>}
        {state.error && <Notice tone="bad">{state.error}</Notice>}
        <Button disabled={pending}>{pending ? "Saving…" : "Save settings"}</Button>
      </div>
    </form>
  );
}
