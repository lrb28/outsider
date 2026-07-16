import { NextRequest, NextResponse } from "next/server";

import { getPrices } from "@/lib/queries";
import { PriceBar, PricesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

// Deterministic synthetic series so the sparkline still renders without a DB.
function sampleBars(ticker: string): PriceBar[] {
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed = (seed * 31 + ticker.charCodeAt(i)) % 9973;
  const bars: PriceBar[] = [];
  let v = 80 + (seed % 60);
  const start = new Date();
  start.setDate(start.getDate() - 180);
  for (let i = 0; i < 180; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    v = Math.max(5, v * (1 + ((seed % 1000) / 1000 - 0.48) * 0.04));
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    bars.push({ date: d.toISOString().slice(0, 10), close: Math.round(v * 100) / 100 });
  }
  return bars;
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") || "";
  if (!ticker) {
    return NextResponse.json({ source: "sample", ticker, bars: [] } as PricesResponse);
  }
  try {
    const bars = await getPrices(ticker);
    if (bars.length === 0) {
      return NextResponse.json({ source: "sample", ticker, bars: sampleBars(ticker) } as PricesResponse);
    }
    return NextResponse.json({ source: "database", ticker, bars } as PricesResponse);
  } catch {
    return NextResponse.json({ source: "sample", ticker, bars: sampleBars(ticker) } as PricesResponse);
  }
}
