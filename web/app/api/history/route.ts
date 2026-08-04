import { NextRequest, NextResponse } from "next/server";

import { getPrices } from "@/lib/queries";
import { withRetry } from "@/lib/retry";

// Tages-Kurshistorie + Dividenden für beliebige Ticker.
//
// Warum diese Route zusätzlich zu /api/prices existiert: unsere Datenbank kennt
// nur Kurse für Papiere, die von den verfolgten Investoren gehalten werden. Fürs
// eigene Depot braucht man aber jede Aktie und jeden ETF. Yahoo liefert beides
// inklusive Ausschüttungshistorie; die Datenbank bleibt als Rückfallebene.
export const dynamic = "force-dynamic";

export interface HistoryBar {
  date: string;
  close: number;
}

export interface DividendEvent {
  date: string;
  amount: number; // je Stück, in Notierungswährung
}

export interface HistoryEntry {
  ticker: string;
  source: "yahoo" | "database" | "none";
  bars: HistoryBar[];
  dividends: DividendEvent[];
  currency: string | null;
  name: string | null;
}

// Erlaubt auch Devisenpaare (EURUSD=X), Indizes (^GSPC) und Krypto (BTC-USD).
const TICKER_RE = /^[\^]?[A-Z0-9][A-Z0-9.\-=]{0,11}$/;
const RANGES = new Set(["1y", "2y", "5y", "10y", "max"]);
const TTL = 15 * 60_000;

const cache = new Map<string, { at: number; e: HistoryEntry }>();

interface YahooChart {
  chart?: {
    result?: {
      meta?: {
        currency?: string;
        longName?: string;
        shortName?: string;
        instrumentType?: string;
      };
      timestamp?: number[];
      events?: { dividends?: Record<string, { amount?: number; date?: number }> };
      indicators?: { quote?: { close?: (number | null)[] }[] };
    }[];
  };
}

const iso = (epochSeconds: number) => new Date(epochSeconds * 1000).toISOString().slice(0, 10);

async function fromYahoo(ticker: string, range: string): Promise<HistoryEntry | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        ticker,
      )}?range=${range}&interval=1d&events=div`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (outsider-tracker)" },
        cache: "no-store",
        // Ein hängender Aufruf darf nicht den ganzen Stapel blockieren.
        signal: AbortSignal.timeout(6_000),
      },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as YahooChart;
    const r = j.chart?.result?.[0];
    const ts = r?.timestamp;
    const closes = r?.indicators?.quote?.[0]?.close;
    if (!ts || !closes || ts.length === 0) return null;

    // Ein Handelstag pro Datum, letzter Kurs gewinnt (Yahoo liefert bei
    // laufender Sitzung gelegentlich einen zusätzlichen Teilbalken).
    const byDate = new Map<string, number>();
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (typeof c === "number" && Number.isFinite(c) && c > 0) byDate.set(iso(ts[i]), c);
    }
    const bars = [...byDate.entries()]
      .map(([date, close]) => ({ date, close }))
      .sort((a, b) => a.date.localeCompare(b.date));
    if (bars.length < 2) return null;

    const divs = r?.events?.dividends ?? {};
    const dividends: DividendEvent[] = Object.values(divs)
      .filter((d) => typeof d.amount === "number" && typeof d.date === "number")
      .map((d) => ({ date: iso(d.date as number), amount: d.amount as number }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      ticker,
      source: "yahoo",
      bars,
      dividends,
      currency: r?.meta?.currency ?? null,
      name: r?.meta?.longName ?? r?.meta?.shortName ?? null,
    };
  } catch {
    return null;
  }
}

async function fromDb(ticker: string): Promise<HistoryEntry | null> {
  try {
    const bars = await withRetry(() => getPrices(ticker));
    if (bars.length < 2) return null;
    return { ticker, source: "database", bars, dividends: [], currency: "USD", name: null };
  } catch {
    return null;
  }
}

async function load(ticker: string, range: string): Promise<HistoryEntry> {
  const key = `${ticker}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.e;

  const e =
    (await fromYahoo(ticker, range)) ??
    (await fromDb(ticker)) ??
    ({ ticker, source: "none", bars: [], dividends: [], currency: null, name: null } as HistoryEntry);

  // Fehlschläge nur kurz merken, damit ein Aussetzer nicht 15 Minuten klebt.
  cache.set(key, { at: e.source === "none" ? Date.now() - TTL + 60_000 : Date.now(), e });
  return e;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const raw = p.get("tickers") || p.get("ticker") || "";
  const range = RANGES.has(p.get("range") || "") ? (p.get("range") as string) : "5y";

  const tickers = [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => TICKER_RE.test(t)),
    ),
  ].slice(0, 40);

  if (tickers.length === 0) {
    return NextResponse.json({ range, entries: {} as Record<string, HistoryEntry> });
  }

  // In Schüben laden, damit wir Yahoo nicht mit 40 gleichzeitigen Anfragen treffen.
  const entries: Record<string, HistoryEntry> = {};
  const CHUNK = 10;
  for (let i = 0; i < tickers.length; i += CHUNK) {
    const part = await Promise.all(tickers.slice(i, i + CHUNK).map((t) => load(t, range)));
    for (const e of part) entries[e.ticker] = e;
  }

  return NextResponse.json(
    { range, entries },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
