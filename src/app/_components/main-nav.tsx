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
    <nav aria-label="Main" className="flex gap-5 text-sm">
      {links.map((link) => {
        const current = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={current ? "font-medium text-ink" : "text-ink-2 hover:text-ink"}
          >
            {link.label}
          </Link>
        );
      })}
      <span className="text-ink-3" title="Coming soon">
        Experts
      </span>
    </nav>
  );
}
