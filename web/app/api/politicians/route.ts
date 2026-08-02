import { NextResponse } from "next/server";

import { getPoliticians } from "@/lib/queries";
import { withRetry } from "@/lib/retry";
import { SAMPLE_POLITICIANS } from "@/lib/sampleData";
import { PoliticiansResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await withRetry(() => getPoliticians());
    return NextResponse.json({ source: "database", rows } as PoliticiansResponse);
  } catch {
    return NextResponse.json({ source: "sample", rows: SAMPLE_POLITICIANS } as PoliticiansResponse);
  }
}
