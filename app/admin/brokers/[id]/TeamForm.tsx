"use client";

import { useActionState, useState, useTransition } from "react";
import { addBrokerUser, resendInvite, type FormState } from "@/lib/actions/admin";
import { Button, Input, Select } from "@/components/ui";

export function AddUserForm({ brokerId }: { brokerId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addBrokerUser.bind(null, brokerId), {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_140px_auto]">
      <Input name="name" placeholder="Name" aria-label="Name" />
      <Input name="email" type="email" placeholder="email@company.com" aria-label="Email" />
      <Input name="nmlsId" placeholder="NMLS #" aria-label="NMLS ID" />
      <Select name="role" aria-label="Role" defaultValue="LO"><option value="LO">Loan officer</option><option value="BROKER_ADMIN">Broker admin</option></Select>
      <Button variant="secondary" disabled={pending}>Invite</Button>
      {(e.email || e.name || e.nmlsId) && <p className="text-xs text-bad sm:col-span-5">{e.email ?? e.name ?? e.nmlsId}</p>}
      {state.ok && <p className="text-xs text-good sm:col-span-5">Invite sent.</p>}
    </form>
  );
}

export function ResendInvite({ userId }: { userId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => setMsg((await resendInvite(userId)).ok ? "Sent ✓" : "Failed"))} className="text-xs font-medium text-accent hover:underline">
      {msg ?? (pending ? "Sending…" : "Resend invite")}
    </button>
  );
}
