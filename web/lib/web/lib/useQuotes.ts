"use client";

// Poll near-realtime quotes from our /api/quotes proxy (Yahoo-backed).
// Refreshes every 60s while the tab is visible. Missing tickers simply have
// no entry — callers fall back to EOD closes.
import { useEffect, useState } from "react";

export interface Quote {
  price: number;
  prevClose: number | null;
  changePct: number | null;
  currency: string | null;
  marketState: string | null;
  t: number;
}

// 20 Sekunden: nah genug an "live", ohne Yahoo zu überrennen. Der Abruf pausiert
// automatisch, sobald der Tab im Hintergrund liegt.
export function useQuotes(tickers: string[], intervalMs = 20_000) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const key = [...new Set(tickers.filter(Boolean).map((t) => t.toUpperCase()))]
    .sort()
    .join(",");

  useEffect(() => {
    if (!key) {
      setQuotes({});
      return;
    }
    let on = true;
    const load = () =>
      fetch(`/api/quotes?tickers=${encodeURIComponent(key)}`)
        .then((r) => r.json() as Promise<{ quotes: Record<string, Quote> }>)
        .then((d) => on && setQuotes(d.quotes || {}))
        .catch(() => {});
    load();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, intervalMs);
    return () => {
      on = false;
      clearInterval(id);
    };
  }, [key, intervalMs]);

  return quotes;
}
