"use client";

import { useActionState } from "react";
import { addBrokerUser, type FormState } from "@/lib/actions/admin";
import { Button, Input } from "@/components/ui";

export function AddUserForm({ brokerId }: { brokerId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addBrokerUser.bind(null, brokerId), {});
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row">
      <Input name="name" placeholder="Name" className="sm:max-w-48" />
      <Input name="email" type="email" placeholder="email@company.com" required />
      <Button variant="secondary" disabled={pending}>Add login</Button>
      {state.fieldErrors?.email && <p className="text-xs text-bad sm:self-center">{state.fieldErrors.email}</p>}
      {state.ok && <p className="text-xs text-good sm:self-center">Added.</p>}
    </form>
  );
}
