import { NextResponse } from "next/server";

import { getStocks } from "@/lib/queries";
import { SAMPLE_STOCKS } from "@/lib/sampleData";
import { StocksResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getStocks();
    const body: StocksResponse = { source: "database", rows };
    return NextResponse.json(body);
  } catch {
    const body: StocksResponse = { source: "sample", rows: SAMPLE_STOCKS };
    return NextResponse.json(body);
  }
}
