import { dataResponse } from "@/lib/apiResponse";
import { getInvestors } from "@/lib/queries";
import { SAMPLE_INVESTORS } from "@/lib/sampleData";

export const dynamic = "force-dynamic";

export async function GET() {
  return dataResponse(async () => ({ rows: await getInvestors() }), () => ({ rows: SAMPLE_INVESTORS }));
}
