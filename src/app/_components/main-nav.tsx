"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** The Best platforms page replaced "Job market" and "Platform guide" on 23 November 2026 (/market redirects there). */
const links = [{ href: "/platforms", label: "Best platforms" }] as const;

/** Site navigation; marks the page you are on. */
export function MainNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center gap-x-7 gap-y-2 text-base">
      {links.map((link) => {
        const current = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`py-1 hover:no-underline ${
              current ? "font-semibold text-ink underline decoration-2 underline-offset-8" : "text-ink-2 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <Link
        href="/contact"
        aria-current={pathname === "/contact" ? "page" : undefined}
        className={`rounded-full bg-brand px-5 py-2 font-semibold text-white hover:opacity-90 ${
          pathname === "/contact" ? "underline decoration-2 underline-offset-4" : "hover:no-underline"
        }`}
      >
        Contact us
      </Link>
    </nav>
  );
}
