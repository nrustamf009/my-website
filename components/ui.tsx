import Link from "next/link";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export const cx = clsx;

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-2 shadow-sm",
  accent: "bg-accent text-on-accent hover:brightness-110 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:bg-paper",
  ghost: "text-ink-2 hover:bg-black/5",
  danger: "bg-white text-bad border border-bad/30 hover:bg-bad-soft",
};
const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-12 px-5 text-base" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition focus-accent disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cx("rounded-2xl border border-line bg-card", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div>
        <h2 className="font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cx("mb-1.5 block text-sm font-medium text-ink-2", className)} {...props} />;
}

const inputBase =
  "block w-full rounded-lg border border-line bg-white px-3 text-[15px] text-ink placeholder:text-muted/70 shadow-[inset_0_1px_0_rgba(0,0,0,0.02)] transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-line)]";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputBase, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputBase, "py-2.5 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cx(inputBase, "h-11 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%236f6a60%22 stroke-width=%222.5%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_12px_center] bg-no-repeat pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="mt-1 text-xs text-bad">{error}</p> : hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "accent";
const tones: Record<Tone, string> = {
  neutral: "bg-black/5 text-ink-2",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  accent: "bg-accent-soft text-accent-deep",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-2xl border border-line bg-card p-5", className)}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className="num mt-2 font-display text-3xl text-ink">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <h3 className="font-display text-xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return <th className={cx("px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted", className)} {...props} />;
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cx("px-4 py-3 align-top text-sm text-ink-2", className)} {...props} />;
}

export function Notice({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-xl px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}
