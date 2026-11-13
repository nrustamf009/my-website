"use client";

import { useActionState, useState } from "react";
import { createBroker, type FormState } from "@/lib/actions/admin";
import { contrast } from "@/lib/brand/palette";
import { Button, Card, CardHeader, Field, Input, Notice } from "@/components/ui";

export function NewBrokerForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createBroker, {});
  const [color, setColor] = useState("#1F4E79");
  const e = state.fieldErrors ?? {};
  const aa = /^#[0-9a-f]{6}$/i.test(color) ? contrast(color, "#ffffff") : 0;
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
          <Field label="Accent color" hint={aa && aa < 4.5 ? `Light color (contrast ${aa.toFixed(1)}:1). Text will use an automatically darkened shade.` : "Passes WCAG AA as text on white."} error={e.accentColor}>
            <div className="flex gap-2">
              <input type="color" value={color} onChange={(ev) => setColor(ev.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-white p-1" aria-label="Pick color" />
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
