import { NextResponse } from "next/server";

import { getInvestors } from "@/lib/queries";
import { SAMPLE_INVESTORS } from "@/lib/sampleData";
import { InvestorsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getInvestors();
    const body: InvestorsResponse = { source: "database", rows };
    return NextResponse.json(body);
  } catch {
    const body: InvestorsResponse = { source: "sample", rows: SAMPLE_INVESTORS };
    return NextResponse.json(body);
  }
}
