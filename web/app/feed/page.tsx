"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { ErrorRetry } from "@/components/ErrorRetry";
import { Icon } from "@/components/Icon";
import { TradeFeed } from "@/components/TradeFeed";
import { fetchJson } from "@/lib/fetchJson";
import type { FeedRow, TradesResponse } from "@/lib/types";
const TYPES = [{key:"",label:"Alle"},{key:"institution",label:"Investoren"},{key:"corporate_insider",label:"Insider"},{key:"politician",label:"Politiker"}];
const TXNS = [{key:"",label:"Alle"},{key:"buy",label:"Käufe / Zugänge"},{key:"sell",label:"Verkäufe / Abgänge"}];
export default function FeedPage() { return <Suspense fallback={<p role="status">Meldungen werden geladen …</p>}><Feed /></Suspense>; }
function Feed() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") || "");
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [next, setNext] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [more, setMore] = useState(false);
  const generation = useRef(0);
  const type = params.get("type") || "";
  const txnType = params.get("txnType") || "";
  const pageSize = [6,24,48].includes(Number(params.get("size"))) ? Number(params.get("size")) : 24;
  const filter = new URLSearchParams();
  for (const key of ["type", "txnType", "q", "from", "to", "size"]) { const value = params.get(key); if (value) filter.set(key, value); }
  const filterKey = filter.toString();
  const currentFilter = useRef(filterKey);
  useEffect(() => { setQ(params.get("q") || ""); }, [params]);
  useEffect(() => {
    const controller = new AbortController();
    const id = ++generation.current;
    const changed = currentFilter.current !== filterKey;
    currentFilter.current = filterKey;
    const offset = changed ? 0 : page;
    if (changed) setPage(0);
    setLoading(true); setError(false);
    if (!offset) setRows([]);
    const query = new URLSearchParams(filterKey);
    query.set("limit", String(pageSize)); query.set("offset", String(offset));
    fetchJson<TradesResponse>(`/api/trades?${query}`, {signal: controller.signal})
      .then(data => { if (id !== generation.current) return; setRows(old => offset ? [...old, ...data.rows.filter(row => !old.some(r => r.id === row.id))] : data.rows); setNext(data.nextOffset ?? null); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted && id === generation.current) setLoading(false); });
    return () => controller.abort();
  }, [filterKey, page, pageSize, retry]);
  function update(key: string, value: string) { const query = new URLSearchParams(filterKey); if (value) query.set(key, value); else query.delete(key); setPage(0); router.push(`/feed${query.size ? `?${query}` : ""}`, {scroll:false}); }
  const submit = (event: FormEvent) => { event.preventDefault(); update("q", q.trim()); };
  const extra = ["from", "to", "size"].filter(key => params.get(key)).length;
  return <div className="space-y-5">
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">Meldungen</h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-subtle">Alle Offenlegungen von Politikern, Insidern und Investoren – tippe eine Zeile für Details. Sortiert nach Offenlegung. <Link href="/methodik" className="font-medium text-ink underline underline-offset-2">So liest du die Daten</Link></p>
    </div>
    <div className="space-y-3">
      <div role="group" aria-label="Akteure" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">{TYPES.map(item => <button type="button" key={item.key} aria-pressed={type === item.key} onClick={() => update("type", item.key)} className={`chip ${type === item.key ? "chip-on" : ""}`}>{item.label}</button>)}</div>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Vorgang" className="glass flex rounded-full p-1">{TXNS.map(item => <button type="button" key={item.key} aria-pressed={txnType === item.key} onClick={() => update("txnType", item.key)} className={`rounded-full px-3.5 text-xs font-medium transition ${txnType === item.key ? "bg-white text-ink shadow-[inset_0_1px_0_#fff,0_2px_8px_rgb(28_28_30/0.1)]" : "text-subtle hover:text-ink"}`}>{item.label}</button>)}</div>
        <form onSubmit={submit} role="search" className="relative min-w-[12rem] flex-1"><label htmlFor="feed-query" className="sr-only">Akteur, Unternehmen oder Ticker suchen</label><Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input id="feed-query" type="search" value={q} maxLength={100} onChange={e => setQ(e.target.value)} onBlur={() => { if (q.trim() !== (params.get("q") || "")) update("q", q.trim()); }} placeholder="Name oder Ticker suchen …" className="field !pl-9"/></form>
        <button type="button" aria-expanded={more} aria-controls="feed-more" onClick={() => setMore(m => !m)} className={`chip ${more || extra ? "chip-on" : ""}`}><Icon name="filter" className="h-4 w-4" />Filter{extra ? ` · ${extra}` : ""}</button>
      </div>
      {more && <div id="feed-more" className="lcard grid gap-3 p-4 sm:grid-cols-3">{["from","to"].map(key => <label key={key} className="text-xs font-medium text-subtle">{key === "from" ? "Offengelegt ab" : "Offengelegt bis"}<input type="date" value={params.get(key) || ""} onChange={e => update(key,e.target.value)} className="field mt-1 block min-w-0 !rounded-2xl"/></label>)}<label className="text-xs font-medium text-subtle">Meldungen pro Seite<select value={pageSize} onChange={e => update("size",e.target.value)} className="field mt-1 block !rounded-2xl">{[6,24,48].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>}
      {type === "politician" && <p className="text-sm text-amber-800">Diese Quelle enthält historische Meldungen und Lücken. <Link className="underline" href="/status">Abdeckung prüfen</Link></p>}
      {filterKey && <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-subtle hover:text-ink" onClick={() => {setPage(0);setMore(false);router.push("/feed",{scroll:false});}}><Icon name="close" className="h-4 w-4" />Alle Filter zurücksetzen</button>}
    </div>
    {error && <ErrorRetry onRetry={() => setRetry(r => r + 1)} />}
    {!error && <p role="status" className="text-xs text-subtle">{loading ? "Meldungen werden geladen …" : `${rows.length} Meldungen geladen`}</p>}
    <TradeFeed rows={rows} loading={loading && !rows.length} empty={error ? "Daten sind vorübergehend nicht verfügbar." : "Keine Meldungen für diese Auswahl. Passe die Filter an oder setze sie zurück."}/>
    {next !== null && !error && <div className="text-center"><button onClick={() => setPage(next)} disabled={loading} className="btn-primary">{loading ? "Wird geladen …" : "Weitere Meldungen laden"}</button></div>}
  </div>;
}
