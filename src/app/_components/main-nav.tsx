"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Trends" },
  { href: "/platforms", label: "Platforms" },
] as const;

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
        href="/platforms#contact"
        className="rounded-full bg-ink px-5 py-2 font-semibold text-page hover:no-underline hover:opacity-90"
      >
        Contact us
      </Link>
    </nav>
  );
}
