import { NextResponse } from "next/server";

import { withRetry } from "@/lib/retry";
import { getStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await withRetry(() => getStats()));
  } catch {
    // no DB yet -> sample counts so the header still renders
    return NextResponse.json({
      entities: 4,
      institutions: 1,
      insiders: 1,
      politicians: 2,
      trades: 27,
    });
  }
}
