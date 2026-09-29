import { NextRequest, NextResponse } from "next/server";
import { SYMBOL_RE } from "@/lib/apiValidation";
import { getPool } from "@/lib/db";
import { LOGO_RULE, limitUpstream } from "@/lib/rateLimit";
import { isinFromCusip } from "@/lib/instruments";

// Company logos through our own origin: one request per logo instead of up to
// two failing ones in the browser, cached a week on the CDN, and readable by
// the page (same origin), which lets it tell transparent wordmarks from
// full-bleed tiles. Only PNG is passed on: an SVG served from this domain
// could run script.
export const dynamic = "force-dynamic";

const PNG = /^image\/png\b/;

// Symbols whose logo at Parqet and FMP belongs to another company (a reused
// or foreign ticker). For these the symbol lookup is skipped; an ISIN match
// still counts.
const WRONG_BY_SYMBOL = new Set(["GAM"]);

/**
 * The ISIN of a ticker from the 13F CUSIP we store. Looking a logo up by ISIN
 * finds the right company where the bare symbol is ambiguous (SPCX returned
 * another firm's logo). Best effort: no database, no ISIN.
 */
async function isinOf(t: string): Promise<string | null> {
  const pool = getPool();
  if (!pool) return null;
  try {
    const { rows } = await pool.query(
      `select cusip from securities
       where upper(ticker) = $1 and cusip ~ '^[0-9A-Z]{9}$'
       order by (select count(*) from holdings h where h.security_id = securities.id) desc
       limit 1`,
      [t],
    );
    return rows[0]?.cusip ? isinFromCusip(rows[0].cusip as string) : null;
  } catch {
    return null;
  }
}

function candidates(t: string, isin: string | null): string[] {
  const dash = t.replace(/\./g, "-");
  const base = t.split(/[.-]/)[0];
  const out = isin ? [`https://assets.parqet.com/logos/isin/${isin}?format=png&size=128`] : [];
  if (!WRONG_BY_SYMBOL.has(t)) {
    out.push(
      `https://assets.parqet.com/logos/symbol/${encodeURIComponent(t)}?format=png&size=128`,
      `https://assets.parqet.com/logos/symbol/${encodeURIComponent(dash)}?format=png&size=128`,
      `https://financialmodelingprep.com/image-stock/${encodeURIComponent(dash)}.png`,
      `https://assets.parqet.com/logos/symbol/${encodeURIComponent(base)}?format=png&size=128`,
    );
  }
  return [...new Set(out)];
}

export async function GET(req: NextRequest) {
  const t = (req.nextUrl.searchParams.get("t") || "").trim().toUpperCase().replace("/", ".");
  if (!SYMBOL_RE.test(t)) return new NextResponse(null, { status: 400 });
  const limited = limitUpstream("logo", req, LOGO_RULE);
  if (limited) return limited;
  for (const url of candidates(t, await isinOf(t))) {
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
