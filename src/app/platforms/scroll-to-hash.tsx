"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Links such as /platforms#pay scroll to their section on arrival, but the race, sector and
 * pay sections stream in above it afterwards and push it down. Browsers without scroll
 * anchoring (Safari on iOS) would leave the visitor somewhere in the wrong section. Rendered at
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

/**
 * The contact form was section 4 of this page, /platforms#contact, until it got its own page
 * (CON-01, #9). The menu and the home page linked there, so people may have it saved. The part
 * after # never reaches the server, so the browser forwards it. Rendered in the page's first part,
 * so it runs straight away rather than after the figures arrive, and also when there are none.
 * Replacing keeps Back from returning to the old address and bouncing straight back here.
 */
export function ForwardOldContactLink() {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash === "#contact") router.replace("/contact");
  }, [router]);
  return null;
}
