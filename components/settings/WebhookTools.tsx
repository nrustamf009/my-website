"use client";

import { useState, useTransition } from "react";
import { sendTestWebhook } from "@/lib/actions/settings";
import { Button } from "@/components/ui";

export function TestWebhookButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => setMsg((await sendTestWebhook()).message))}>{pending ? "Sending…" : "Send test event"}</Button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </span>
  );
}
