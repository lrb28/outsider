import { NextRequest, NextResponse } from "next/server";
import { dataResponse } from "@/lib/apiResponse";
import { textParam } from "@/lib/apiValidation";
import { getLetter } from "@/lib/queries";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  let slug: string;
  try {
    slug = textParam(req.nextUrl.searchParams, "slug", 160) ?? "";
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error();
  } catch { return NextResponse.json({ error: "Invalid identifier." }, { status: 400 }); }
  return dataResponse(async () => ({ letter: await getLetter(slug) }), () => ({ letter: null }));
}
