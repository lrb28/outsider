import { NextRequest, NextResponse } from "next/server";
import { dataResponse } from "@/lib/apiResponse";
import { symbolList } from "@/lib/apiValidation";
import { getMatch } from "@/lib/queries";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  let tickers: string[];
  try { tickers = symbolList(req.nextUrl.searchParams.get("tickers") || "", 200); }
  catch { return NextResponse.json({ error: "Invalid selection of securities." }, { status: 400 }); }
  return dataResponse(async () => ({ rows: await getMatch(tickers) }), () => ({ rows: [] }));
}
