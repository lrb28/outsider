import { NextRequest, NextResponse } from "next/server";

import { getInvestor } from "@/lib/queries";
import { withRetry } from "@/lib/retry";
import { sampleInvestor } from "@/lib/sampleData";
import { InvestorResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  try {
    const investor = await withRetry(() => getInvestor(slug));
    const body: InvestorResponse = { source: "database", investor };
    return NextResponse.json(body);
  } catch {
    const body: InvestorResponse = { source: "sample", investor: sampleInvestor(slug) };
    return NextResponse.json(body);
  }
}
