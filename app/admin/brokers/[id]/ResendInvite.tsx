"use client";

import { useState, useTransition } from "react";
import { resendInvite } from "@/lib/actions/admin";

export function ResendInvite({ userId }: { userId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => setMsg((await resendInvite(userId)).ok ? "Invite sent ✓" : "Failed"))} className="text-xs font-medium text-accent hover:underline disabled:opacity-50">
      {msg ?? (pending ? "Sending…" : "Resend invite")}
    </button>
  );
}
