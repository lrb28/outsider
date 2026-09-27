"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCatalogue } from "@/lib/fetchJson";
import { formatDate, isStaleDate } from "@/lib/format";
import type { StatsResponse } from "@/lib/stats";

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
  const incomplete = data && !sample && (data.freshPriceSymbols < data.priceSymbols || !data.priceSymbols);
  const groups: Record<string, string> = { institution: "Investoren", corporate_insider: "Insider", politician: "Politiker" };
  return <section aria-label="Datenstand" className="rounded-2xl border border-hair bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${error || sample || incomplete ? "bg-amber-500" : data ? "bg-emerald-600" : "bg-slate-300"}`} />
        {error ? "Datenstatus nicht erreichbar" : !data ? "Datenstand wird geladen…" : sample ? "Vorschau mit Beispieldaten" : "Öffentliche Offenlegungen"}
      </div>
      {error ? <button className="text-sm font-medium text-brand underline" onClick={() => setAttempt(n => n + 1)}>Erneut prüfen</button> : <Link href="/status" className="text-sm text-brand hover:underline">Datenstatus ansehen →</Link>}
    </div>
    {data && !sample && <p className="mt-2 text-xs leading-relaxed text-subtle">
      Letzte erfasste Meldung: <strong className="font-medium text-ink">{formatDate(data.latestDisclosure)}</strong>
      {" · "}{data.trades.toLocaleString("de-DE")} Meldungen im Bestand
      {incomplete && <span className="mt-1 block text-amber-800">Kursabdeckung unvollständig: {data.freshPriceSymbols} von {data.priceSymbols} erfassten Wertpapieren haben einen Kurs aus den letzten 7 Tagen.</span>}
    </p>}
    {sample && <p className="mt-2 text-xs text-subtle">Zahlen und Akteure dienen der Produktvorschau. Es werden keine künstlichen Kursverläufe erzeugt.</p>}
    {detailed && data && !sample && <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {data.groups.map(g => <div key={g.type} className="rounded-xl bg-slate-50 p-4">
        <h2 className="font-semibold">{groups[g.type] ?? g.type}</h2>
        <p className="mt-2 text-sm">{g.trades.toLocaleString("de-DE")} Meldungen</p>
        <p className="mt-1 text-xs text-subtle">Letzte Offenlegung: {formatDate(g.latestDisclosure)}</p>
        {g.missingDates > 0 && <p className="mt-1 text-xs text-amber-800">{g.missingDates} ohne Offenlegungsdatum</p>}
        {(!g.latestDisclosure || isStaleDate(g.latestDisclosure, g.type === "institution" ? 150 : 45)) && <p className="mt-2 text-xs font-medium text-amber-800">Historischer oder unvollständiger Bestand</p>}
      </div>)}
    </div>}
  </section>;
}
