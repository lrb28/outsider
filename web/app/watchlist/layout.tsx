import type { Metadata } from "next";
import type { ReactNode } from "react";

// What you follow lives on this device: nothing here for search engines.
export const metadata: Metadata = { title: "Watchlist", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
