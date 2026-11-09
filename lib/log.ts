/**
 * Minimal structured logger that never writes personal data.
 * Keys that may hold PII are redacted, and string values are scanned for emails/phones.
 */
const PII_KEYS = /email|phone|name|address|transcript|notes|body|message|content|ssn/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;

function scrub(value: unknown, key = ""): unknown {
  if (value == null) return value;
  if (PII_KEYS.test(key)) return "[redacted]";
  if (typeof value === "string") return value.replace(EMAIL_RE, "[email]").replace(PHONE_RE, "[phone]");
  if (Array.isArray(value)) return value.map((v) => scrub(v));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrub(v, k)]));
  }
  return value;
}

type Level = "info" | "warn" | "error";
function write(level: Level, event: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "test") return;
  const line = JSON.stringify({ level, event, ...(data ? (scrub(data) as object) : {}), at: new Date().toISOString() });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, data?: Record<string, unknown>) => write("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => write("warn", event, data),
  error: (event: string, err?: unknown, data?: Record<string, unknown>) =>
    write("error", event, { ...data, error: err instanceof Error ? err.name + ": " + scrub(err.message) : String(scrub(err)) }),
};
