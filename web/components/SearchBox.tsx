"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Icon } from "@/components/Icon";
import { fetchCatalogue } from "@/lib/fetchJson";
import type { InvestorsResponse, PoliticiansResponse, StocksResponse } from "@/lib/types";
type Hit = { name: string; keywords: string; href: string; kind: string; ticker?: string };
export function SearchBox() {
  const [q,setQ] = useState(""); const [open,setOpen] = useState(false);
  const [items,setItems] = useState<Hit[]>([]); const [loading,setLoading] = useState(false);
  const [failed,setFailed] = useState(false); const [active,setActive] = useState(-1);
  const loaded = useRef(false); const busy = useRef(false); const box = useRef<HTMLDivElement>(null);
  const router = useRouter(); const id = useId();
  async function ensureData() {
    if (loaded.current || busy.current) return;
    busy.current = true; setLoading(true); setFailed(false);
    const results = await Promise.allSettled([
      fetchCatalogue<InvestorsResponse>("/api/investors").then(d => d.rows.map(r => ({name:r.person ?? r.fund,keywords:`${r.person} ${r.fund}`,href:`/investor/${r.slug}`,kind:"Investor"}))),
      fetchCatalogue<StocksResponse>("/api/stocks").then(d => d.rows.filter(r => r.ticker).map(r => ({name:r.company,keywords:`${r.company} ${r.ticker}`,href:`/stock/${encodeURIComponent(r.ticker!)}`,kind:r.ticker!,ticker:r.ticker!}))),
      fetchCatalogue<PoliticiansResponse>("/api/politicians").then(d => d.rows.map(r => ({name:r.name,keywords:r.name,href:`/politician/${r.slug}`,kind:"Politiker"}))),
    ]);
    setItems(results.flatMap(result => result.status === "fulfilled" ? result.value : []));
    loaded.current = results.every(r => r.status === "fulfilled"); setFailed(!loaded.current); setLoading(false); busy.current = false;
  }
  useEffect(() => { const close = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };document.addEventListener("pointerdown",close);return () => document.removeEventListener("pointerdown",close); },[]);
  const needle = q.trim().toLocaleLowerCase("de-DE");
  const hits = needle ? items.filter(r => r.keywords.toLocaleLowerCase("de-DE").includes(needle)).slice(0,10) : [];
  const visible = open && !!needle;
  const choose = (hit: Hit) => { setOpen(false);setQ("");setActive(-1);router.push(hit.href); };
  return <div ref={box} className="relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}>
    <label htmlFor={id} className="sr-only">Wertpapiere, Investoren und Politiker suchen</label>
    <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
    <input id={id} type="search" role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={`${id}-results`} aria-activedescendant={visible && active >= 0 && hits[active] ? `${id}-${active}` : undefined} autoComplete="off" value={q} placeholder="Suchen …" onFocus={() => {void ensureData();setOpen(true);}} onChange={e => {setQ(e.target.value);setOpen(true);setActive(-1);}} onKeyDown={e => { if(e.key === "Escape") {setOpen(false);setActive(-1);} else if (e.key === "ArrowDown" || e.key === "ArrowUp") {e.preventDefault();setOpen(true);setActive(old => hits.length ? (old + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length : -1);} else if(e.key === "Enter" && visible && hits[active]) {e.preventDefault();choose(hits[active]);} }} className="field w-36 !pl-9 transition-[width] duration-200 focus:w-48 sm:w-48 sm:focus:w-60 md:w-36 lg:w-48"/>
    {visible && <div className="glass absolute right-0 z-40 mt-2 max-h-[65dvh] w-[min(22rem,calc(100vw-2rem))] overflow-auto rounded-3xl p-2">
      {loading && <p role="status" className="p-3 text-sm text-subtle">Suche wird geladen …</p>}
      {failed && <div role="status" className="p-3 text-sm text-amber-800">Ein Teil der Suche ist nicht verfügbar. <button onClick={() => void ensureData()} className="underline">Erneut versuchen</button></div>}
      {!loading && !failed && !hits.length && <p role="status" className="p-3 text-sm text-subtle">Keine Treffer für „{q}“.</p>}
      <ul id={`${id}-results`} role="listbox" aria-label="Suchergebnisse">{hits.map((hit,index) => <li key={hit.href} id={`${id}-${index}`} role="option" aria-selected={index === active} onPointerDown={e => e.preventDefault()} onClick={() => choose(hit)} onPointerMove={() => setActive(index)} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm text-ink ${index === active ? "bg-white/90 shadow-[inset_0_1px_0_#fff,0_2px_8px_rgb(28_28_30/0.08)]" : ""}`}>{hit.ticker ? <CompanyLogo ticker={hit.ticker} company={hit.name} size={28} rounded="rounded-lg" /> : <Avatar name={hit.name} size={28} />}<span className="min-w-0 flex-1 truncate font-medium">{hit.name}</span><span className={`shrink-0 text-xs text-subtle ${hit.ticker ? "font-mono" : ""}`}>{hit.kind}</span></li>)}</ul>
      <p className="px-3 pt-2 text-[11px] text-subtle">↑ ↓ auswählen · Enter öffnen · Esc schließen</p>
    </div>}
  </div>;
}
