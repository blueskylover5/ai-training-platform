import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { siteConfig, visitConfig } from "@/config";
import { Logo } from "./_components/logo";
import { MainNav } from "./_components/main-nav";
import { pageWidth } from "./_components/page-width";
import { VisitTracker } from "./_components/visit-tracker";
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
  title: `${siteConfig.shortName} · ${siteConfig.name}`,
  description: siteConfig.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-line bg-page">
          <div className={`${pageWidth} flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5`}>
            <Link href="/" className="hover:no-underline">
              <Logo withName />
            </Link>
            <MainNav />
          </div>
        </header>
        {/* No footer, at the owner's request (19 November 2026). The data credit sits with the figures (TRD-04). */}
        {children}
        <VisitTracker endpoint={visitConfig.endpointPath} />
      </body>
    </html>
  );
}
