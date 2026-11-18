import { contactConfig } from "@/config";
import { contactChannels } from "@/contact/channels";
import { pageWidth } from "../_components/page-width";
import { ContactForm, type ContactFormSettings } from "./contact-form";
import { DiscordHandle } from "./discord-handle";

/** The Contact us page's content: who to contact when AI training isn't working out (CON-01 to CON-06). */
export function ContactSection() {
  const settings: ContactFormSettings = {
    nameMaxChars: contactConfig.nameMaxChars,
    emailMaxChars: contactConfig.emailMaxChars,
    messageMinChars: contactConfig.messageMinChars,
    messageMaxChars: contactConfig.messageMaxChars,
    honeypotField: contactConfig.honeypotField,
  };
  // CON-05: a channel appears only once it is set in the configuration.
  const { telegram, discord } = contactChannels(contactConfig);

  return (
    <section id="contact" aria-labelledby="contact-heading" className="bg-tint py-14 sm:py-20 lg:py-24">
      <div className={`${pageWidth} grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}>
        <div>
          <h1 id="contact-heading" className="text-3xl leading-tight font-bold tracking-tight text-balance text-ink sm:text-4xl lg:text-[2.75rem]">
            Struggling with AI training? Talk to us.
          </h1>
          <p className="mt-5 text-lg leading-8 text-ink-2 sm:text-xl sm:leading-9">
            If AI training feels hard, or something in your field is stopping you from earning, reach out. Tell us where
            you&apos;re stuck and we&apos;ll work through it with you until you have a complete solution.
          </p>

          {(telegram || discord) && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold text-ink">Prefer to chat?</h2>
              <ul role="list" className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {telegram && (
                  <li>
                    <a
                      href={telegram.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-surface px-6 py-3.5 text-base font-semibold text-ink hover:border-ink hover:no-underline sm:w-auto"
                    >
                      <PaperPlane />
                      Message us on Telegram
                    </a>
                  </li>
                )}
                {discord && (
                  <li>
                    <DiscordHandle username={discord.username} profileUrl={discord.profileUrl} icon={<ChatBubbles />} />
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-line bg-surface p-6 shadow-[0_8px_30px_rgba(11,11,11,0.06)] sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Send us a message</h2>
          <p className="mt-2 mb-8 text-base leading-7 text-ink-2">We read every message and reply by email.</p>
          <ContactForm settings={settings} />
        </div>
      </div>
    </section>
  );
}

function PaperPlane() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M21.5 3.5 2.5 11l7 2.5m12-10-4 17-8-7m12-10-12 10m0 0v6l3.5-3.5" />
    </svg>
  );
}

function ChatBubbles() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      <path d="M17 9h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-4-3h-3a2 2 0 0 1-2-1.5" />
    </svg>
  );
}
