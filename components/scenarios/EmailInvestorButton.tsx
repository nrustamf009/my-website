"use client";

import { useState, useTransition } from "react";
import { emailScenarioToInvestor } from "@/lib/actions/scenarios";
import { Button } from "@/components/ui";

export function EmailInvestorButton({ id }: { id: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="primary" disabled={pending} onClick={() => start(async () => setMsg((await emailScenarioToInvestor(id)).message))}>{pending ? "Sending…" : "Email to investor"}</Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
