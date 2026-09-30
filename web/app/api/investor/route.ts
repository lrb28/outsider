import { NextRequest, NextResponse } from "next/server";
import { dataResponse } from "@/lib/apiResponse";
import { getInvestor } from "@/lib/queries";
import { sampleInvestor } from "@/lib/sampleData";
import { textParam, SYMBOL_RE } from "@/lib/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let value: string;
  try {
    value = textParam(req.nextUrl.searchParams, "slug", 160) ?? "";
    if (!/^[a-z0-9-]+$/.test(value)) throw new Error();
  } catch { return NextResponse.json({ error: "Invalid identifier." }, { status: 400 }); }
  return dataResponse(async () => ({ investor: await getInvestor(value) }), () => ({ investor: sampleInvestor(value) }));
}
