"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCatalogue } from "@/lib/fetchJson";
import { formatDate, isStaleDate } from "@/lib/format";
import type { StatsResponse } from "@/lib/stats";
import { Icon } from "./Icon";

export function DataStatus({ detailed = false }: { detailed?: boolean }) {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(false);
    fetchCatalogue<StatsResponse>("/api/stats").then(d => active && setData(d)).catch(() => active && setError(true));
    return () => { active = false; };
  }, [attempt]);
  const sample = data?.source === "sample";
  // Coverage of the securities the app shows (recent trades, current 13F
  // positions). Some delisted or exotic lines never get a quote; warn only
  // when a real share is missing.
  const coverage = data && data.priceSymbols ? data.freshPriceSymbols / data.priceSymbols : 0;
  const incomplete = data && !sample && coverage < 0.9;
  const groups: Record<string, string> = { institution: "Investoren", corporate_insider: "Insider", politician: "Politiker" };
  return <section aria-label="Datenstand" className="lcard p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${error || sample || incomplete ? "bg-warn" : data ? "bg-bull-fill" : "bg-muted"}`} />
        {error ? "Datenstatus nicht erreichbar" : !data ? "Datenstand wird geladen…" : sample ? "Vorschau mit Beispieldaten" : "Öffentliche Offenlegungen"}
      </div>
      {error ? <button className="text-sm font-medium text-ink underline underline-offset-2" onClick={() => setAttempt(n => n + 1)}>Erneut prüfen</button> : <Link href="/status" className="inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-subtle hover:text-ink">Datenstatus<Icon name="chevronRight" className="h-4 w-4" /></Link>}
    </div>
    {data && !sample && <p className="mt-2 text-xs leading-relaxed text-subtle">
      Letzte Meldung <strong className="font-medium text-ink">{formatDate(data.latestDisclosure)}</strong>
      {" · "}Schlusskurse bis <strong className="font-medium text-ink">{formatDate(data.latestPrice)}</strong>
      {" · "}{data.trades.toLocaleString("de-DE")} Meldungen
      <span className={`mt-1 block ${incomplete ? "text-warn" : ""}`}>
        Aktueller Kurs (≤ 7 Tage) für {data.freshPriceSymbols.toLocaleString("de-DE")} von {data.priceSymbols.toLocaleString("de-DE")} angezeigten Wertpapieren ({Math.round(coverage * 100)}{"\u00A0"}%).
      </span>
    </p>}
    {sample && <p className="mt-2 text-xs text-subtle">Zahlen und Akteure dienen der Produktvorschau. Es werden keine künstlichen Kursverläufe erzeugt.</p>}
    {detailed && data && !sample && <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {data.groups.map(g => <div key={g.type} className="rounded-2xl bg-card p-4">
        <h2 className="font-semibold">{groups[g.type] ?? g.type}</h2>
        <p className="mt-2 text-sm">{g.trades.toLocaleString("de-DE")} Meldungen</p>
        <p className="mt-1 text-xs text-subtle">Letzte Offenlegung: {formatDate(g.latestDisclosure)}</p>
        {g.missingDates > 0 && <p className="mt-1 text-xs text-warn">{g.missingDates} ohne Offenlegungsdatum</p>}
        {(!g.latestDisclosure || isStaleDate(g.latestDisclosure, g.type === "institution" ? 150 : 45)) && <p className="mt-2 text-xs font-medium text-warn">Historischer oder unvollständiger Bestand</p>}
      </div>)}
    </div>}
  </section>;
}
