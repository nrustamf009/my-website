"use client";

import { useState } from "react";
import { Button, cx } from "@/components/ui";

export function InterestButton({ endpoint, optionId, label, chosen, brokerFirstName }: { endpoint: string; optionId: string; label: string; chosen: boolean; brokerFirstName: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(chosen ? "done" : "idle");
  if (state === "done")
    return <div className="rounded-xl bg-good-soft px-3 py-2.5 text-center text-sm font-medium text-good">✓ {brokerFirstName} has been notified about Option {label}</div>;
  return (
    <Button
      variant="accent"
      size="lg"
      className={cx("w-full")}
      disabled={state === "sending"}
      onClick={async () => {
        setState("sending");
        const res = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId }) });
        setState(res.ok ? "done" : "error");
      }}
    >
      {state === "sending" ? "Sending…" : state === "error" ? "Try again" : `I'm interested in Option ${label}`}
    </Button>
  );
}
