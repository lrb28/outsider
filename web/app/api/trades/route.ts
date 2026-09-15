import { NextRequest, NextResponse } from "next/server";
import { dataResponse } from "@/lib/apiResponse";
import { dateParam, enumParam, integerParam, textParam } from "@/lib/apiValidation";
import { getTrades, TradeFilters } from "@/lib/queries";
import { SAMPLE_TRADES } from "@/lib/sampleData";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  let f: TradeFilters;
  try {
    const p = req.nextUrl.searchParams;
    f = {
      type: enumParam(p, "type", ["institution", "corporate_insider", "politician"]),
      txnType: enumParam(p, "txnType", ["buy", "sell", "exchange", "option"]),
      q: textParam(p, "q"), from: dateParam(p, "from"), to: dateParam(p, "to"),
      limit: integerParam(p, "limit", 50, 1, 200), offset: integerParam(p, "offset", 0, 0, 100000),
    };
    if (f.from && f.to && f.from > f.to) throw new Error("Der Beginn muss vor dem Ende liegen.");
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ungültige Filter." }, { status: 400 }); }
  const limit = f.limit!;
  const offset = f.offset!;
  return dataResponse(async () => {
    const all = await getTrades({ ...f, limit: limit + 1 });
    return { rows: all.slice(0, limit), nextOffset: all.length > limit ? offset + limit : null };
  }, () => {
    const needle = f.q?.toLocaleLowerCase("de");
    const all = SAMPLE_TRADES.filter(r =>
      (!f.type || r.entityType === f.type) && (!f.txnType || r.txnType === f.txnType) &&
      (!f.from || !!r.disclosedAt && r.disclosedAt >= f.from) &&
      (!f.to || !!r.disclosedAt && r.disclosedAt <= f.to) &&
      (!needle || [r.entityName, r.ticker, r.securityName].some(v => v?.toLocaleLowerCase("de").includes(needle)))
    ).sort((a, b) => (b.disclosedAt ?? "").localeCompare(a.disclosedAt ?? "") || String(b.id).localeCompare(String(a.id)));
    return { rows: all.slice(offset, offset + limit), nextOffset: all.length > offset + limit ? offset + limit : null };
  });
}
