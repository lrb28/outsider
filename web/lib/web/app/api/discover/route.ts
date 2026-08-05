import { NextResponse } from "next/server";

import { getDiscover } from "@/lib/queries";
import { withRetry } from "@/lib/retry";
import { SAMPLE_DISCOVER } from "@/lib/sampleData";
import { DiscoverData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const d = await withRetry(() => getDiscover());
    const body: DiscoverData = { source: "database", ...d };
    return NextResponse.json(body);
  } catch {
    const body: DiscoverData = { source: "sample", ...SAMPLE_DISCOVER };
    return NextResponse.json(body);
  }
}
