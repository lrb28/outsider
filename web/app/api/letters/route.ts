import { NextRequest, NextResponse } from "next/server";
import { dataResponse } from "@/lib/apiResponse";
import { enumParam, integerParam, SYMBOL_RE, textParam } from "@/lib/apiValidation";
import { getLetters, LetterFilters } from "@/lib/queries";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  let f: LetterFilters;
  try {
    const p = req.nextUrl.searchParams;
    const investor = textParam(p, "investor", 160);
    const ticker = textParam(p, "ticker", 20)?.toUpperCase();
    if (investor && !/^[a-z0-9-]+$/.test(investor)) throw new Error("Invalid parameter: investor.");
    if (ticker && !SYMBOL_RE.test(ticker)) throw new Error("Invalid parameter: ticker.");
    f = {
      investor, ticker,
      stance: enumParam(p, "stance", ["bullish", "neutral", "bearish"]),
      limit: integerParam(p, "limit", 30, 1, 100), offset: integerParam(p, "offset", 0, 0, 10000),
    };
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid filters." }, { status: 400 }); }
  // Letters only exist with a database; sample mode has none.
  return dataResponse(async () => ({ rows: await getLetters(f) }), () => ({ rows: [] }));
}
