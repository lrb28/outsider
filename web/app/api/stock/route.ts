import { NextRequest, NextResponse } from "next/server";
import { dataResponse } from "@/lib/apiResponse";
import { getStock } from "@/lib/queries";
import { sampleStock } from "@/lib/sampleData";
import { textParam, SYMBOL_RE } from "@/lib/apiValidation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  let value: string;
  try {
    value = textParam(req.nextUrl.searchParams, "ticker", 160) ?? "";
    value = value.toUpperCase();
    if (!SYMBOL_RE.test(value)) throw new Error();
  } catch { return NextResponse.json({ error: "Invalid identifier." }, { status: 400 }); }
  return dataResponse(async () => ({ stock: await getStock(value) }), () => ({ stock: sampleStock(value) }));
}
