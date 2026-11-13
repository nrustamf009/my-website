"use client";

import { useActionState, useState, useTransition } from "react";
import type { Broker, User } from "@prisma/client";
import { saveBranding, saveLicensing, saveNotifications, saveProgram, saveWebhook, sendTestNotification, sendTestWebhook, type SettingsState } from "@/lib/actions/settings";
import { checkAccent, getThemeDefinition } from "@design";
import { US_STATES, STATE_NAMES, type ProgramGrid } from "@/lib/dscr";
import { dscr, pct, rate, usd } from "@/lib/format";
import { Button, Card, CardHeader, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";

type Action = (p: SettingsState, fd: FormData) => Promise<SettingsState>;

function useForm(action: Action) {
  return useActionState<SettingsState, FormData>(action, {});
}

function Bar({ pending, step, state, label = "Save" }: { pending: boolean; step?: number; state: SettingsState; label?: string }) {
  const errs = state.fieldErrors && Object.keys(state.fieldErrors).length;
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line px-5 py-4">
      {state.ok && !step && <span className="text-sm text-good">Saved ✓</span>}
      {errs ? <span className="text-sm text-bad">Please fix the highlighted fields.</span> : null}
      {state.error && <span className="text-sm text-bad">{state.error}</span>}
      {step ? <input type="hidden" name="_step" value={step} /> : null}
      <Button disabled={pending} size={step ? "lg" : "md"}>{pending ? "Saving…" : step ? (step >= 6 ? "Finish setup" : "Save and continue →") : label}</Button>
    </div>
  );
}

/** Image input that downsizes in the browser and stores a data URL (no storage service needed). */
export function ImageInput({ name, initial, max = 400, label, round = false }: { name: string; initial: string | null; max?: number; label: string; round?: boolean }) {
  const [value, setValue] = useState(initial ?? "");
  const [err, setErr] = useState<string | null>(null);
  async function onFile(f: File | undefined) {
    setErr(null);
    if (!f) return;
    if (!/image\/(png|jpeg|svg\+xml)/.test(f.type)) return setErr("Use a PNG, JPG or SVG.");
    if (f.type === "image/svg+xml") {
      if (f.size > 200_000) return setErr("SVG must be under 200 KB.");
      const r = new FileReader();
      r.onload = () => setValue(String(r.result));
      return r.readAsDataURL(f);
    }
    const img = new Image();
    img.src = URL.createObjectURL(f);
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    setValue(c.toDataURL(f.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
  }
  return (
    <div className="flex items-center gap-4">
      <div className={cx("grid h-16 w-16 shrink-0 place-items-center overflow-hidden border border-line bg-surface", round ? "rounded-full" : "rounded-xl")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className="h-full w-full object-contain" /> : <span className="text-xs text-muted">None</span>}
      </div>
      <div className="space-y-1 text-sm">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-line bg-surface px-3 py-1.5 font-medium hover:bg-paper">
          {label}
          <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {value && <button type="button" onClick={() => setValue("")} className="ml-2 text-xs text-bad">Remove</button>}
        {err && <p className="text-xs text-bad">{err}</p>}
        <input type="hidden" name={name} value={value} />
      </div>
    </div>
  );
}

export function BrandingForm({ broker, step }: { broker: Broker; step?: number }) {
  const [state, action, pending] = useForm(saveBranding);
  const [color, setColor] = useState(broker.accentColor);
  const e = state.fieldErrors ?? {};
  const valid = /^#[0-9a-f]{6}$/i.test(color);
  const def = getThemeDefinition(broker.theme);
  const p = checkAccent(def.id, valid ? color : def.defaultAccent);
  return (
    <form action={action}>
      <Card>
        <CardHeader title="Branding" subtitle="Used on every public page, PDF and email. Keep the accent for buttons and highlights; we handle accessible text colors." />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><ImageInput name="logoUrl" initial={broker.logoUrl} label="Upload logo" /></div>
          <Field label="Company name" error={e.companyName}><Input name="companyName" defaultValue={broker.companyName} /></Field>
          <Field label="Accent color" error={e.accentColor} hint={valid ? (p.ok ? `Text on accent ${p.ratios.onAccent}:1 · accent text on page ${p.ratios.accentTextOnBg}:1${p.accentText !== p.accent ? ` (text uses ${p.accentText})` : ""}` : p.reason) : undefined}>
            <div className="flex gap-2">
              <input type="color" value={valid ? color : def.defaultAccent} onChange={(ev) => setColor(ev.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1" aria-label="Pick accent color" />
              <Input name="accentColor" value={color} onChange={(ev) => setColor(ev.target.value)} />
            </div>
          </Field>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2" aria-hidden>
            <span className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: p.accent, color: p.onAccent }}>Button</span>
            <span className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: p.accentTint, color: p.accentText }}>Badge</span>
            <span className="text-sm font-semibold underline" style={{ color: p.accentText }}>Link text</span>
            {def.presets.map((c) => <button key={c} type="button" aria-label={`Use preset ${c}`} onClick={() => setColor(c)} className="h-6 w-6 rounded border border-line" style={{ background: c }} />)}
          </div>
          <Field label="Public email" error={e.email}><Input name="email" type="email" defaultValue={broker.email} /></Field>
          <Field label="Main phone" error={e.phone}><Input name="phone" defaultValue={broker.phone ?? ""} /></Field>
          <Field label="Website" error={e.websiteUrl}><Input name="websiteUrl" defaultValue={broker.websiteUrl ?? ""} placeholder="https://" /></Field>
          <Field label="Privacy policy URL" hint="Linked from every consent checkbox" error={e.privacyPolicyUrl}><Input name="privacyPolicyUrl" defaultValue={broker.privacyPolicyUrl ?? ""} placeholder="https://" /></Field>
        </div>
        <Bar pending={pending} step={step} state={state} />
      </Card>
    </form>
  );
}

export function LicensingForm({ broker, user, states, step }: { broker: Broker; user: User | null; states: string[]; step?: number }) {
  const [state, action, pending] = useForm(saveLicensing);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action}>
      <Card>
        <CardHeader title="NMLS & licensing" subtitle="Public pages show your individual NMLS, the company NMLS and licensed states." />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <Field label="Company NMLS ID" error={e.companyNmlsId}><Input name="companyNmlsId" defaultValue={broker.companyNmlsId} inputMode="numeric" /></Field>
          <Field label="Your individual NMLS ID" error={e.nmlsId}><Input name="nmlsId" defaultValue={user?.nmlsId ?? ""} inputMode="numeric" /></Field>
          <Field label="Your title"><Input name="title" defaultValue={user?.title ?? "Loan Officer"} /></Field>
          <Field label="Your direct phone"><Input name="loPhone" defaultValue={user?.phone ?? ""} /></Field>
          <div className="sm:col-span-2"><ImageInput name="headshotUrl" initial={user?.headshotUrl ?? null} label="Upload headshot (optional)" round /></div>
          <div className="sm:col-span-2">
            <div className="mb-1.5 text-sm font-medium text-ink-2">Licensed states</div>
            {e.states && <p className="mb-2 text-xs text-bad">{e.states}</p>}
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5 sm:grid-cols-6">
              {US_STATES.map((s) => (
                <label key={s} className="flex items-center gap-1.5 text-sm" title={STATE_NAMES[s]}>
                  <input type="checkbox" name="states" value={s} defaultChecked={states.includes(s)} className="h-4 w-4 accent-[var(--accent)]" />{s}
                </label>
              ))}
            </div>
          </div>
        </div>
        <Bar pending={pending} step={step} state={state} />
      </Card>
    </form>
  );
}

export function ProgramForm({ grid, step, full = false }: { grid: ProgramGrid; step?: number; full?: boolean }) {
  const [state, action, pending] = useForm(saveProgram);
  const e = state.fieldErrors ?? {};
  const decimal = (r: number) => dscr(r);
  const pctNum = (r: number | null) => (r == null ? "" : pct(r).replace("%", ""));
  const rateNum = (m: number) => rate(m).replace("%", "");
  return (
    <form action={action}>
      <Card>
        <CardHeader title="Program defaults" subtitle="Your starting assumptions for every estimate. Investors see “estimate” framing, never an offer." />
        <div className="grid gap-5 p-5 sm:grid-cols-3">
          <Field label="Base rate (%)" hint="Update when pricing moves" error={e.baseRate}><Input name="baseRate" defaultValue={rateNum(grid.baseRateMilli)} inputMode="decimal" /></Field>
          <Field label="Minimum DSCR" error={e.minDscr}><Input name="minDscr" defaultValue={decimal(grid.minDscrRatio)} inputMode="decimal" /></Field>
          <Field label="“Looks strong” at DSCR" error={e.strongDscr}><Input name="strongDscr" defaultValue={decimal(grid.strongDscrRatio)} inputMode="decimal" /></Field>
          <Field label="FICO floor" error={e.ficoFloor}><Input name="ficoFloor" defaultValue={grid.ficoFloor} inputMode="numeric" /></Field>
          <Field label="Reserves (months PITIA)" error={e.reservesMonths}><Input name="reservesMonths" defaultValue={grid.reservesMonths} inputMode="numeric" /></Field>
          <Field label="Buydown: rate drop per point (%)"><Input name="buydown" defaultValue={rateNum(grid.buydownMilliPerPoint)} inputMode="decimal" /></Field>
          <Field label="Min loan" error={e.minLoan}><Input name="minLoan" defaultValue={usd(grid.minLoanCents)} /></Field>
          <Field label="Max loan"><Input name="maxLoan" defaultValue={usd(grid.maxLoanCents)} /></Field>
          <Field label="Closing costs: purchase / refi (%)">
            <div className="flex gap-2"><Input name="closingPurchase" defaultValue={pctNum(grid.closingCostRatio.purchase)} aria-label="Purchase closing %" /><Input name="closingRefi" defaultValue={pctNum(grid.closingCostRatio.refi)} aria-label="Refi closing %" /></div>
          </Field>
          {!full && (
            <>
              <Field label="Max LTV, purchase (top credit tier, %)"><Input name="ltvPurchase" defaultValue={pctNum(grid.maxLtvRatio.PURCHASE["740+"][">=1.20"])} /></Field>
              <Field label="Max LTV, cash-out (top tier, %)" hint="Lower credit tiers step down 5 points each"><Input name="ltvCashOut" defaultValue={pctNum(grid.maxLtvRatio.CASH_OUT["740+"][">=1.20"])} /></Field>
            </>
          )}
          <label className="flex items-center gap-2 self-end pb-3 text-sm sm:col-span-3">
            <input type="checkbox" name="subOneDscrEnabled" defaultChecked={grid.subOneDscrEnabled} className="h-4 w-4 accent-[var(--accent)]" />
            I offer sub-1.0 DSCR programs (DSCR 0.75–0.99, max 70% LTV)
          </label>
        </div>
        {full && <FullGrid grid={grid} />}
        <Bar pending={pending} step={step} state={state} />
      </Card>
    </form>
  );
}

function FullGrid({ grid }: { grid: ProgramGrid }) {
  const modes = ["PURCHASE", "RATE_TERM", "CASH_OUT"] as const;
  const ficos = ["740+", "700-739", "680-699", "660-679", "<660"] as const;
  const dscrs = [">=1.20", "1.00-1.19", "0.75-0.99", "<0.75"] as const;
  const p = (r: number | null) => (r == null ? "" : pct(r).replace("%", ""));
  const signed = (m: number) => (m < 0 ? `-${rate(-m).replace("%", "")}` : rate(m).replace("%", ""));
  const adjRow = (title: string, prefix: string, entries: [string, number][]) => (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">{title}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {entries.map(([k, v]) => (
          <label key={k} className="text-xs text-ink-2">{k}<Input name={`${prefix}${k}`} defaultValue={signed(v)} className="mt-1 h-9" /></label>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-6 border-t border-line p-5">
      <p className="text-sm text-muted">Max LTV (%) by credit tier × DSCR tier. Leave blank or 0 for “not eligible”.</p>
      {modes.map((m) => (
        <div key={m} className="overflow-x-auto">
          <div className="mb-1 text-sm font-semibold">{m === "PURCHASE" ? "Purchase" : m === "RATE_TERM" ? "Rate & term" : "Cash-out"}</div>
          <table className="text-sm">
            <thead><tr><th className="px-2 text-left text-xs text-muted">FICO \ DSCR</th>{dscrs.map((d) => <th key={d} className="px-2 text-xs text-muted">{d}</th>)}</tr></thead>
            <tbody>
              {ficos.map((f) => (
                <tr key={f}><td className="px-2 text-xs font-medium">{f}</td>{dscrs.map((d) => <td key={d} className="px-1 py-0.5"><Input name={`ltv_${m}_${f}_${d}`} defaultValue={p(grid.maxLtvRatio[m][f][d])} className="h-8 w-20 text-center" aria-label={`${m} ${f} ${d}`} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <p className="text-sm text-muted">Rate adjustments (percentage points added to the base rate; negative lowers it).</p>
      {adjRow("By credit tier", "adj_fico_", Object.entries(grid.rateAdjMilli.fico))}
      {adjRow("By DSCR tier", "adj_dscr_", Object.entries(grid.rateAdjMilli.dscr))}
      {adjRow("By product", "adj_product_", Object.entries(grid.rateAdjMilli.product))}
      {adjRow("By prepayment penalty", "adj_prepay_", Object.entries(grid.rateAdjMilli.prepay))}
      {adjRow("By loan purpose", "adj_mode_", Object.entries(grid.rateAdjMilli.mode))}
    </div>
  );
}

function TestButton({ run, label }: { run: () => Promise<SettingsState>; label: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await run(); setMsg({ ok: !!r.ok, text: r.message ?? r.error ?? "" }); })}>{pending ? "Sending…" : label}</Button>
      {msg && <span className={cx("text-xs", msg.ok ? "text-good" : "text-bad")} role="status">{msg.text}</span>}
    </span>
  );
}

export function NotificationsForm({ broker, emails, step }: { broker: Broker; emails: string[]; step?: number }) {
  const [state, action, pending] = useForm(saveNotifications);
  const [tone, setTone] = useState(broker.tonePreset);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action}>
      <Card>
        <CardHeader title="Notifications & message tone" subtitle="Who gets lead alerts, scenario-open alerts, digests and the weekly ROI report." />
        <div className="grid gap-5 p-5">
          <Field label="Notification emails (comma-separated)" error={e.notificationEmails}><Input name="notificationEmails" defaultValue={emails.join(", ")} /></Field>
          <div><TestButton run={sendTestNotification} label="Send test email" /></div>
          <Field label="Tone for AI-drafted messages" error={e.tonePreset}>
            <Select name="tonePreset" value={tone} onChange={(ev) => setTone(ev.target.value)}>
              <option value="FRIENDLY">Friendly: warm, conversational</option>
              <option value="DIRECT">Direct: numbers-first, no fluff</option>
              <option value="CONSULTATIVE">Consultative: calm, educational</option>
              <option value="CUSTOM">Custom…</option>
            </Select>
          </Field>
          {tone === "CUSTOM" && <Field label="Describe your tone"><Textarea name="toneCustom" rows={2} defaultValue={broker.toneCustom ?? ""} /></Field>}
        </div>
        <Bar pending={pending} step={step} state={state} />
      </Card>
    </form>
  );
}

export function WebhookForm({ broker, step }: { broker: Broker; step?: number }) {
  const [state, action, pending] = useForm(saveWebhook);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action}>
      <Card>
        <CardHeader title="Connect your CRM (webhook)" subtitle="Every lead, scenario open and option pick is POSTed as signed JSON. Works with Zapier, Make, n8n or a direct endpoint. Optional." />
        <div className="grid gap-4 p-5">
          <Field label="Webhook URL" error={e.webhookUrl}><Input name="webhookUrl" defaultValue={broker.webhookUrl ?? ""} placeholder="https://hooks.zapier.com/hooks/catch/…" /></Field>
          <div><TestButton run={sendTestWebhook} label="Send test event" /></div>
          <p className="text-xs text-muted">Signing secret: <code className="rounded bg-ink/5 px-1">{broker.webhookSecret.slice(0, 12)}…</code> (full secret and delivery log in Settings → Integrations). Verify with HMAC-SHA256 of the raw body against the <code>X-DSCR-Signature</code> header.</p>
        </div>
        <Bar pending={pending} step={step} state={state} label="Save webhook" />
      </Card>
    </form>
  );
}
