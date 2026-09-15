import { dataResponse } from "@/lib/apiResponse";
import { getStats } from "@/lib/stats";
import { SAMPLE_TRADES, SAMPLE_INVESTORS, SAMPLE_POLITICIANS } from "@/lib/sampleData";
export const dynamic = "force-dynamic";
export async function GET() {
  return dataResponse(getStats, () => ({
    entities: new Set(SAMPLE_TRADES.map(r => r.entityName)).size,
    institutions: SAMPLE_INVESTORS.length, insiders: new Set(SAMPLE_TRADES.filter(r => r.entityType === "corporate_insider").map(r => r.entityName)).size,
    politicians: SAMPLE_POLITICIANS.length, trades: SAMPLE_TRADES.length,
    latestDisclosure: null, latestPrice: null, priceSymbols: 0, freshPriceSymbols: 0, groups: [],
  }));
}
