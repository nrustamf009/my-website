"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CheckForm } from "@/lib/check/form";
import { CONSENT_TEXT } from "@/lib/compliance/disclaimers";
import { t } from "@/lib/strings/en";
import { Button, Field, Input, cx } from "@/components/ui";
import { Turnstile } from "./Turnstile";

export interface LeadFormProps {
  slug: string;
  source: "WIDGET" | "SNAPSHOT";
  snapshotToken?: string;
  loSlug?: string | null;
  companyName: string;
  loFirstName: string;
  loPhone?: string | null;
  privacyPolicyUrl?: string | null;
  turnstileSiteKey: string | null;
  submitLabel: string;
  getForm: () => CheckForm | null;
}

function useUtm() {
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [referrer, setReferrer] = useState<string | undefined>();
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const u: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) if (p.get(k)) u[k] = p.get(k)!;
    setUtm(u);
    setReferrer(p.get("ref") ?? (document.referrer || undefined));
  }, []);
  return { utm, referrer };
}

export function LeadForm(p: LeadFormProps) {
  const openedAt = useRef(Date.now());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const onToken = useCallback((tk: string | null) => setToken(tk), []);
  const { utm, referrer } = useUtm();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setErrors({});
    const form = p.getForm();
    if (!form) return setFormError("Add the property address and details above first.");
    const fd = new FormData(e.currentTarget);
    setPending(true);
    try {
      const res = await fetch(`/api/public/${p.slug}/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: p.source,
          snapshotToken: p.snapshotToken,
          lo: p.loSlug ?? undefined,
          form,
          contact: {
            name: fd.get("name"),
            email: fd.get("email"),
            phone: fd.get("phone") ?? "",
            consentContact: fd.get("consentContact") === "on",
            consentMarketing: fd.get("consentMarketing") === "on",
            investmentProperty: fd.get("investmentProperty") === "on",
            company: fd.get("company"),
            elapsedMs: Date.now() - openedAt.current,
          },
          turnstileToken: token,
          utm,
          referrer,
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
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const tel = p.loPhone?.replace(/[^\d+]/g, "");
  if (done) {
    return (
      <div className="animate-rise rounded-2xl bg-accent-soft p-5 text-center" role="status">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent text-on-accent">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M5 12.5 10 17 19 7" /></svg>
        </div>
        <h3 className="mt-3 font-display text-xl text-ink">{t.form.successTitle}</h3>
        <p className="mt-1 text-sm text-ink-2">{t.form.successBody(done, p.loFirstName)}</p>
        {tel && (
          <div className="mt-4 flex justify-center gap-2">
            <a href={`tel:${tel}`} className="inline-flex h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent">Call {p.loFirstName} now</a>
            <a href={`sms:${tel}?&body=${encodeURIComponent(`Hi ${p.loFirstName}, I just ran a DSCR estimate and would like to talk.`)}`} className="inline-flex h-10 items-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-ink">Text</a>
          </div>
        )}
      </div>
    );
  }

  const box = (name: string, text: React.ReactNode, required = false) => (
    <label className={cx("flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed text-ink-2", errors[name] ? "border-bad bg-bad-soft" : "border-line bg-surface")}>
      <input type="checkbox" name={name} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]" aria-required={required || undefined} />
      <span>{text}</span>
    </label>
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <Field label={t.form.name} error={errors.name} htmlFor="lf-name"><Input id="lf-name" name="name" autoComplete="name" required aria-invalid={!!errors.name} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.form.email} error={errors.email} htmlFor="lf-email"><Input id="lf-email" name="email" type="email" autoComplete="email" inputMode="email" required aria-invalid={!!errors.email} /></Field>
        <Field label={t.form.phone} error={errors.phone} htmlFor="lf-phone"><Input id="lf-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="(555) 010-0000" /></Field>
      </div>
      <input type="text" name="company" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {box("investmentProperty", <strong className="font-semibold text-ink">{CONSENT_TEXT.INVESTMENT_PROPERTY}</strong>, true)}
      {errors.investmentProperty && <p className="text-xs text-bad">{errors.investmentProperty}</p>}
      {box(
        "consentContact",
        <>
          {CONSENT_TEXT.CONTACT(p.companyName)}
          {p.privacyPolicyUrl && <> <a href={p.privacyPolicyUrl} target="_blank" rel="noopener noreferrer" className="underline">{t.footer.privacy}</a>.</>}
        </>,
        true,
      )}
      {errors.consentContact && <p className="text-xs text-bad">{errors.consentContact}</p>}
      {box("consentMarketing", <>{CONSENT_TEXT.MARKETING(p.companyName)} <span className="text-muted">(optional)</span></>)}
      <Turnstile siteKey={p.turnstileSiteKey} onToken={onToken} />
      {formError && <p className="text-sm text-bad" role="alert">{formError}</p>}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={pending}>{pending ? "Sending…" : p.submitLabel}</Button>
      <p className="text-center text-xs text-muted">{t.form.noSsn(p.loFirstName)}</p>
    </form>
  );
}
