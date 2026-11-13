import { env } from "@/lib/env";

/**
 * Universal embed: <script src="https://APP/embed.js" data-broker="slug" data-lo="maya" async></script>
 * Injects an auto-resizing iframe right after the script tag and forwards the host page's UTM tags.
 */
export function GET() {
  const js = `(function(){
  var s = document.currentScript; if (!s) return;
  var slug = s.getAttribute("data-broker"); if (!slug) return;
  var lo = s.getAttribute("data-lo");
  var q = new URLSearchParams();
  if (lo) q.set("lo", lo);
  var p = new URLSearchParams(window.location.search);
  ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(function(k){ if (p.get(k)) q.set(k, p.get(k)); });
  if (!q.get("utm_source")) q.set("utm_source", "website");
  q.set("ref", window.location.hostname);
  var f = document.createElement("iframe");
  f.src = ${JSON.stringify(env.appUrl)} + "/b/" + encodeURIComponent(slug) + "/embed/check?" + q.toString();
  f.title = "DSCR Instant Check";
  f.loading = "lazy";
  f.style.cssText = "width:100%;border:0;min-height:1100px;display:block;background:transparent";
  window.addEventListener("message", function(e){
    if (e.source === f.contentWindow && e.data && e.data.type === "dscr-embed-height") f.style.height = e.data.height + "px";
  });
  s.parentNode.insertBefore(f, s.nextSibling);
})();`;
  return new Response(js, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
