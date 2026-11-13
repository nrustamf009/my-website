"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualLead, deleteLeadPersonalData, saveLeadNotes, setLeadOwner, setLeadStatus, type ManualLeadState } from "@/lib/actions/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/leads-meta";
import { Button, Field, Input, Notice, Select, Textarea, cx } from "@/components/ui";

export function StatusPicker({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Lead status" data-testid="status-picker">
      {LEAD_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          disabled={pending}
          onClick={() => { setValue(s); start(async () => { await setLeadStatus(id, s as LeadStatus); router.refresh(); }); }}
          className={cx("rounded-full border px-3 py-1.5 text-sm transition", value === s ? "border-ink bg-ink text-page" : "border-line bg-surface text-ink-2 hover:border-ink/30")}
        >
          {LEAD_STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export function OwnerPicker({ id, owner, users }: { id: string; owner: string | null; users: { id: string; name: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Select aria-label="Owner" defaultValue={owner ?? ""} disabled={pending} onChange={(e) => start(async () => { await setLeadOwner(id, e.target.value); router.refresh(); })}>
      {!owner && <option value="">Unassigned</option>}
      {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
    </Select>
  );
}

export function LeadNotes({ id, initial }: { id: string; initial: string }) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  return (
    <div>
      <Textarea aria-label="Notes" rows={4} value={v} onChange={(e) => { setV(e.target.value); setSaved(false); }} placeholder="What they're looking for, timeline, who else they're talking to…" />
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={pending || v === initial} onClick={() => start(async () => { await saveLeadNotes(id, v); setSaved(true); })}>Save notes</Button>
        {saved && <span className="text-xs text-good">Saved</span>}
      </div>
    </div>
  );
}

export function DeleteLead({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="danger"
      disabled={pending}
      onClick={() => {
        if (confirm(`Permanently delete ${name}'s personal data? This removes the lead and consent records and anonymizes their scenarios. It can't be undone.`)) start(async () => { await deleteLeadPersonalData(id); });
      }}
    >
      {pending ? "Deleting…" : "Delete personal data (CCPA)"}
    </Button>
  );
}

export function ManualLeadForm() {
  const [state, action, pending] = useActionState<ManualLeadState, FormData>(addManualLead, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-3">
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" htmlFor="ml-name" error={e.name}><Input id="ml-name" name="name" required /></Field>
        <Field label="Email" htmlFor="ml-email" error={e.email}><Input id="ml-email" name="email" type="email" required /></Field>
        <Field label="Phone" htmlFor="ml-phone"><Input id="ml-phone" name="phone" type="tel" /></Field>
        <Field label="Property address" htmlFor="ml-address"><Input id="ml-address" name="propertyAddress" /></Field>
      </div>
      <Field label="Notes" htmlFor="ml-notes"><Textarea id="ml-notes" name="notes" rows={3} /></Field>
      <p className="text-xs text-muted">Only add people who asked you to contact them. Marketing messages need their separate consent.</p>
      <Button variant="accent" disabled={pending}>{pending ? "Adding…" : "Add lead"}</Button>
    </form>
  );
}
