import { contactConfig } from "@/config";
import { ChatChannels, hasChatChannels } from "../_components/chat-channels";
import { pageWidth } from "../_components/page-width";
import { ContactForm, type ContactFormSettings } from "./contact-form";

/** The Contact us page's content: who to contact when AI training isn't working out (CON-01 to CON-06). */
export function ContactSection() {
  const settings: ContactFormSettings = {
    nameMaxChars: contactConfig.nameMaxChars,
    emailMaxChars: contactConfig.emailMaxChars,
    messageMinChars: contactConfig.messageMinChars,
    messageMaxChars: contactConfig.messageMaxChars,
    honeypotField: contactConfig.honeypotField,
  };

  return (
    <section id="contact" aria-labelledby="contact-heading" className="bg-brand-wash py-14 sm:py-20 lg:py-24">
      <div className={`${pageWidth} grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}>
        <div>
          <h1 id="contact-heading" className="text-3xl leading-tight font-bold tracking-tight text-balance text-ink sm:text-4xl lg:text-[2.75rem]">
            Struggling with AI training? Talk to us.
          </h1>
          <p className="mt-5 text-lg leading-8 text-ink-2 sm:text-xl sm:leading-9">
            If AI training feels hard, or something in your field is stopping you from earning, reach out. Tell us where
            you&apos;re stuck and we&apos;ll work through it with you until you have a complete solution.
          </p>
          {/* No hero button here (owner's request): the form and the chat buttons are right here. */}

          {hasChatChannels() && (
            <div className="mt-10">
              <h2 className="text-lg font-semibold text-ink">Prefer to chat?</h2>
              <ChatChannels className="mt-4" />
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
