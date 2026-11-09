"use client";

import { useEffect } from "react";

/** Logs an open and active time on page (only while the tab is visible). No cookies, no IP. */
export function ScenarioTracker({ endpoint }: { endpoint: string }) {
  useEffect(() => {
    const key = `dscr-visit-${endpoint}`;
    let visitKey = sessionStorage.getItem(key);
    const isNew = !visitKey;
    if (!visitKey) {
      visitKey = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      sessionStorage.setItem(key, visitKey);
    }
    const send = (body: object, beacon = false) => {
      const data = JSON.stringify({ visitKey, ...body });
      if (beacon && navigator.sendBeacon) navigator.sendBeacon(endpoint, new Blob([data], { type: "application/json" }));
      else fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: data, keepalive: true }).catch(() => {});
    };
    if (isNew) send({ event: "start" });
    let last = Date.now();
    const flush = (beacon = false) => {
      const now = Date.now();
      const seconds = (now - last) / 1000;
      last = now;
      if (seconds >= 1) send({ event: "ping", seconds }, beacon);
    };
    const timer = setInterval(() => document.visibilityState === "visible" && flush(), 15_000);
    const onVis = () => (document.visibilityState === "hidden" ? flush(true) : (last = Date.now()));
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", () => flush(true));
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [endpoint]);
  return null;
}
