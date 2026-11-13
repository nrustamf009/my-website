import type { TriggerKind } from "@/lib/dscr";

export const TRIGGER_TONE: Record<TriggerKind, "accent" | "warn" | "good" | "bad" | "neutral"> = {
  PREPAY: "accent",
  SEASONING: "warn",
  RATE: "good",
  ARM_RESET: "bad",
  ANNIVERSARY: "neutral",
};

export const TRIGGER_NAME: Record<TriggerKind, string> = {
  PREPAY: "Prepay ending",
  SEASONING: "Seasoning",
  RATE: "Rate drop",
  ARM_RESET: "ARM reset",
  ANNIVERSARY: "Anniversary",
};

export const STATUS_LABEL: Record<string, string> = { OPEN: "Open", CONTACTED: "Contacted", SNOOZED: "Snoozed", NOT_INTERESTED: "Not interested", WON: "Won" };
export const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "accent"> = { OPEN: "accent", CONTACTED: "good", SNOOZED: "warn", NOT_INTERESTED: "neutral", WON: "good" };
