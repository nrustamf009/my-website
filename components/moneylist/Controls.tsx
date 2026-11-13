"use client";

import { useActionState, useState, useTransition } from "react";
import { saveMarketRate, sendDigestNow, type RateState } from "@/lib/actions/moneylist";
import { Button } from "@/components/ui";
import { rate } from "@/lib/format";

export function MarketRateForm({ current, canManage }: { current: number | null; canManage: boolean }) {
  const [state, action, pending] = useActionState<RateState, FormData>(saveMarketRate, {});
  const shown = current != null ? rate(current).replace("%", "") : "";
  if (!canManage) return <div className="num mt-2 font-display text-3xl text-ink">{shown ? `${shown}%` : "—"}</div>;
  return (
    <form action={action} className="mt-1">
      <div className="flex items-center gap-1.5">
        <input name="marketRate" aria-label="Market rate (%)" defaultValue={shown} inputMode="decimal" className="num h-10 w-24 rounded-lg border border-line bg-surface px-2 font-display text-2xl text-ink focus-accent" />
        <span className="font-display text-2xl text-ink">%</span>
        <Button size="sm" variant="secondary" disabled={pending}>{pending ? "…" : "Save"}</Button>
      </div>
      {state.error && <p className="mt-1 text-xs text-bad" role="alert">{state.error}</p>}
      {state.ok && <p className="mt-1 text-xs text-good">Saved. Rankings updated.</p>}
    </form>
  );
}

export function DigestButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted" role="status">{msg}</span>}
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendDigestNow();
            setMsg(r.ok ? `Digest sent (${r.count} to call)` : (r.error ?? "Could not send"));
          })
        }
      >
        {pending ? "Sending…" : "Email me the digest"}
      </Button>
    </div>
  );
}
