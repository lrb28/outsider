import { NextRequest, NextResponse } from "next/server";

import { getStock } from "@/lib/queries";
import { sampleStock } from "@/lib/sampleData";
import { StockResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker") || "";
  try {
    const stock = await getStock(ticker);
    const body: StockResponse = { source: "database", stock };
    return NextResponse.json(body);
  } catch {
    const body: StockResponse = { source: "sample", stock: sampleStock(ticker) };
    return NextResponse.json(body);
  }
}
