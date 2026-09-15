import { NextResponse } from "next/server";
import { isDemoMode } from "./dataMode";
import { withRetry } from "./retry";
export function unavailable() {
  return NextResponse.json(
    { source: "unavailable", error: "Die Daten sind derzeit nicht erreichbar. Bitte versuche es später erneut." },
    { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } },
  );
}
export async function dataResponse<T extends object>(load: () => Promise<T>, demo: () => T) {
  if (isDemoMode()) return NextResponse.json({ ...demo(), source: "sample" }, { headers: { "Cache-Control": "no-store" } });
  if (!process.env.DATABASE_URL) return unavailable();
  try {
    return NextResponse.json({ ...await withRetry(load), source: "database" }, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unavailable";
    console.error("[data] request failed", /^[A-Z0-9_]{2,30}$/.test(code) ? code : "unavailable");
    return unavailable();
  }
}
