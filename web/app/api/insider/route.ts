import { NextRequest, NextResponse } from "next/server";

import { getInsider } from "@/lib/queries";
import { sampleInsider } from "@/lib/sampleData";
import { InsiderResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") || "";
  try {
    const insider = await getInsider(slug);
    return NextResponse.json({ source: "database", insider } as InsiderResponse);
  } catch {
    return NextResponse.json({ source: "sample", insider: sampleInsider(slug) } as InsiderResponse);
  }
}
