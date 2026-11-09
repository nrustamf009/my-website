"use client";

import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

/** Dollar input that shows thousands separators while editing. */
export function MoneyInput({
  value,
  onChange,
  id,
  placeholder,
  suffix,
  className,
  invalid,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  id?: string;
  placeholder?: string;
  suffix?: string;
  className?: string;
  invalid?: boolean;
}) {
  const [text, setText] = useState(value == null ? "" : value.toLocaleString("en-US"));
  useEffect(() => {
    const parsed = Number(text.replace(/[^\d.]/g, ""));
    if (value == null && text !== "") return;
    if (value != null && parsed !== value) setText(value.toLocaleString("en-US"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className={cx("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          const n = digits ? parseInt(digits, 10) : null;
          setText(n == null ? "" : n.toLocaleString("en-US"));
          onChange(n);
        }}
        className={cx(
          "num block h-12 w-full rounded-xl border bg-white pl-7 pr-3 text-[17px] text-ink shadow-[inset_0_1px_0_rgba(0,0,0,0.02)] transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-line)]",
          suffix && "pr-14",
          invalid ? "border-bad" : "border-line",
        )}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>}
    </div>
  );
}
