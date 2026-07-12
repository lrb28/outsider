import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Disclaimer } from "@/components/Disclaimer";

export const metadata: Metadata = {
  title: "Outsider — Politiker, Insider und Investoren",
  description:
    "Verfolge Trades von Politikern, Konzern-Insidern und Star-Investoren aus offiziellen öffentlichen Offenlegungen.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-canvas text-ink">
        <header className="sticky top-0 z-20 border-b border-hair bg-white/85 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white shadow-card">
              O
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-base font-semibold tracking-tight">Outsider</span>
              <span className="text-xs text-subtle">Politiker, Insider und Investoren</span>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>

        <footer className="mt-12 border-t border-hair bg-white">
          <div className="mx-auto max-w-5xl px-4 py-6">
            <Disclaimer />
          </div>
        </footer>
      </body>
    </html>
  );
}
