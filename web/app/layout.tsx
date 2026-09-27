import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { isDemoMode } from "@/lib/dataMode";
import { StorageNotice } from "@/components/StorageNotice";

import { Disclaimer } from "@/components/Disclaimer";
import { LiquidLogo } from "@/components/LiquidLogo";
import { BottomNav, Nav } from "@/components/Nav";
import { SampleBanner } from "@/components/SampleBanner";
import { SearchBox } from "@/components/SearchBox";

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
    <html lang="de">
      <body className="min-h-screen text-ink">
        <a href="#main" className="skip-link">Zum Inhalt springen</a>
        <header className="glass sticky top-0 z-20 !rounded-none !border-x-0 !border-t-0">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link href="/" aria-label="Outsider – Startseite" className="press-sm flex items-center gap-2">
              <LiquidLogo size={34} />
              <span className="text-lg font-semibold tracking-tight">Outsider</span>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <SearchBox />
              <Nav />
            </div>
          </div>
        </header>

        <SampleBanner enabled={isDemoMode()} />
        <StorageNotice />

        <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-10">{children}</main>

        <BottomNav />

        <footer className="mt-12 border-t border-white/70 bg-white/55">
          <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-6">
            <nav aria-label="Informationen" className="mb-5 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium"><Link href="/methodik">Quellen & Methodik</Link><Link href="/status">Datenstand</Link><Link href="/datenschutz">Datenschutz</Link></nav>
            <Disclaimer />
          </div>
        </footer>
      </body>
    </html>
  );
}
