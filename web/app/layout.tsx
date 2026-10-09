import "./globals.css";

import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { isDemoMode } from "@/lib/dataMode";
import { StorageNotice } from "@/components/StorageNotice";

import { Disclaimer } from "@/components/Disclaimer";
import { BottomNav, Nav } from "@/components/Nav";
import { Onboarding } from "@/components/Onboarding";
import { SampleBanner } from "@/components/SampleBanner";
import { SearchBox } from "@/components/SearchBox";
import { SwipeNav } from "@/components/SwipeNav";
import { Wordmark } from "@/components/Wordmark";
import { THEME_BOOT } from "@/lib/theme";

const DESC =
  "What investors, corporate insiders and members of the US House disclose — clear, sourced and with a transparent data status.";

export const metadata: Metadata = {
  metadataBase: new URL("https://outsider-tracker.vercel.app"),
  title: {
    default: "ĀURA — investors, insiders and politicians",
    template: "%s · ĀURA",
  },
  description: DESC,
  applicationName: "AURA",
  manifest: "/manifest.webmanifest",
  // The website icon is the app icon: the Ā tile in black on white, or white
  // on black in dark mode (icon.svg switches by itself; favicon.ico is the
  // light tile for browsers without SVG tab icons, such as Safari). Listed
  // here because an `icons` entry replaces Next's automatic icon links.
  // sizes="32x32" on the ICO keeps Chrome on the SVG.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180" },
      { url: "/apple-touch-icon-dark.png", sizes: "180x180", media: "(prefers-color-scheme: dark)" },
    ],
  },
  // The Home Screen app runs full screen, under the clock and battery, so
  // the welcome silk fills the whole display (user, 2026-10-07). iOS then
  // shows those in white everywhere; the header and the set-up leave room
  // for them with env(safe-area-inset-top). Takes effect once the icon is
  // removed and added again.
  appleWebApp: { capable: true, title: "AURA", statusBarStyle: "black-translucent" },
  other: { "apple-mobile-web-app-capable": "yes" },
  openGraph: {
    title: "ĀURA — understand public disclosures",
    description: DESC,
    siteName: "AURA",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "ĀURA — understand public disclosures",
    description: DESC,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script may set data-theme before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen text-ink">
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <a href="#main" className="skip-link">Skip to content</a>
        {/* Floating navigation layer (HIG): separate glass elements over a
            soft scroll-edge fade, no full-width bar. */}
        <header data-site-header className="sticky top-0 z-20">
          <div aria-hidden="true" className="scroll-edge-top pointer-events-none absolute inset-x-0 top-0 h-24" />
          <div className="relative mx-auto flex max-w-5xl items-center gap-3 px-4 py-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
            <Link href="/" aria-label="AURA – home" className="press-sm flex min-h-11 items-center text-ink">
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

        <main id="main" tabIndex={-1} className="mx-auto max-w-5xl px-4 pb-6 pt-4 md:pb-10">{children}</main>

        <BottomNav />
        <SwipeNav />
        <Onboarding />

        <footer className="mt-12">
          <div className="mx-auto max-w-5xl px-4 py-6 pb-28 md:pb-10">
            <div className="flex flex-col gap-5 border-t border-hair pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <Wordmark height={13} className="text-subtle" />
                <nav aria-label="Information" className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-subtle">
                  <Link href="/methodik" className="hover:text-ink">Sources & methodology</Link>
                  <Link href="/status" className="hover:text-ink">Data status</Link>
                  <Link href="/datenschutz" className="hover:text-ink">Privacy</Link>
                  <Link href="/?welcome=1" className="hover:text-ink">Introduction</Link>
                </nav>
              </div>
              <Disclaimer />
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
