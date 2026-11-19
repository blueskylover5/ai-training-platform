import { contactConfig } from "@/config";
import { contactChannels } from "@/contact/channels";
import { DiscordIcon, TelegramIcon } from "./brand-icons";
import { DiscordHandle } from "./discord-handle";

/** True when at least one chat channel is set up (CON-05). */
export function hasChatChannels(): boolean {
  const { telegram, discord } = contactChannels(contactConfig);
  return Boolean(telegram || discord);
}

/**
 * The Telegram and Discord buttons (CON-05), on the Contact us page and the home page. Each appears
 * only once it is set in the configuration.
 */
export function ChatChannels({ className = "" }: { className?: string }) {
  const { telegram, discord } = contactChannels(contactConfig);
  if (!telegram && !discord) return null;
  return (
    <ul role="list" className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${className}`}>
      {telegram && (
        <li>
          <a
            href={telegram.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-surface px-6 py-3.5 text-base font-semibold text-ink hover:border-brand hover:no-underline sm:w-auto"
          >
            <TelegramIcon className="size-6" />
            Message us on Telegram
          </a>
        </li>
      )}
      {discord && (
        <li>
          <DiscordHandle username={discord.username} profileUrl={discord.profileUrl} icon={<DiscordIcon className="size-6" />} />
        </li>
      )}
    </ul>
  );
}
