import { NextRequest, NextResponse } from "next/server";

import { getPolitician } from "@/lib/queries";
import { withRetry } from "@/lib/retry";
import { samplePolitician } from "@/lib/sampleData";
import { PoliticianResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  try {
    const politician = await withRetry(() => getPolitician(slug));
    return NextResponse.json({ source: "database", politician } as PoliticianResponse);
  } catch {
    return NextResponse.json({ source: "sample", politician: samplePolitician(slug) } as PoliticianResponse);
  }
}
