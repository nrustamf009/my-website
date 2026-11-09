import type { PublicBroker } from "@/lib/broker";

export const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface Row {
  label: string;
  value: string;
}

/** Branded, email-client-safe HTML layout (tables + inline styles). */
export function layout(params: {
  broker: PublicBroker;
  heading: string;
  intro?: string;
  rows?: Row[];
  bodyHtml?: string;
  cta?: { label: string; url: string };
  footerNote?: string;
}): string {
  const { broker, heading, intro, rows, bodyHtml, cta, footerNote } = params;
  const accent = broker.accentColor || "#1F4E79";
  const rowsHtml = rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;border:1px solid #e7e5e4;border-radius:10px;overflow:hidden">${rows
        .map(
          (r, i) =>
            `<tr style="background:${i % 2 ? "#fafaf9" : "#ffffff"}"><td style="padding:10px 14px;color:#57534e;font-size:14px">${esc(r.label)}</td><td style="padding:10px 14px;text-align:right;font-weight:600;color:#1c1917;font-size:14px">${esc(r.value)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const ctaHtml = cta
    ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:15px">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="height:6px;background:${accent}"></td></tr>
<tr><td style="padding:24px 28px 8px">
${broker.logoUrl && broker.logoUrl.startsWith("http") ? `<img src="${esc(broker.logoUrl)}" alt="${esc(broker.companyName)}" height="36" style="display:block;margin-bottom:12px">` : `<div style="font-weight:700;color:${accent};font-size:16px;margin-bottom:12px">${esc(broker.companyName)}</div>`}
<h1 style="margin:0 0 8px;font-size:22px;color:#1c1917">${esc(heading)}</h1>
${intro ? `<p style="margin:0;color:#44403c;font-size:15px;line-height:1.55">${esc(intro)}</p>` : ""}
${rowsHtml}${bodyHtml ?? ""}${ctaHtml}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #e7e5e4;color:#78716c;font-size:12px;line-height:1.5">
<strong style="color:#44403c">${esc(broker.name)}</strong>, ${esc(broker.title)} · ${esc(broker.companyName)}<br>
NMLS #${esc(broker.nmlsId)}${broker.companyNmlsId ? ` · Company NMLS #${esc(broker.companyNmlsId)}` : ""}${broker.phone ? ` · ${esc(broker.phone)}` : ""} · ${esc(broker.email)}<br><br>
${footerNote ? `${esc(footerNote)}<br><br>` : ""}${esc(broker.disclaimerText)}
</td></tr></table></td></tr></table></body></html>`;
}

export function textVersion(heading: string, intro: string | undefined, rows: Row[] | undefined, broker: PublicBroker, cta?: { label: string; url: string }) {
  return [
    heading,
    "",
    intro ?? "",
    "",
    ...(rows ?? []).map((r) => `${r.label}: ${r.value}`),
    cta ? `\n${cta.label}: ${cta.url}` : "",
    "",
    `${broker.name}, ${broker.companyName} · NMLS #${broker.nmlsId}`,
    broker.disclaimerText,
  ].join("\n");
}
