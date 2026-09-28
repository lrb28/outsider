import { NextRequest, NextResponse } from "next/server";
import { SYMBOL_RE } from "@/lib/apiValidation";
import { LOGO_RULE, limitUpstream } from "@/lib/rateLimit";

// Company logos through our own origin: one request per logo instead of up to
// two failing ones in the browser, cached a week on the CDN, and readable by
// the page (same origin), which lets it tell transparent wordmarks from
// full-bleed tiles. Only PNG is passed on: an SVG served from this domain
// could run script.
export const dynamic = "force-dynamic";

const PNG = /^image\/png\b/;

function candidates(t: string): string[] {
  const dash = t.replace(/\./g, "-");
  const base = t.split(/[.-]/)[0];
  const out = [
    `https://assets.parqet.com/logos/symbol/${encodeURIComponent(t)}?format=png&size=128`,
    `https://assets.parqet.com/logos/symbol/${encodeURIComponent(dash)}?format=png&size=128`,
    `https://financialmodelingprep.com/image-stock/${encodeURIComponent(dash)}.png`,
    `https://assets.parqet.com/logos/symbol/${encodeURIComponent(base)}?format=png&size=128`,
  ];
  return [...new Set(out)];
}

export async function GET(req: NextRequest) {
  const t = (req.nextUrl.searchParams.get("t") || "").trim().toUpperCase().replace("/", ".");
  if (!SYMBOL_RE.test(t)) return new NextResponse(null, { status: 400 });
  const limited = limitUpstream("logo", req, LOGO_RULE);
  if (limited) return limited;
  for (const url of candidates(t)) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { "User-Agent": "Mozilla/5.0 (aura-tracker)" } });
      const type = res.headers.get("content-type") || "";
      if (!res.ok || !PNG.test(type)) continue;
      const body = await res.arrayBuffer();
      if (body.byteLength < 100 || body.byteLength > 400_000) continue;
      return new NextResponse(body, {
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      /* next source */
    }
  }
  // Missing logos are remembered too, so the monogram appears at once.
  return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
