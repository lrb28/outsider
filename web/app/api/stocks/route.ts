import { dataResponse } from "@/lib/apiResponse";
import { getStocks } from "@/lib/queries";
import { SAMPLE_STOCKS } from "@/lib/sampleData";

export const dynamic = "force-dynamic";

export async function GET() {
  return dataResponse(async () => ({ rows: await getStocks() }), () => ({ rows: SAMPLE_STOCKS }));
}
