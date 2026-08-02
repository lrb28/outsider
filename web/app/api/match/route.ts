import { NextRequest, NextResponse } from "next/server";

import { getMatch } from "@/lib/queries";
import { withRetry } from "@/lib/retry";
import { MatchResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("tickers") || "";
  const tickers = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  try {
    const rows = await withRetry(() => getMatch(tickers));
    return NextResponse.json({ source: "database", rows } as MatchResponse);
  } catch {
    return NextResponse.json({ source: "sample", rows: [] } as MatchResponse);
  }
}
