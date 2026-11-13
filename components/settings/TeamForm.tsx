"use client";

import { useActionState } from "react";
import { inviteTeammate, type SettingsState } from "@/lib/actions/settings";
import { Button, Input } from "@/components/ui";

export function InviteForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(inviteTeammate, {});
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto]">
      <Input name="name" placeholder="Name" aria-label="Name" />
      <Input name="email" type="email" placeholder="email@company.com" aria-label="Email" />
      <Input name="nmlsId" placeholder="NMLS #" aria-label="NMLS ID" />
      <Button variant="secondary" disabled={pending}>Invite LO</Button>
      {(e.name || e.email || e.nmlsId) && <p className="text-xs text-bad sm:col-span-4">{e.name ?? e.email ?? e.nmlsId}</p>}
      {state.message && <p className="text-xs text-good sm:col-span-4">{state.message}</p>}
    </form>
  );
}
