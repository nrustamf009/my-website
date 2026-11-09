"use client";

import { useRef, useState } from "react";
import { Button, Field, Input, cx } from "@/components/ui";
import { CONSENT_TEXT } from "@/lib/validation";

export interface DealPayload {
  address: string;
  price: number;
  downPaymentPct: number;
  monthlyRent: number;
  fico?: string | null;
  ratePct?: number;
  interestOnly?: boolean;
  hoaMonthly?: number;
}

export function LeadCaptureForm({
  slug,
  source,
  snapshotToken,
  getDeal,
  submitLabel = "Email me the full analysis",
  brokerFirstName,
  onSuccess,
}: {
  slug: string;
  source: "CHECK" | "LISTING";
  snapshotToken?: string;
  getDeal: () => DealPayload | null;
  submitLabel?: string;
  brokerFirstName: string;
  onSuccess?: () => void;
}) {
  const openedAt = useRef(Date.now());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setErrors({});
    const deal = getDeal();
    if (!deal) {
      setFormError("Fill in the property details above first.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const res = await fetch(`/api/public/${slug}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          snapshotToken,
          deal,
          contact: {
            name: fd.get("name"),
            email: fd.get("email"),
            phone: fd.get("phone"),
            consent: fd.get("consent") === "on",
            company: fd.get("company"),
            elapsedMs: Date.now() - openedAt.current,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const fe: Record<string, string> = {};
        for (const [k, v] of Object.entries((data.fieldErrors ?? {}) as Record<string, string>)) fe[k.replace(/^contact\./, "")] = v;
        setErrors(fe);
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      setDone(String(fd.get("email")));
      onSuccess?.();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="animate-rise rounded-2xl bg-accent-soft p-5 text-center" role="status">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent text-on-accent">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12.5 10 17 19 7" /></svg>
        </div>
        <h3 className="mt-3 font-display text-xl text-ink">Check your inbox</h3>
        <p className="mt-1 text-sm text-ink-2">We sent the full analysis to <strong>{done}</strong>. {brokerFirstName} will reach out shortly to walk you through it.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Field label="Full name" error={errors.name} htmlFor="lf-name"><Input id="lf-name" name="name" autoComplete="name" required aria-invalid={!!errors.name} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" error={errors.email} htmlFor="lf-email"><Input id="lf-email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!errors.email} /></Field>
        <Field label="Mobile phone" error={errors.phone} htmlFor="lf-phone"><Input id="lf-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(555) 010-0000" /></Field>
      </div>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <label className={cx("flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed text-ink-2", errors.consent ? "border-bad bg-bad-soft" : "border-line bg-white")}>
        <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" />
        <span>{CONSENT_TEXT}</span>
      </label>
      {errors.consent && <p className="text-xs text-bad">{errors.consent}</p>}
      {formError && <p className="text-sm text-bad" role="alert">{formError}</p>}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>{pending ? "Sending…" : submitLabel}</Button>
      <p className="text-center text-[11px] text-muted">No credit check. No SSN. Your info goes only to {brokerFirstName}.</p>
    </form>
  );
}
