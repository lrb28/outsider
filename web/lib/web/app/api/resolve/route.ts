import { NextRequest, NextResponse } from "next/server";

// ISIN → Börsenkürzel. Broker-Exporte kennen nur die ISIN; für Kurse brauchen
// wir ein Symbol. Yahoos Suchendpunkt kann beides verbinden.
//
// Wichtig: bei mehreren Notierungen desselben Papiers wählen wir bewusst eine
// aus (US-Heimatbörse für US-Papiere, sonst die Notierung in der Währung des
// Depots). Ohne diese Regel landet man schnell bei einer illiquiden
// Zweitnotiz in einer dritten Währung.
export const dynamic = "force-dynamic";

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const TTL = 24 * 60 * 60_000;

const cache = new Map<string, { at: number; symbol: string | null }>();

interface YahooSearch {
  quotes?: {
    symbol?: string;
    exchange?: string;
    quoteType?: string;
    longname?: string;
    shortname?: string;
    isYahooFinance?: boolean;
  }[];
}

// Börsenplatz-Ranking. Kleinere Zahl = bevorzugt.
const EXCHANGE_RANK: Record<string, number> = {
  NMS: 1, NGM: 1, NYQ: 1, PCX: 2, ASE: 2, BTS: 3, // USA
  GER: 4, FRA: 5, STU: 6, MUN: 7, BER: 7, HAM: 7, DUS: 6, // Deutschland
  AMS: 4, PAR: 4, EBS: 4, MIL: 5, MCE: 5, VIE: 6, // Euro-Raum
  LSE: 8, // London notiert oft in Pence — nur als Notlösung
  CCC: 2, CCY: 2, // Krypto / Devisen
};

function pick(quotes: NonNullable<YahooSearch["quotes"]>, prefer: "US" | "EU"): string | null {
  const usable = quotes.filter(
    (q) =>
      q.symbol &&
      q.isYahooFinance !== false &&
      q.quoteType &&
      ["EQUITY", "ETF", "MUTUALFUND", "CRYPTOCURRENCY", "INDEX", "CURRENCY"].includes(q.quoteType),
  );
  if (usable.length === 0) return null;

  const score = (q: (typeof usable)[number]) => {
    let s = EXCHANGE_RANK[q.exchange ?? ""] ?? 9;
    // Bei europäischen Papieren die Heimatbörse leicht bevorzugen und
    // umgekehrt — verhindert, dass eine US-Aktie über Stuttgart gepreist wird.
    const isUsListing = ["NMS", "NGM", "NYQ", "PCX", "ASE", "BTS"].includes(q.exchange ?? "");
    if (prefer === "US" && isUsListing) s -= 2;
    if (prefer === "EU" && !isUsListing) s -= 2;
    // Symbole ohne Börsensuffix sind meist die Hauptnotiz.
    if (!(q.symbol ?? "").includes(".")) s -= 0.5;
    return s;
  };

  return [...usable].sort((a, b) => score(a) - score(b))[0].symbol ?? null;
}

async function lookup(id: string): Promise<string | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.symbol;

  let symbol: string | null = null;
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        id,
      )}&quotesCount=10&newsCount=0&listsCount=0`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (outsider-tracker)" },
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      },
    );
    if (res.ok) {
      const j = (await res.json()) as YahooSearch;
      // US-ISINs zeigen auf die US-Heimatbörse, alles andere auf Europa.
      symbol = pick(j.quotes ?? [], id.startsWith("US") ? "US" : "EU");
    }
  } catch {
    symbol = null;
  }

  // Fehlversuche nur kurz merken, damit ein Aussetzer nicht 24 h klebt.
  cache.set(id, { at: symbol ? Date.now() : Date.now() - TTL + 5 * 60_000, symbol });
  return symbol;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("ids") || "";
  const ids = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => ISIN_RE.test(s)),
    ),
  ].slice(0, 60);

  if (ids.length === 0) return NextResponse.json({ symbols: {} });

  const symbols: Record<string, string> = {};
  const CHUNK = 6;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = await Promise.all(
      ids.slice(i, i + CHUNK).map(async (id) => [id, await lookup(id)] as const),
    );
    for (const [id, sym] of part) if (sym) symbols[id] = sym;
  }

  return NextResponse.json(
    { symbols },
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
