import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Disclaimer } from "@/components/Disclaimer";
import { BottomNav, Nav } from "@/components/Nav";
import { SampleBanner } from "@/components/SampleBanner";
import { SearchBox } from "@/components/SearchBox";

const DESC =
  "Verfolge Trades von Politikern, Konzern-Insidern und Star-Investoren aus offiziellen öffentlichen Offenlegungen — mit Kursentwicklung seit der Meldung.";

export const metadata: Metadata = {
  metadataBase: new URL("https://outsider-tracker.vercel.app"),
  title: {
    default: "Outsider — Politiker, Insider und Investoren",
    template: "%s · Outsider",
  },
  description: DESC,
  applicationName: "Outsider",
  openGraph: {
    title: "Outsider — verfolge das smarte Geld",
    description: DESC,
    siteName: "Outsider",
    type: "website",
    locale: "de_DE",
  },
  twitter: {
    card: "summary_large_image",
    title: "Outsider — verfolge das smarte Geld",
    description: DESC,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen text-ink">
        <header className="sticky top-0 z-20 border-b border-white/40 bg-white/60 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
            <Link href="/" className="press-sm flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-b from-indigo-500 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/30">
                O
              </div>
              <span className="text-lg font-semibold tracking-tight">Outsider</span>
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <SearchBox />
              <Nav />
            </div>
          </div>
        </header>

        <SampleBanner />

        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-10">{children}</main>

        <BottomNav />

        <footer className="mt-12 border-t border-white/50 bg-white/60 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:pb-6">
            <Disclaimer />
          </div>
        </footer>
      </body>
    </html>
  );
}
