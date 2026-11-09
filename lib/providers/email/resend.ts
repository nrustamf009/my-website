import { Resend } from "resend";
import { env } from "@/lib/env";
import type { EmailMessage, Mailer } from "./types";

export class ResendMailer implements Mailer {
  readonly mode = "resend" as const;
  private client: Resend;
  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(msg: EmailMessage) {
    const fromAddress = env.emailFrom.match(/<(.+)>/)?.[1] ?? env.emailFrom;
    const from = msg.fromName ? `${msg.fromName.replace(/[<>"]/g, "")} <${fromAddress}>` : env.emailFrom;
    const { data, error } = await this.client.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    if (error) throw new Error(`Resend error: ${error.name}`);
    return { id: data?.id ?? "unknown" };
  }
}
