import "./globals.css";

import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import { isDemoMode } from "@/lib/dataMode";
import { StorageNotice } from "@/components/StorageNotice";

import { Disclaimer } from "@/components/Disclaimer";
import { BottomNav, Nav } from "@/components/Nav";
import { SampleBanner } from "@/components/SampleBanner";
import { SearchBox } from "@/components/SearchBox";
import { Wordmark } from "@/components/Wordmark";

// Geometric display face for headings and big numerals (RonDesignLab style).
const display = Urbanist({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "600", "700"], variable: "--font-display", display: "swap" });

const DESC =
  "Öffentliche Meldungen von Investoren, Unternehmensinsidern und US-Politikern verstehen. Mit Quellen, Berichtszeiträumen und transparentem Datenstand.";

export const metadata: Metadata = {
  metadataBase: new URL("https://outsider-tracker.vercel.app"),
  title: {
    default: "Outsider — Politiker, Insider und Investoren",
    template: "%s · Outsider",
  },
  description: DESC,
  applicationName: "Outsider",
  openGraph: {
    title: "Outsider — öffentliche Meldungen verstehen",
    description: DESC,
    siteName: "Outsider",
    type: "website",
    locale: "de_DE",
  },
  twitter: {
    card: "summary_large_image",
    title: "Outsider — öffentliche Meldungen verstehen",
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" className={display.variable}>
      <body className="min-h-screen text-ink">
        <a href="#main" className="skip-link">Zum Inhalt springen</a>
        {/* Floating navigation layer (Apple HIG): no full-width glass bar, just
            separate glass elements over a soft scroll-edge fade. */}
        <header className="sticky top-0 z-20">
          <div aria-hidden="true" data-liquid-glass-skip="" className="scroll-edge-top pointer-events-none absolute inset-x-0 top-0 h-24" />
          <div className="relative mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <Link href="/" aria-label="Outsider – Startseite" className="press-sm flex min-h-11 items-center">
              <Wordmark height={17} />
            </Link>
            <div className="ml-auto flex items-center gap-2.5">
              <SearchBox />
              <Nav />
            </div>
          </div>
        </header>

        <SampleBanner enabled={isDemoMode()} />
        <StorageNotice />

        <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-10">{children}</main>

        <BottomNav />

        <footer className="mt-12">
          <div className="mx-auto max-w-5xl px-4 py-6 pb-28 md:pb-10">
            <div className="lcard p-5 sm:p-6">
              <nav aria-label="Informationen" className="mb-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium"><Link href="/methodik">Quellen & Methodik</Link><Link href="/status">Datenstand</Link><Link href="/datenschutz">Datenschutz</Link></nav>
              <Disclaimer />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
