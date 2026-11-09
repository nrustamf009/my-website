import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { DevMailbox } from "./dev-mailbox";
import { ResendMailer } from "./resend";
import type { EmailMessage, Mailer } from "./types";

export type { EmailMessage, Mailer } from "./types";

export function getMailer(): Mailer {
  return env.resendKey ? new ResendMailer(env.resendKey) : new DevMailbox();
}

/** Send without throwing: email failures must never break a user-facing flow. */
export async function sendEmailSafe(msg: EmailMessage, tag: string): Promise<boolean> {
  try {
    await getMailer().send(msg);
    log.info("email.sent", { tag });
    return true;
  } catch (err) {
    log.error("email.failed", err, { tag });
    return false;
  }
}
