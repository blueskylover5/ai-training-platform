"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** The other site this visit came from, only on its first page view. */
let firstView = true;
/** React runs effects twice in development; one page view is still one record. */
let lastSent: { path: string; at: number } | null = null;

/**
 * Reports each page view to the visitor log (VIS-01, ADR 0008), including moves between pages that
 * happen without a full page load. The server adds the time, IP address, location and browser.
 */
export function VisitTracker({ endpoint }: { endpoint: string }) {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    const now = Date.now();
    if (lastSent?.path === pathname && now - lastSent.at < 1_000) return;
    lastSent = { path: pathname, at: now };

    let referrer: string | null = null;
    if (firstView) {
      firstView = false;
      try {
        if (document.referrer && new URL(document.referrer).origin !== window.location.origin) referrer = document.referrer;
      } catch {}
    }
    // keepalive lets the report finish even if the visitor leaves straight away.
    fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: pathname, referrer }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, endpoint]);
  return null;
}
