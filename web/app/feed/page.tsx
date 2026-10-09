"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useRef, useState } from "react";
import { ErrorRetry } from "@/components/ErrorRetry";
import { SkeletonList } from "@/components/Skeleton";
import { Icon } from "@/components/Icon";
import { TradeFeed } from "@/components/TradeFeed";
import { ChipBar, PageTitle, SegmentedControl } from "@/components/ui";
import { DataGuideLink } from "@/components/DataGuide";
import { fetchJson } from "@/lib/fetchJson";
import { LetterCard } from "@/components/Letters";
import type { FeedRow, LetterSummary, LettersResponse, TradesResponse } from "@/lib/types";
const TYPES = [{key:"",label:"All"},{key:"institution",label:"Investors",aura:"investor"},{key:"corporate_insider",label:"Insiders",aura:"insider"},{key:"politician",label:"Politicians",aura:"politician"},{key:"letters",label:"Letters"}] as const;
const STANCES = [["","All"],["bullish","Bullish"],["neutral","Neutral"],["bearish","Bearish"]] as const;
const TXNS = [{key:"",label:"All"},{key:"buy",label:"Buys"},{key:"sell",label:"Sells"}];
export default function FeedPage() { return <Suspense fallback={<SkeletonList n={8} />}><Feed /></Suspense>; }
function Feed() {
  const params = useSearchParams();
  return params.get("type") === "letters" ? <LettersFeed /> : <Filings />;
}

/**
 * Investor letters, memos and public letters to companies (after Eaves's
 * Letters tab), newest first, each summarised from the original.
 */
function LettersFeed() {
  const params = useSearchParams();
  const router = useRouter();
  const stance = params.get("stance") || "";
  const [rows, setRows] = useState<LetterSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRows(null); setError(false);
    fetchJson<LettersResponse>(`/api/letters?limit=60${stance ? `&stance=${stance}` : ""}`, {signal: controller.signal})
      .then(d => setRows(d.rows))
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [stance, retry]);
  const go = (key: string, value: string) => { const q = new URLSearchParams(params.toString()); if (value) q.set(key, value); else q.delete(key); if (key === "type") q.delete("stance"); router.push(`/feed${q.size ? `?${q}` : ""}`, {scroll:false}); };
  return <div className="space-y-5">
    <PageTitle title="Feed" subtitle="Letters, memos and open letters from the investors Outsider follows, each summarised from the original." />
    <div className="space-y-3">
      <ChipBar mode="filter" label="Filers" items={TYPES} value={"letters" as (typeof TYPES)[number]["key"]} onChange={value => go("type", value)} />
      <SegmentedControl label="Tone" size="sm" options={STANCES} value={stance as (typeof STANCES)[number][0]} onChange={value => go("stance", value)} />
    </div>
    {error && <ErrorRetry onRetry={() => setRetry(r => r + 1)} />}
    {!error && rows === null && <SkeletonList n={4} />}
    {rows && rows.length === 0 && <div className="card p-8 text-center text-[15px] text-subtle">No letters with this tone yet.</div>}
    {rows && rows.length > 0 && <div className="fade-up grid gap-3 sm:grid-cols-2">{rows.map(l => <LetterCard key={l.slug} letter={l} />)}</div>}
  </div>;
}

function Filings() {
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
    <PageTitle title="Feed" subtitle={<>Every disclosure from politicians, insiders and investors, newest first. Tap a row for details. <DataGuideLink /></>} />
    <div className="space-y-3">
      <ChipBar mode="filter" label="Filers" items={TYPES} value={type as (typeof TYPES)[number]["key"]} onChange={value => update("type", value)} />
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl label="Transaction" size="sm" options={TXNS.map(item => [item.key, item.label] as const)} value={txnType} onChange={value => update("txnType", value)} />
        <form onSubmit={submit} role="search" className="relative min-w-[12rem] flex-1"><label htmlFor="feed-query" className="sr-only">Search filer, company or ticker</label><Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" /><input id="feed-query" type="search" value={q} maxLength={100} onChange={e => setQ(e.target.value)} onBlur={() => { if (q.trim() !== (params.get("q") || "")) update("q", q.trim()); }} placeholder="Name or ticker" className="field !pl-9"/></form>
        <button type="button" aria-expanded={more} aria-controls="feed-more" onClick={() => setMore(m => !m)} className={`chip ${more || extra ? "chip-on" : ""}`}><Icon name="filter" className="h-4 w-4" />Filter{extra ? ` · ${extra}` : ""}</button>
      </div>
      {more && <div id="feed-more" className="card grid gap-3 p-4 sm:grid-cols-3">{["from","to"].map(key => <label key={key} className="text-xs font-medium text-subtle">{key === "from" ? "Disclosed from" : "Disclosed to"}<input type="date" value={params.get(key) || ""} onChange={e => update(key,e.target.value)} className="field mt-1 block min-w-0 !rounded-2xl"/></label>)}<label className="text-xs font-medium text-subtle">Filings per page<select value={pageSize} onChange={e => update("size",e.target.value)} className="field mt-1 block !rounded-2xl">{[6,24,48].map(size => <option key={size} value={size}>{size}</option>)}</select></label></div>}
      {type === "politician" && <p className="text-[13px] text-subtle">US House of Representatives, STOCK Act filings. Scanned PDFs are still missing. <Link className="underline" href="/status">Check coverage</Link></p>}
      {filterKey && <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-subtle hover:text-ink" onClick={() => {setPage(0);setMore(false);router.push("/feed",{scroll:false});}}><Icon name="close" className="h-4 w-4" />Reset all filters</button>}
    </div>
    {error && <ErrorRetry onRetry={() => setRetry(r => r + 1)} />}
    {!error && <p role="status" className="text-xs text-subtle">{loading ? "Loading filings …" : `${rows.length} filings loaded`}</p>}
    <TradeFeed rows={rows} loading={loading && !rows.length} empty={error ? "Data is temporarily unavailable." : "No filings for this selection. Adjust or reset the filters."}/>
    {next !== null && !error && <div className="text-center"><button onClick={() => setPage(next)} disabled={loading} className="btn-primary">{loading ? "Loading …" : "Load more filings"}</button></div>}
  </div>;
}
