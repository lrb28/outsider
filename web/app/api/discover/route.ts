import { dataResponse } from "@/lib/apiResponse";
import { getDiscover } from "@/lib/queries";
import { SAMPLE_DISCOVER } from "@/lib/sampleData";
export const dynamic = "force-dynamic";
export async function GET() { return dataResponse(getDiscover, () => SAMPLE_DISCOVER); }
