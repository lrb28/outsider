import { NextResponse } from "next/server";

// Grenzt die Routen ein, die pro Aufruf fremde Dienste (Yahoo) abfragen. Ohne
// Grenze wäre jede dieser Routen ein offener Proxy: ein Skript könnte mit einer
// Anfrage bis zu 40 externe Abrufe auslösen, Funktionslaufzeit verbrauchen und
// unsere Server-IP bei Yahoo sperren lassen.
//
// Der Zähler lebt im Speicher der jeweiligen Instanz. Das ist eine Notbremse,
// kein verteiltes Limit; das plattformweite Limit gehört in die Vercel-Firewall.

export interface RateRule { limit: number; windowMs: number }
export interface RateResult { allowed: boolean; remaining: number; retryAfterSec: number }

// Großzügig für echte Nutzung: Kurse alle 20 s in 30er-Blöcken, Historie in
// 40er-, ISIN-Auflösung in 20er-Blöcken. Ein Depot mit 300 Positionen braucht
// beim Laden rund 30 Anfragen.
export const UPSTREAM_RULE: RateRule = { limit: 60, windowMs: 60_000 };

export function createRateLimiter(maxKeys = 5_000) {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string, rule: RateRule, now = Date.now()): RateResult => {
    let entry = windows.get(key);
    if (!entry || now - entry.start >= rule.windowMs) {
      windows.delete(key);
      if (windows.size >= maxKeys) {
        const oldest = windows.keys().next().value;
        if (oldest !== undefined) windows.delete(oldest);
      }
      entry = { start: now, count: 0 };
      windows.set(key, entry);
    }
    entry.count += 1;
    return {
      allowed: entry.count <= rule.limit,
      remaining: Math.max(0, rule.limit - entry.count),
      retryAfterSec: Math.max(1, Math.ceil((entry.start + rule.windowMs - now) / 1000)),
    };
  };
}

// Vercel setzt beide Kopfzeilen selbst; der Client kann sie dort nicht fälschen.
export function clientKey(headers?: { get(name: string): string | null }): string {
  const real = headers?.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers?.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

const check = createRateLimiter();

export function limitUpstream(route: string, req: { headers?: { get(name: string): string | null } }) {
  const result = check(`${route}:${clientKey(req.headers)}`, UPSTREAM_RULE);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Zu viele Anfragen. Bitte kurz warten und erneut versuchen." },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec), "Cache-Control": "no-store" } },
  );
}
