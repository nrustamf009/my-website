"use client";

import { useEffect, useState } from "react";
import { parseDollarsToCents, usd } from "@/lib/format";
import { cx } from "@/components/ui";

const display = (cents: number | null) => (cents == null ? "" : usd(cents).replace("$", ""));

/** Dollar input that emits integer cents. `name` makes it work in a plain GET form (no JS). */
export function MoneyInput({ value, onChange, id, name, placeholder, suffix, className, invalid, ariaLabel }: { value: number | null; onChange: (cents: number | null) => void; id?: string; name?: string; placeholder?: string; suffix?: string; className?: string; invalid?: boolean; ariaLabel?: string }) {
  const [text, setText] = useState(display(value));
  useEffect(() => {
    if (parseDollarsToCents(text) !== value) setText(display(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>$</span>
      <input
        id={id}
        name={name}
        aria-label={ariaLabel}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          const cents = digits ? parseDollarsToCents(digits) : null;
          setText(cents == null ? "" : display(cents));
          onChange(cents);
        }}
        className={cx(
          "num block h-12 w-full rounded-xl border bg-surface pl-7 pr-3 text-[17px] text-ink transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40",
          suffix && "pr-14",
          invalid ? "border-bad" : "border-line",
        )}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted" aria-hidden>{suffix}</span>}
    </div>
  );
}
