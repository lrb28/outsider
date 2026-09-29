import { NextRequest, NextResponse } from "next/server";

import { SYMBOL_RE } from "@/lib/instruments";
import { limitUpstream } from "@/lib/rateLimit";
import type { ListingMeta } from "@/lib/sectors";

// Symbol → what kind of paper it is and, for shares, its sector. Feeds the
// Depot's split by sector, region and asset class for everything the curated
// list in lib/sectors.ts does not know. Yahoo's search returns sector and
// industry for equities and the quote type (ETF, EQUITY, …) for everything.
export const dynamic = "force-dynamic";

const TTL = 7 * 24 * 60 * 60_000;
const cache = new Map<string, { at: number; meta: ListingMeta | null }>();

interface YahooSearch {
  quotes?: { symbol?: string; quoteType?: string; sector?: string; industry?: string; exchange?: string }[];
}

async function lookup(symbol: string): Promise<ListingMeta | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < TTL) return hit.meta;
  let meta: ListingMeta | null = null;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=6&newsCount=0&listsCount=0`,
      { headers: { "User-Agent": "Mozilla/5.0 (aura-tracker)" }, cache: "no-store", signal: AbortSignal.timeout(6_000) },
    );
    if (res.ok) {
      const j = (await res.json()) as YahooSearch;
      const q = (j.quotes ?? []).find((x) => x.symbol?.toUpperCase() === symbol);
      if (q) meta = { type: q.quoteType ?? null, sector: q.sector ?? null, industry: q.industry ?? null, exchange: q.exchange ?? null };
    }
  } catch {
    meta = null;
  }
  if (cache.size >= 2000) cache.delete(cache.keys().next().value!);
  // Misses are kept briefly, so an outage does not stick for a week.
  cache.set(symbol, { at: meta ? Date.now() : Date.now() - TTL + 10 * 60_000, meta });
  return meta;
}

export async function GET(req: NextRequest) {
  const limited = limitUpstream("meta", req);
  if (limited) return limited;
  const raw = req.nextUrl.searchParams.get("symbols") || "";
  const symbols = [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (symbols.length > 60 || symbols.some((s) => !SYMBOL_RE.test(s)))
    return NextResponse.json({ error: "Maximal 60 gültige Symbole pro Anfrage." }, { status: 400 });

  const meta: Record<string, ListingMeta> = {};
  const CHUNK = 10;
  for (let i = 0; i < symbols.length; i += CHUNK) {
    const part = await Promise.all(symbols.slice(i, i + CHUNK).map(async (s) => [s, await lookup(s)] as const));
    for (const [s, m] of part) if (m) meta[s] = m;
  }
  return NextResponse.json({ meta }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
