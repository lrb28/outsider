import { NextRequest, NextResponse } from "next/server";
import { InputError, symbolList } from "@/lib/apiValidation";
import { limitUpstream } from "@/lib/rateLimit";

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
const TTL = 60_000;

// Wird ein Börsenplatz eingestellt, liefert Yahoo weiter den allerletzten Kurs —
// ohne Hinweis, dass er Monate alt ist. Als „aktuell" angezeigt ergäbe das einen
// falschen Depotwert. Zehn Tage überbrücken Feiertage und Handelspausen; alles
// Ältere wird verworfen, dann fällt die Anzeige auf den Schlusskurs zurück oder
// weist die Position ehrlich als kurslos aus.
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

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
        signal: AbortSignal.timeout(6000),
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
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || !meta?.regularMarketTime) return null;
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
      t: meta.regularMarketTime * 1000,
    };
    if (!Number.isFinite(q.t) || q.t > Date.now() + 300_000 || Date.now() - q.t > MAX_AGE) return null;
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(ticker, { at: Date.now(), q });
    return q;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const limited = limitUpstream("quotes", req);
  if (limited) return limited;
  let tickers: string[];
  try { tickers = symbolList(req.nextUrl.searchParams.get("tickers") || "", 30); }
  catch (error) { return NextResponse.json({ error: error instanceof InputError ? error.message : "Ungültige Anfrage" }, { status: 400 }); }

  const entries = await Promise.all(
    tickers.map(async (t) => [t, await fetchQuote(t)] as const),
  );
  const quotes: Record<string, Quote> = {};
  for (const [t, q] of entries) if (q) quotes[t] = q;

  return NextResponse.json(
    { source: "yahoo", quotes, missing: tickers.filter(t => !quotes[t]), fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
