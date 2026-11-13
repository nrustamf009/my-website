import { log } from "@/lib/log";

/** Cloudflare Turnstile (free, self-serve). Mock mode accepts everything when keys are unset. */
export interface BotCheck {
  readonly mode: "turnstile" | "mock";
  verify(token: string | null | undefined, ip: string): Promise<boolean>;
}

class TurnstileCheck implements BotCheck {
  readonly mode = "turnstile" as const;
  constructor(private secret: string) {}
  async verify(token: string | null | undefined, ip: string) {
    if (!token) return false;
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: this.secret, response: token, remoteip: ip }),
        signal: AbortSignal.timeout(5_000),
      });
      const data = (await res.json()) as { success?: boolean };
      return data.success === true;
    } catch (err) {
      log.warn("turnstile.verify_failed", { error: err instanceof Error ? err.name : "unknown" });
      return false;
    }
  }
}

class MockCheck implements BotCheck {
  readonly mode = "mock" as const;
  async verify() {
    return true;
  }
}

export function getBotCheck(): BotCheck {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  return secret ? new TurnstileCheck(secret) : new MockCheck();
}

export const turnstileSiteKey = () => process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
