import Link from "next/link";
import { contactConfig } from "@/config";
import { contactChannels } from "@/contact/channels";
import { TelegramIcon } from "./brand-icons";

/**
 * The call to action in every page's hero (owner's request, 19 November 2026): the main button to
 * Contact us, and Telegram beside it once it is set up (CON-05). `onDark` for heroes on the dark
 * brand background. On the Contact us page, the main button points at the form instead.
 */
export function HeroCta({
  onDark = false,
  href = "/contact",
  // A no-break space keeps the arrow with its word on narrow screens.
  label = "Tell us where you're stuck →",
  withTelegram = true,
  className = "",
}: {
  onDark?: boolean;
  href?: string;
  label?: string;
  /** False where the page already shows the chat buttons nearby (Contact us). */
  withTelegram?: boolean;
  className?: string;
}) {
  const telegram = withTelegram ? contactChannels(contactConfig).telegram : null;
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
      {href.startsWith("#") ? (
        <a href={href} className={primary}>
          {label}
        </a>
      ) : (
        <Link href={href} className={primary}>
          {label}
        </Link>
      )}
      {telegram && (
        <a href={telegram.href} target="_blank" rel="noopener noreferrer" className={secondary}>
          <TelegramIcon className="size-6" />
          Message us on Telegram
        </a>
      )}
    </div>
  );
}
