import { env } from "@/lib/env";

/** Per-broker script URL (older snippets). Delegates to /embed.js with data-broker. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const js = `(function(){var s=document.currentScript;var n=document.createElement("script");n.src=${JSON.stringify(env.appUrl + "/embed.js")};n.setAttribute("data-broker",${JSON.stringify(slug)});s.parentNode.insertBefore(n,s.nextSibling);})();`;
  return new Response(js, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
