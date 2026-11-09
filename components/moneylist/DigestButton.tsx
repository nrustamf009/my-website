"use client";

import { useState, useTransition } from "react";
import { sendDigestNow } from "@/lib/actions/moneylist";
import { Button } from "@/components/ui";

export function DigestButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="secondary" disabled={pending} onClick={() => start(async () => { const r = await sendDigestNow(); setMsg(r.sent ? `Digest sent (${r.count})` : "Couldn't send"); })}>
        {pending ? "Sending…" : "Email me the digest"}
      </Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
