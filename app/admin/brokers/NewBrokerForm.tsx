"use client";

import { useActionState, useState } from "react";
import { createBroker, type FormState } from "@/lib/actions/admin";
import { THEMES, checkAccent, themeIds, type ThemeId } from "@design";
import { Button, Card, CardHeader, Field, Input, Notice, Select } from "@/components/ui";

export function NewBrokerForm({ defaultTheme }: { defaultTheme: ThemeId }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBroker, {});
  const [theme, setTheme] = useState<ThemeId>(defaultTheme);
  const [color, setColor] = useState(THEMES[defaultTheme].defaultAccent);
  const e = state.fieldErrors ?? {};
  const check = /^#[0-9a-f]{6}$/i.test(color) ? checkAccent(theme, color) : null;
  return (
    <form action={action} className="space-y-6">
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <Card>
        <CardHeader title="Company" subtitle="You can pre-fill branding; the broker confirms everything in a 10-minute setup wizard." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Company name" error={e.companyName}><Input name="companyName" required /></Field>
          <Field label="Company NMLS ID" error={e.companyNmlsId}><Input name="companyNmlsId" inputMode="numeric" required /></Field>
          <Field label="Public contact email" error={e.email}><Input name="email" type="email" required /></Field>
          <Field label="Phone"><Input name="phone" placeholder="(555) 010-0000" /></Field>
          <Field label="Licensed states" hint="Comma-separated, e.g. TX, FL"><Input name="licensedStates" /></Field>
          <Field label="Public URL slug" hint="Pages live at /b/your-slug" error={e.slug}><Input name="slug" placeholder="auto from company name" /></Field>
          <Field label="Theme" hint={THEMES[theme].tagline}>
            <Select name="theme" value={theme} onChange={(ev) => { const t = ev.target.value as ThemeId; setTheme(t); setColor(THEMES[t].defaultAccent); }}>
              {themeIds.map((t) => <option key={t} value={t}>{THEMES[t].name}</option>)}
            </Select>
          </Field>
          <Field label="Accent color" hint={check ? (check.ok ? `Text on accent ${check.ratios.onAccent}:1 · passes WCAG AA` : check.reason) : undefined} error={e.accentColor}>
            <div className="flex gap-2">
              <input type="color" value={color} onChange={(ev) => setColor(ev.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-surface p-1" aria-label="Pick color" />
              <Input name="accentColor" value={color} onChange={(ev) => setColor(ev.target.value)} />
            </div>
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="First loan officer (broker admin)" subtitle="Gets a welcome email with a magic-link sign-in." />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Name" error={e.loName}><Input name="loName" required /></Field>
          <Field label="Login email" error={e.loEmail}><Input name="loEmail" type="email" required /></Field>
          <Field label="Individual NMLS ID" error={e.loNmlsId}><Input name="loNmlsId" inputMode="numeric" /></Field>
        </div>
      </Card>
      <div className="flex justify-end"><Button size="lg" disabled={pending}>{pending ? "Creating…" : "Create broker and send invite"}</Button></div>
    </form>
  );
}
