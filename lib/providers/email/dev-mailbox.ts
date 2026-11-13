import { prisma } from "@/lib/db";
import type { EmailMessage, Mailer } from "./types";

/** Stores emails in the DevEmail table so the demo works without an email provider. */
export class DevMailbox implements Mailer {
  readonly mode = "dev" as const;
  async send(msg: EmailMessage) {
    const row = await prisma.devEmail.create({
      data: {
        to: Array.isArray(msg.to) ? msg.to.join(", ") : msg.to,
        subject: msg.subject,
        html: msg.html,
        attachments: msg.attachments?.length
          ? JSON.stringify(msg.attachments.map((a) => ({ filename: a.filename, size: a.content.length, base64: a.content.toString("base64") })))
          : null,
      },
    });
    if (process.env.NODE_ENV !== "test") console.log(`[dev-mailbox] email stored (${row.id}). View at /dev/mailbox`);
    return { id: row.id };
  }
}
