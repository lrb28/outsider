import { NextRequest, NextResponse } from "next/server";

import { getTrades } from "@/lib/queries";
import { SAMPLE_TRADES } from "@/lib/sampleData";
import { TradesResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || undefined;
  const q = sp.get("q") || undefined;
  const txnType = sp.get("txnType") || undefined;
  const limit = Math.min(Number(sp.get("limit") ?? 50) || 50, 200);
  const offset = Math.max(Number(sp.get("offset") ?? 0) || 0, 0);

  try {
    const rows = await getTrades({ type, q, txnType, limit, offset });
    const body: TradesResponse = {
      source: "database",
      rows,
      nextOffset: rows.length === limit ? offset + limit : null,
    };
    return NextResponse.json(body);
  } catch (e) {
    // No DB configured yet (or a query error) -> serve bundled sample data so
    // the page is never blank. Ingestion replaces this with live rows.
    let rows = SAMPLE_TRADES.slice();
    if (type) rows = rows.filter((r) => r.entityType === type);
    if (txnType) rows = rows.filter((r) => r.txnType === txnType);
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.entityName.toLowerCase().includes(needle) ||
          (r.ticker ?? "").toLowerCase().includes(needle) ||
          r.securityName.toLowerCase().includes(needle),
      );
    }
    const body: TradesResponse = {
      source: "sample",
      rows: rows.slice(offset, offset + limit),
      nextOffset: null,
      note: e instanceof Error ? e.message : "sample data",
    };
    return NextResponse.json(body);
  }
}
