import { env } from "@/lib/env";
import { Card, CardHeader } from "@/components/ui";
import { CopyButton } from "@/components/dashboard/CopyButton";

const GUIDES: [string, string][] = [
  ["WordPress", "Edit the page → add a “Custom HTML” block → paste the script → Update."],
  ["Wix", "Add → Embed Code → Embed HTML → paste the script → set height to about 1,200 px."],
  ["Squarespace", "Edit page → add a “Code” block → paste the script → turn off “Display Source”."],
  ["GoDaddy Website Builder", "Add Section → HTML → paste the script → Done."],
];

/** Links and embed snippets for the Instant Check (per LO when `loSlug` is given). */
export function EmbedPanel({ slug, loSlug }: { slug: string; loSlug?: string | null }) {
  const base = env.appUrl;
  const lo = loSlug ? `?lo=${loSlug}` : "";
  const link = `${base}/b/${slug}/check${lo}`;
  const script = `<script src="${base}/embed.js" data-broker="${slug}"${loSlug ? ` data-lo="${loSlug}"` : ""} async></script>`;
  const iframe = `<iframe src="${base}/b/${slug}/embed/check${lo}" style="width:100%;min-height:1200px;border:0" title="DSCR Instant Check" loading="lazy"></iframe>`;
  return (
    <Card id="embed">
      <CardHeader title="Your Instant Check" subtitle="Link in bio, email signature, and an embeddable calculator for your website." />
      <div className="space-y-5 p-5">
        {[
          ["Link (Instagram bio, email signature, Google Business profile)", link],
          ["Website embed (recommended: auto-resizing, carries UTM tags)", script],
          ["Plain iframe (if your builder blocks scripts)", iframe],
        ].map(([label, code]) => (
          <div key={label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm font-medium text-ink-2">{label}<CopyButton text={code!} /></div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-ink p-3 text-xs text-page">{code}</pre>
          </div>
        ))}
        <div>
          <div className="mb-2 text-sm font-medium text-ink-2">Where to paste it</div>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {GUIDES.map(([k, v]) => <li key={k} className="rounded-lg border border-line p-3"><strong className="block text-ink">{k}</strong><span className="text-muted">{v}</span></li>)}
          </ul>
          <p className="mt-2 text-xs text-muted">Tip: add <code>?utm_source=instagram</code> (or facebook, email…) to the link and every lead will show where it came from.</p>
        </div>
      </div>
    </Card>
  );
}
