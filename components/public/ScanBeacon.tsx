"use client";

import { useEffect } from "react";

/** Counts a listing-snapshot view once the page is actually open in a browser (bots and prefetches don't run JS). */
export function ScanBeacon({ slug, token }: { slug: string; token: string }) {
  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get("src") ?? undefined;
    fetch(`/api/public/${slug}/event`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "snapshot.scanned", token, src }), keepalive: true }).catch(() => {});
  }, [slug, token]);
  return null;
}
