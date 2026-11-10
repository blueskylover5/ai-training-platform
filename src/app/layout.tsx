import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { siteConfig, trendsConfig } from "@/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: siteConfig.name,
  description: siteConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const { credit } = trendsConfig;
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
            <Link href="/" className="font-semibold tracking-tight text-ink hover:no-underline">
              {siteConfig.shortName}
            </Link>
            <nav aria-label="Main" className="flex gap-5 text-sm">
              <Link href="/" aria-current="page" className="text-ink">
                Trends
              </Link>
              <span className="text-ink-3" title="Coming soon">
                Experts
              </span>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 text-xs leading-5 text-ink-2 sm:px-6">
            <p>
              Trend figures come from <a href={credit.url}>{credit.name}</a>, licensed under{" "}
              <a href={credit.licenseUrl}>{credit.license}</a>. We publish summaries only, not individual roles, and
              are not affiliated with AITraining.jobs or any hiring platform.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
