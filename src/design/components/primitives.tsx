import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Small uppercase label (theme sets size, tracking and family). */
export function Eyebrow({ children, className, as: As = "div" }: { children: ReactNode; className?: string; as?: "div" | "span" | "p" }) {
  return <As className={cx("type-eyebrow text-muted", className)}>{children}</As>;
}

/** Section heading; atelier prefixes 01/02 in the accent (token-driven). */
export function SectionTitle({ n, children, className, id }: { n?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <h2 id={id} className={cx("type-section text-ink", className)} style={{ textWrap: "balance" }}>
      {n && <span className="section-num type-eyebrow mr-2 text-accent">{n}</span>}
      {children}
    </h2>
  );
}

/** Label + hint at left, a big figure at right, ruled below. */
export function DataRow({ label, hint, value, tone = "ink", testId }: { label: ReactNode; hint?: ReactNode; value: ReactNode; tone?: "ink" | "accent" | "positive" | "negative"; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-rule py-4">
      <div className="min-w-0">
        <div className="font-medium text-ink">{label}</div>
        {hint && <div className="type-body-small mt-0.5 text-muted">{hint}</div>}
      </div>
      <div className={cx("type-metric num shrink-0 text-right", tone === "accent" ? "text-accent" : tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-ink")} data-testid={testId}>
        {value}
      </div>
    </div>
  );
}

/** Compact metric (label over value) for panels. */
export function Metric({ label, value, hint, testId }: { label: ReactNode; value: ReactNode; hint?: ReactNode; testId?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div>
        <div className="text-ink">{label}</div>
        {hint && <div className="type-body-small text-muted">{hint}</div>}
      </div>
      <div className="type-metric-panel num text-ink" data-testid={testId}>{value}</div>
    </div>
  );
}

export function Panel({ children, className, ...rest }: ComponentProps<"section">) {
  return (
    <section className={cx("rounded-2xl border border-rule bg-surface p-5", className)} {...rest}>
      {children}
    </section>
  );
}

export function Chip({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" | "positive"; className?: string }) {
  const t = { neutral: "border border-rule text-ink-2", accent: "bg-accent text-on-accent", warn: "bg-warn text-on-warn", positive: "bg-positive-tint text-positive" }[tone];
  return <span className={cx("inline-flex items-center rounded-sm px-2 py-0.5 type-eyebrow", t, className)}>{children}</span>;
}

/** Primary call to action: accent fill, full width on phones, theme height and radius. */
export function CtaButton({ children, className, ...rest }: ComponentProps<"button">) {
  return (
    <button className={cx("cta inline-flex w-full items-center justify-center gap-2 bg-accent px-6 type-button text-on-accent transition hover:brightness-110 disabled:opacity-60", className)} {...rest}>
      {children}
    </button>
  );
}

export function EqualHousingMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <path d="M4 14 16 5l12 9" />
      <path d="M7 12v15h18V12" />
      <path d="M11 17h10M11 21h10" />
    </svg>
  );
}

/** Broker logo, or a theme-styled monogram (atelier shows the wordmark only). */
export function BrokerMark({ logoUrl, name, size = 40 }: { logoUrl: string | null; name: string; size?: number }) {
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logoUrl} alt={name} className="shrink-0 rounded-[var(--radius-logo)] object-contain" style={{ width: size, height: size }} />;
  }
  const letters = name.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (
    <span className="monogram" aria-hidden style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {letters}
    </span>
  );
}
