"use client";

import { useActionState, useState } from "react";
import type { Broker } from "@prisma/client";
import { createBroker, updateBrokerBasics, type FormState } from "@/lib/actions/admin";
import { Button, Card, Field, Input, Notice } from "@/components/ui";

export function BrokerForm({ broker }: { broker?: Broker }) {
  const action = broker ? updateBrokerBasics.bind(null, broker.id) : createBroker;
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [color, setColor] = useState(broker?.accentColor ?? "#1F4E79");
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction}>
      <Card className="space-y-5 p-6">
        {state.ok && <Notice tone="good">Saved.</Notice>}
        {state.error && <Notice tone="bad">{state.error}</Notice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loan officer name" error={e.name}><Input name="name" defaultValue={broker?.name} required /></Field>
          <Field label="Company name" error={e.companyName}><Input name="companyName" defaultValue={broker?.companyName} required /></Field>
          <Field label="Individual NMLS ID" error={e.nmlsId}><Input name="nmlsId" inputMode="numeric" defaultValue={broker?.nmlsId} required /></Field>
          <Field label="Company NMLS ID (optional)" error={e.companyNmlsId}><Input name="companyNmlsId" inputMode="numeric" defaultValue={broker?.companyNmlsId ?? ""} /></Field>
          <Field label="Public contact email" error={e.email}><Input name="email" type="email" defaultValue={broker?.email} required /></Field>
          <Field label="Phone" error={e.phone}><Input name="phone" defaultValue={broker?.phone ?? ""} placeholder="(555) 010-0000" /></Field>
          <Field label="Accent color" error={e.accentColor}>
            <div className="flex gap-2">
              <input type="color" value={color} onChange={(ev) => setColor(ev.target.value)} className="h-11 w-14 cursor-pointer rounded-lg border border-line bg-white p-1" aria-label="Pick color" />
              <Input name="accentColor" value={color} onChange={(ev) => setColor(ev.target.value)} />
            </div>
          </Field>
          {!broker && <Field label="Public URL slug" hint="Pages live at /b/your-slug" error={e.slug}><Input name="slug" placeholder="auto from company name" /></Field>}
          {!broker && <Field label="Broker login email" error={e.loginEmail}><Input name="loginEmail" type="email" required /></Field>}
          {broker && (
            <label className="flex items-center gap-2 self-end pb-3 text-sm">
              <input type="checkbox" name="active" defaultChecked={broker.active} className="h-4 w-4 accent-[var(--accent)]" /> Active (public pages online)
            </label>
          )}
        </div>
        <div className="flex justify-end"><Button disabled={pending}>{pending ? "Saving…" : broker ? "Save changes" : "Create broker"}</Button></div>
      </Card>
    </form>
  );
}
