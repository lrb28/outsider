"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { ErrorRetry } from "@/components/ErrorRetry";
import { TradeFeed } from "@/components/TradeFeed";
import { fetchJson } from "@/lib/fetchJson";
import type { FeedRow, TradesResponse } from "@/lib/types";
const TYPES = [{key:"",label:"Alle Akteure"},{key:"institution",label:"Investoren (13F)"},{key:"corporate_insider",label:"Unternehmensinsider"},{key:"politician",label:"US-Politiker"}];
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
  return <div className="space-y-6">
    <div><p className="text-sm font-medium text-brand">Öffentlich offengelegt</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Meldungen mit Kontext.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-subtle">Käufe, Verkäufe und gemeldete Bestandsänderungen. Sortiert nach Offenlegung; fehlende Datumsangaben stehen am Ende. <Link href="/methodik" className="underline">So liest du die Daten</Link></p></div>
    <div className="lcard space-y-4 p-4 sm:p-5">
      <form onSubmit={submit} className="flex gap-2"><label htmlFor="feed-query" className="sr-only">Akteur, Unternehmen oder Ticker suchen</label><input id="feed-query" value={q} maxLength={100} onChange={e => setQ(e.target.value)} placeholder="Akteur, Unternehmen oder Ticker" className="min-w-0 flex-1 rounded-xl border border-hair bg-white px-3 text-sm"/><button type="submit" className="btn-primary">Suchen</button></form>
      <fieldset className="flex flex-wrap gap-2"><legend className="mb-2 text-xs font-medium text-subtle">Akteure</legend>{TYPES.map(item => <button type="button" key={item.key} aria-pressed={type === item.key} onClick={() => update("type", item.key)} className={`rounded-full px-3 text-sm ${type === item.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}>{item.label}</button>)}</fieldset>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-xs font-medium text-subtle">Vorgang<select value={txnType} onChange={e => update("txnType", e.target.value)} className="mt-1 block w-full rounded-xl border border-hair bg-white px-3 text-sm text-ink"><option value="">Alle Vorgänge</option><option value="buy">Zugänge / Käufe</option><option value="sell">Abgänge / Verkäufe</option></select></label>{["from","to"].map(key => <label key={key} className="text-xs font-medium text-subtle">{key === "from" ? "Offengelegt ab" : "Offengelegt bis"}<input type="date" value={params.get(key) || ""} onChange={e => update(key,e.target.value)} className="mt-1 block w-full min-w-0 rounded-xl border border-hair px-3 text-sm text-ink"/></label>)}<label className="text-xs font-medium text-subtle">Meldungen pro Seite<select value={pageSize} onChange={e => update("size",e.target.value)} className="mt-1 block w-full rounded-xl border border-hair bg-white px-3 text-sm text-ink">{[6,24,48].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>
      {type === "politician" && <p className="text-sm text-amber-800">Diese Quelle enthält historische Meldungen und Lücken. <Link className="underline" href="/status">Abdeckung prüfen</Link></p>}
      {filterKey && <button type="button" className="text-sm font-medium text-brand underline" onClick={() => {setPage(0);router.push("/feed",{scroll:false});}}>Alle Filter zurücksetzen</button>}
    </div>
    {error && <ErrorRetry onRetry={() => setRetry(r => r + 1)} />}
    {!error && <p role="status" className="text-sm text-subtle">{loading ? "Meldungen werden geladen …" : `${rows.length} Meldungen geladen`}</p>}
    <TradeFeed rows={rows} loading={loading && !rows.length} empty={error ? "Daten sind vorübergehend nicht verfügbar." : "Keine Meldungen für diese Auswahl. Passe die Filter an oder setze sie zurück."}/>
    {next !== null && !error && <div className="text-center"><button onClick={() => setPage(next)} disabled={loading} className="btn-primary">{loading ? "Wird geladen …" : "Weitere Meldungen laden"}</button></div>}
  </div>;
}
