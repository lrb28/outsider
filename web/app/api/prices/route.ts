import { NextRequest, NextResponse } from "next/server";
import { dataResponse } from "@/lib/apiResponse";
import { SYMBOL_RE } from "@/lib/apiValidation";
import { getPrices } from "@/lib/queries";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") || "").trim().toUpperCase();
  if (!SYMBOL_RE.test(ticker)) return NextResponse.json({ error: "Ungültiges Börsenkürzel." }, { status: 400 });
  return dataResponse(async () => {
    const bars = await getPrices(ticker);
    const asOf = bars.at(-1)?.date ?? null;
    return { ticker, bars, asOf, stale: asOf ? Date.now() - Date.parse(asOf) > 7 * 86400000 : false };
  }, () => ({ ticker, bars: [], asOf: null, stale: false }));
}
