"use client";

import { useEffect } from "react";

/**
 * Links such as /platforms#contact scroll to their section on arrival, but the race, sector and
 * pay sections stream in above it afterwards and push it down. Browsers without scroll
 * anchoring (Safari on iOS) would leave the visitor somewhere in the Pay section. Rendered at
 * the end of the streamed sections, this scrolls to the linked section once more when they arrive.
 */
export function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    // Race links (#race-new) pick a race rather than naming an element, so they find nothing here.
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);
  return null;
}
