import type { Metadata } from "next";
import { siteConfig } from "@/config";
import { ContactSection } from "./contact-section";

export const metadata: Metadata = {
  title: `Contact us: get help with AI training work · ${siteConfig.shortName}`,
  description:
    "Struggling with AI training, or is something in your field stopping you from earning? Send us a message or chat with us on Telegram or Discord. Free, no sign-in.",
};

/** The Contact us page (CON-01 to CON-06). No market data, so it never reads the trends tables. */
export default function ContactPage() {
  return (
    // The grey runs down to the bottom of the window, however tall it is.
    <main className="flex-1 bg-tint">
      <ContactSection />
    </main>
  );
}
