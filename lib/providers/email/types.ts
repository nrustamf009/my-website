export interface EmailAttachment {
  filename: string;
  content: Buffer;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  fromName?: string;
  attachments?: EmailAttachment[];
}

export interface Mailer {
  readonly mode: "resend" | "dev";
  send(msg: EmailMessage): Promise<{ id: string }>;
}
