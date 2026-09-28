"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { auraOf, companyName, formatDate, isStaleDate, pct, sourceLink, tradeSignal } from "@/lib/format";
import { fetchJson } from "@/lib/fetchJson";
import type { FeedRow, PricesResponse } from "@/lib/types";
import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";
import { Icon } from "./Icon";
import { SkeletonChart } from "./Skeleton";
import { Sparkline } from "./Sparkline";
const price = (v: number | null) => v !== null && Number.isFinite(v) ? v.toLocaleString("de-DE",{style:"currency",currency:"USD"}) : "—";
export function TradeDetailModal({row,onClose}: {row: FeedRow;onClose: () => void}) {
  const dialog = useRef<HTMLDialogElement>(null); const titleId = useId();
  const [data,setData] = useState<PricesResponse | null>(null); const [error,setError] = useState(false); const [retry,setRetry] = useState(0);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => { const element = dialog.current; const focused = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; element?.showModal(); document.body.style.overflow = "hidden"; return () => {element?.close(); document.body.style.overflow = overflow; focused?.focus();}; },[]);
  useEffect(() => { const controller = new AbortController();setData(null);setError(false);if (row.ticker) fetchJson<PricesResponse>(`/api/prices?ticker=${encodeURIComponent(row.ticker)}`,{signal:controller.signal}).then(setData).catch(() => {if (!controller.signal.aborted) setError(true);});return () => controller.abort(); },[row.ticker,retry]);
  const sig = tradeSignal(row); const company = companyName(row.ticker,row.securityName); const bars = data?.bars ?? [];
  const last = bars[bars.length - 1]; const stale = isStaleDate(last?.date ?? null);
  const cutoff = row.disclosedAt ? new Date(Date.parse(row.disclosedAt) + 7 * 86400000).toISOString().slice(0,10) : null;
  const entry = row.disclosedAt ? bars.find(bar => bar.date >= row.disclosedAt! && bar.date <= cutoff!)?.close ?? null : null;
  const perf = !last || entry === null || entry <= 0 || stale ? null : (last.close - entry) / entry;
  const profile = row.entitySlug ? `/${row.entityType === "institution" ? "investor" : row.entityType === "politician" ? "politician" : "insider"}/${row.entitySlug}` : null;
  const source = sourceLink(row.sourceUrl);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={event => {event.preventDefault();closeRef.current();}} onClick={event => {if (event.target === dialog.current) {const rect = dialog.current.getBoundingClientRect();if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRef.current();}}} className="mx-auto mb-2 mt-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-md overflow-y-auto rounded-[2.25rem] border-0 bg-card p-0 text-ink shadow-float sm:m-auto sm:w-[calc(100%-2rem)]">
    <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-ink/15 sm:hidden" />
    <div className="flex items-start gap-3 p-5 pb-3"><div className="relative shrink-0"><CompanyLogo ticker={row.ticker} company={company} size={48}/><div className="absolute -bottom-1.5 -right-1.5 rounded-full shadow-[0_2px_10px_rgb(0_0_0/0.18)]"><Avatar name={row.entityName} src={row.entityPhoto} kind={auraOf(row.entityType)} size={26}/></div></div><div className="min-w-0 flex-1"><h2 id={titleId} className="font-display text-[22px] font-bold leading-tight tracking-[-0.01em]">{company}</h2><p className="mt-1 truncate text-sm text-subtle">{row.entityName}</p></div>{perf !== null && <span className={`mt-1 shrink-0 text-sm font-semibold tabular-nums ${perf >= 0 ? "text-bull" : "text-bear"}`}>{perf >= 0 ? "▲" : "▼"} {pct(perf)}</span>}<button autoFocus onClick={onClose} aria-label="Meldungsdetails schließen" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface2 text-subtle hover:text-ink"><Icon name="close" className="h-5 w-5"/></button></div>
    <div className="flex flex-wrap items-center gap-2 px-5"><span className={`rounded-full px-3 py-1 text-xs font-medium ${sig.tone === "bull" ? "bg-bull/10 text-bull" : sig.tone === "bear" ? "bg-bear/10 text-bear" : "bg-surface2 text-subtle"}`}>{sig.text}</span>{row.transactionCode && <span className="text-xs text-subtle">Form-4-Code {row.transactionCode}</span>}</div>
    <div className="px-5 py-4">
      {error ? <div role="alert" className="rounded-2xl bg-surface2 p-4 text-sm">Kursdaten sind gerade nicht verfügbar. <button onClick={() => setRetry(r => r+1)} className="font-medium underline">Erneut versuchen</button></div> : !data && row.ticker ? <SkeletonChart height={150} /> : bars.length ? <><Sparkline bars={bars} markDate={row.disclosedAt} up={perf === null || perf >= 0}/><p className="text-xs text-subtle">Schlusskurse in USD · Kursstand {formatDate(last.date)}{stale ? " · veraltet" : ""}{data?.source === "sample" ? " · Beispieldaten" : ""}</p></> : <p className="rounded-2xl bg-surface2 p-4 text-sm text-subtle">Für diese Meldung ist kein Kursverlauf verfügbar.</p>}
    </div>
    {row.entityType === "institution" && <p className="mx-5 rounded-xl bg-surface2 p-3 text-xs leading-5 text-ink/80">Vergleich von Quartalsbeständen. Handelstag und Ausführungskurs sind aus dem Bericht nicht ableitbar.</p>}
    {row.entityType === "corporate_insider" && !row.transactionCode && <p className="mx-5 rounded-xl bg-warn/10 p-3 text-xs leading-5 text-warn">Der Originalcode fehlt in diesem älteren Datensatz. Eine Einordnung als echter Kauf oder Verkauf ist deshalb nicht gesichert.</p>}
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-5 text-sm"><Stat label="Gemeldete Größe" value={row.sizeDisplay}/><Stat label={row.entityType === "institution" ? "Berichtsstichtag" : "Gemeldeter Handelstag"} value={formatDate(row.entityType === "institution" ? row.reportingDate ?? row.txnDate : row.txnDate)}/><Stat label="Offengelegt am" value={formatDate(row.disclosedAt)}/><Stat label="Kursstand" value={formatDate(last?.date ?? null)}/><Stat label="Schlusskurs nach Offenlegung" value={price(entry)}/><Stat label="Letzter verfügbarer Schlusskurs" value={price(last?.close ?? null)}/><Stat label="Kursänderung seit Offenlegung" value={pct(perf)}/></dl>
    <p className="px-5 pb-4 text-xs leading-5 text-subtle">Die Kursänderung ist keine Rendite des Akteurs. Fehlende oder veraltete Kursdaten werden nicht durch Schätzwerte ersetzt. <Link href="/methodik" onClick={onClose} className="underline">Methodik</Link></p>
    <div className="flex flex-wrap gap-2 border-t border-hair p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{profile && <Link onClick={onClose} href={profile} className="btn-capsule min-h-11 flex-1"><Icon name="user" className="h-4 w-4"/>Akteur</Link>}{row.ticker && <Link onClick={onClose} href={`/stock/${encodeURIComponent(row.ticker)}`} className="btn-primary min-h-11 flex-1"><Icon name="chart" className="h-4 w-4"/>Aktie ansehen</Link>}{source ? <a href={source} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 px-3 text-sm font-medium text-subtle underline underline-offset-2 hover:text-ink"><Icon name="document" className="h-4 w-4"/>Originalmeldung öffnen</a> : <span className="w-full p-3 text-center text-xs text-subtle">Quellenlink fehlt</span>}</div>
  </dialog>;
}
function Stat({label,value}: {label:string;value:string}) { return <div><dt className="text-xs text-subtle">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>; }
