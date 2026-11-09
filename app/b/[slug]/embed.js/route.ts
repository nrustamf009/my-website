import { getActiveBrokerBySlug } from "@/lib/broker";
import { env } from "@/lib/env";

/**
 * One-line embed: <script src="https://APP/b/SLUG/embed.js" async></script>
 * Inserts an auto-resizing iframe right where the script tag is placed.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const broker = await getActiveBrokerBySlug(slug);
  if (!broker) return new Response("// broker not found", { status: 404, headers: { "Content-Type": "application/javascript" } });
  const src = `${env.appUrl}/b/${broker.slug}/embed/check`;
  const js = `(function(){
  var s = document.currentScript;
  var f = document.createElement("iframe");
  f.src = ${JSON.stringify(src)};
  f.title = ${JSON.stringify(`DSCR Instant Check by ${broker.companyName}`)};
  f.style.cssText = "width:100%;border:0;min-height:900px;display:block;background:transparent";
  f.setAttribute("loading","lazy");
  window.addEventListener("message", function(e){
    if (e.source === f.contentWindow && e.data && e.data.type === "dscr-embed-height") f.style.height = e.data.height + "px";
  });
  s.parentNode.insertBefore(f, s.nextSibling);
})();`;
  return new Response(js, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
