import { dataResponse } from "@/lib/apiResponse";
import { getPoliticians } from "@/lib/queries";
import { SAMPLE_POLITICIANS } from "@/lib/sampleData";

export const dynamic = "force-dynamic";

export async function GET() {
  return dataResponse(async () => ({ rows: await getPoliticians() }), () => ({ rows: SAMPLE_POLITICIANS }));
}
