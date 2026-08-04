import { NextRequest, NextResponse } from "next/server";

// Near-realtime quotes, proxied server-side from Yahoo Finance's public chart
// endpoint (browsers can't call it directly because of CORS). Cached in-memory
// for 60s per ticker so bursts don't hammer Yahoo. Best-effort: tickers that
// fail are simply absent — the UI falls back to our EOD closes.
export const dynamic = "force-dynamic";

export interface Quote {
  price: number;
  prevClose: number | null;
  changePct: number | null; // vs previous close (i.e. "today")
  currency: string | null;
  marketState: string | null; // PRE | REGULAR | POST | CLOSED ...
  t: number; // epoch ms of the quote
}

const cache = new Map<string, { at: number; q: Quote }>();
// 15 s: der Client fragt alle 20 s, der Cache darf also nicht länger halten,
// sonst sieht man denselben Kurs zweimal.
const TTL = 15_000;

async function fetchQuote(ticker: string): Promise<Quote | null> {
  const hit = cache.get(ticker);
  if (hit && Date.now() - hit.at < TTL) return hit.q;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        ticker,
      )}?range=1d&interval=5m`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (outsider-tracker)" },
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      chart?: { result?: { meta?: Record<string, unknown> }[] };
    };
    const meta = j.chart?.result?.[0]?.meta as
      | {
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          previousClose?: number;
          currency?: string;
          marketState?: string;
          regularMarketTime?: number;
        }
      | undefined;
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number") return null;
    const prev =
      typeof meta?.previousClose === "number"
        ? meta.previousClose
        : typeof meta?.chartPreviousClose === "number"
        ? meta.chartPreviousClose
        : null;
    const q: Quote = {
      price,
      prevClose: prev,
      changePct: prev ? (price - prev) / prev : null,
      currency: meta?.currency ?? null,
      marketState: meta?.marketState ?? null,
      t: (meta?.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000,
    };
    cache.set(ticker, { at: Date.now(), q });
    return q;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("tickers") || "";
  const tickers = [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z][A-Z0-9.\-]{0,7}$/.test(t)),
    ),
  ].slice(0, 30);

  const entries = await Promise.all(
    tickers.map(async (t) => [t, await fetchQuote(t)] as const),
  );
  const quotes: Record<string, Quote> = {};
  for (const [t, q] of entries) if (q) quotes[t] = q;

  return NextResponse.json(
    { source: "yahoo", quotes },
    { headers: { "Cache-Control": "public, max-age=30" } },
  );
}
