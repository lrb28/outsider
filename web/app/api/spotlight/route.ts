import { dataResponse } from "@/lib/apiResponse";
import { getSpotlight } from "@/lib/queries";
import { SAMPLE_SPOTLIGHT } from "@/lib/sampleData";

// The stocks that take turns behind the portfolio page's pull-to-refresh.
export const dynamic = "force-dynamic";
export async function GET() { return dataResponse(getSpotlight, () => SAMPLE_SPOTLIGHT); }
