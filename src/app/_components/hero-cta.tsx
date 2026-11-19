import Link from "next/link";

/**
 * The call to action in the heroes of the home page, Job market and the Platform guide (owner's
 * request, 19 November 2026): one button to Contact us. The Telegram and Discord buttons are on
 * Contact us only (owner's request), and Contact us itself has no hero button: its form and chat
 * buttons are right there. `onDark` for heroes on the dark brand background.
 */
export function HeroCta({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  const base =
    "inline-flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-center text-lg font-semibold hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto";
  const primary = onDark
    ? `${base} bg-accent text-brand-deep hover:brightness-105 focus-visible:outline-white`
    : `${base} bg-brand text-white hover:bg-brand-strong focus-visible:outline-brand`;

  return (
    <div className={`flex ${className}`}>
      <Link href="/contact" className={primary}>
        {/* A no-break space keeps the arrow with its word on narrow screens. */}
        Tell us where you&apos;re stuck&nbsp;→
      </Link>
    </div>
  );
}
