import Link from "next/link";
import { contactConfig } from "@/config";
import { contactChannels } from "@/contact/channels";
import { TelegramIcon } from "./brand-icons";

/**
 * The call to action in the heroes of the home page, Job market and the Platform guide (owner's
 * request, 19 November 2026): the main button to Contact us, and Telegram beside it once it is set
 * up (CON-05). `onDark` for heroes on the dark brand background. Contact us has none: its form and
 * chat buttons are right there.
 */
export function HeroCta({ onDark = false, className = "" }: { onDark?: boolean; className?: string }) {
  const { telegram } = contactChannels(contactConfig);
  const base =
    "inline-flex w-full items-center justify-center gap-2.5 rounded-full px-7 py-3.5 text-center text-lg font-semibold hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 sm:w-auto";
  const primary = onDark
    ? `${base} bg-accent text-brand-deep hover:brightness-105 focus-visible:outline-white`
    : `${base} bg-brand text-white hover:bg-brand-strong focus-visible:outline-brand`;
  const secondary = onDark
    ? `${base} border border-white/40 text-white hover:bg-white/10 focus-visible:outline-white`
    : `${base} border border-line-strong bg-surface text-ink hover:border-brand focus-visible:outline-brand`;

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 ${className}`}>
      <Link href="/contact" className={primary}>
        {/* A no-break space keeps the arrow with its word on narrow screens. */}
        Tell us where you&apos;re stuck&nbsp;→
      </Link>
      {telegram && (
        <a href={telegram.href} target="_blank" rel="noopener noreferrer" className={secondary}>
          <TelegramIcon className="size-6" />
          Message us on Telegram
        </a>
      )}
    </div>
  );
}
