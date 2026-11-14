import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { siteConfig, trendsConfig } from "@/config";
import { MainNav } from "./_components/main-nav";
import { pageWidth } from "./_components/page-width";
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
    <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line bg-page">
          <div className={`${pageWidth} flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5`}>
            <Link href="/" className="text-lg font-bold tracking-tight text-ink hover:no-underline sm:text-xl">
              {siteConfig.shortName}
            </Link>
            <MainNav />
          </div>
        </header>
        {children}
        <footer className="mt-auto border-t border-line bg-tint">
          <div className={`${pageWidth} py-10 text-sm leading-7 text-ink-2`}>
            <p className="max-w-3xl">
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
