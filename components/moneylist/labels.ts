import type { Trigger } from "@/lib/dscr";

/** Short, human labels for Money List triggers (display only). */
export function triggerLabel(t: Trigger): string {
  switch (t.kind) {
    case "PREPAY":
      return t.days >= 0 ? `Prepay ends in ${t.days}d` : "Prepay expired";
    case "SEASONING":
      return `${t.detail?.months}-month seasoning`;
    case "RATE":
      return "Rate drop";
    case "ARM_RESET":
      return `ARM resets in ${t.days}d`;
    case "ANNIVERSARY":
      return "Loan anniversary";
  }
}

export const TRIGGER_TONE: Record<Trigger["kind"], "accent" | "warn" | "good" | "bad" | "neutral"> = {
  PREPAY: "accent",
  SEASONING: "warn",
  RATE: "good",
  ARM_RESET: "bad",
  ANNIVERSARY: "neutral",
};
