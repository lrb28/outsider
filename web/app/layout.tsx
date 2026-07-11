import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Disclaimer } from "@/components/Disclaimer";

export const metadata: Metadata = {
  title: "Outsider — insider & investor tracker",
  description:
    "Track politician, corporate-insider and institutional trades from official public disclosures.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-edge">
          <div className="mx-auto max-w-5xl px-4 py-4 flex items-baseline gap-3">
            <span className="text-lg font-semibold tracking-tight">Outsider</span>
            <span className="text-xs text-muted">Politiker, Insider und Investoren</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="border-t border-edge mt-10">
          <div className="mx-auto max-w-5xl px-4 py-6">
            <Disclaimer />
          </div>
        </footer>
      </body>
    </html>
  );
}
