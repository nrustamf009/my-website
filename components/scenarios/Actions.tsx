"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { duplicateScenario, extendScenario, revokeScenario, shareScenario } from "@/lib/actions/scenarios";
import { Button } from "@/components/ui";

export function SharePanel({ id, url, hasEmail, shared, live }: { id: string; url: string; hasEmail: boolean; shared: boolean; live: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const copy = () =>
    start(async () => {
      const r = await shareScenario(id);
      if (!r.ok) return setMsg(r.error ?? "Could not share");
      try {
        await navigator.clipboard.writeText(r.url!);
        setMsg("Link copied. Paste it in a text or email.");
      } catch {
        setMsg(r.url!);
      }
      router.refresh();
    });
  const email = () =>
    start(async () => {
      const r = await shareScenario(id, { email: true });
      setMsg(r.ok ? (r.emailed ? "Emailed to the investor." : "Shared, but the email could not be sent.") : (r.error ?? "Could not send"));
      router.refresh();
    });
  return (
    <div className="space-y-3">
      <div className="truncate rounded-lg bg-paper px-3 py-2 text-xs text-ink-2" data-testid="scenario-url">{url}</div>
      <div className="flex flex-wrap gap-2">
        <Button variant="accent" onClick={copy} disabled={pending || !live}>{shared ? "Copy link" : "Share: copy link"}</Button>
        <Button variant="secondary" onClick={email} disabled={pending || !hasEmail || !live} title={hasEmail ? undefined : "Add the investor's email"}>Email to investor</Button>
      </div>
      {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
    </div>
  );
}

export function ManageButtons({ id, revoked }: { id: string; revoked: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap gap-2">
      {!revoked && <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await extendScenario(id); router.refresh(); })}>Extend 30 days</Button>}
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await duplicateScenario(id); })}>Duplicate</Button>
      {!revoked && (
        <Button size="sm" variant="danger" disabled={pending} onClick={() => { if (confirm("Revoke this link? The investor will see that it's no longer available.")) start(async () => { await revokeScenario(id); router.refresh(); }); }}>Revoke link</Button>
      )}
    </div>
  );
}
