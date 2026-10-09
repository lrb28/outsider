"use client";
import { stockHref } from "@/lib/format";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Icon } from "@/components/Icon";
import { fetchCatalogue } from "@/lib/fetchJson";
import type { InvestorsResponse, PoliticiansResponse, StocksResponse } from "@/lib/types";
type Hit = { name: string; keywords: string; href: string; kind: string; ticker?: string; photo?: string | null };
// Recently opened results (after Eaves), kept on this device only.
const RECENT = "aura:recent-searches";
function readRecent(): Hit[] {
  try { const v: unknown = JSON.parse(localStorage.getItem(RECENT) || "[]"); return Array.isArray(v) ? v.filter((h): h is Hit => !!h && typeof h.href === "string" && typeof h.name === "string" && h.href.startsWith("/")).slice(0, 6) : []; } catch { return []; }
}
function writeRecent(list: Hit[]) { try { localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 6))); } catch { /* private mode: no history */ } }
/** `openWidth`: the field's width once tapped (narrower beside other buttons). */
export function SearchBox({ openWidth = "w-48 sm:w-60" }: { openWidth?: string }) {
  const [q,setQ] = useState(""); const [open,setOpen] = useState(false);
  const [items,setItems] = useState<Hit[]>([]); const [loading,setLoading] = useState(false);
  const [failed,setFailed] = useState(false); const [active,setActive] = useState(-1);
  const [recent,setRecent] = useState<Hit[]>([]);
  const loaded = useRef(false); const busy = useRef(false); const box = useRef<HTMLDivElement>(null);
  const router = useRouter(); const id = useId(); const path = usePathname();
  async function ensureData() {
    if (loaded.current || busy.current) return;
    busy.current = true; setLoading(true); setFailed(false);
    const results = await Promise.allSettled([
      fetchCatalogue<InvestorsResponse>("/api/investors").then(d => d.rows.map(r => ({name:r.person ?? r.fund,keywords:`${r.person} ${r.fund}`,href:`/investor/${r.slug}`,kind:"Investor"}))),
      fetchCatalogue<StocksResponse>("/api/stocks").then(d => d.rows.filter(r => r.ticker).map(r => ({name:r.company,keywords:`${r.company} ${r.ticker}`,href:stockHref(r.ticker!),kind:r.ticker!,ticker:r.ticker!}))),
      fetchCatalogue<PoliticiansResponse>("/api/politicians").then(d => d.rows.map(r => ({name:r.name,keywords:`${r.name} ${r.seat ?? ""}`,href:`/politician/${r.slug}`,kind:"Politician",photo:r.photo}))),
    ]);
    setItems(results.flatMap(result => result.status === "fulfilled" ? result.value : []));
    loaded.current = results.every(r => r.status === "fulfilled"); setFailed(!loaded.current); setLoading(false); busy.current = false;
  }
  const input = useRef<HTMLInputElement>(null);
  // The action menu's "Suchen" focuses this field.
  useEffect(() => { const focus = () => { input.current?.focus(); void ensureData(); setRecent(readRecent()); setOpen(true); }; window.addEventListener("aura:search", focus); return () => window.removeEventListener("aura:search", focus); });
  useEffect(() => { const close = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };document.addEventListener("pointerdown",close);return () => document.removeEventListener("pointerdown",close); },[]);
  const needle = q.trim().toLocaleLowerCase("en-US");
  // With nothing typed, the list shows the recent searches instead.
  const hits = needle ? items.filter(r => r.keywords.toLocaleLowerCase("en-US").includes(needle)).slice(0,10) : recent;
  const visible = open && (!!needle || recent.length > 0);
  const remember = (hit: Hit) => { const next = [hit, ...readRecent().filter(h => h.href !== hit.href)]; writeRecent(next); setRecent(next.slice(0, 6)); };
  const reset = () => { setOpen(false);setQ("");setActive(-1);input.current?.blur(); };
  const choose = (hit: Hit) => { remember(hit);reset();router.push(hit.href); };
  // A result is a real link, so a tap navigates even if iOS has already moved
  // focus away from the field; the new page then closes the list.
  useEffect(() => { setOpen(false);setQ("");setActive(-1); }, [path]);
  // Close only when focus really lands elsewhere (keyboard Tab). A tap on a
  // result blurs the field on iOS before the click arrives; closing then
  // removed the list under the finger and the tap hit nothing.
  return <div ref={box} className="relative" onBlur={e => { const next = e.relatedTarget as Node | null; if (next && !e.currentTarget.contains(next)) setOpen(false); }}>
    <label htmlFor={id} className="sr-only">Search stocks, investors and politicians</label>
    <Icon name="search" className="pointer-events-none absolute left-[13px] top-1/2 z-10 h-[18px] w-[18px] -translate-y-1/2 text-ink/70" />
    <input ref={input} id={id} type="search" role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls={`${id}-results`} aria-activedescendant={visible && active >= 0 && hits[active] ? `${id}-${active}` : undefined} autoComplete="off" value={q} onFocus={() => {void ensureData();setRecent(readRecent());setOpen(true);}} onChange={e => {setQ(e.target.value);setOpen(true);setActive(-1);}} onKeyDown={e => { if(e.key === "Escape") {setOpen(false);setActive(-1);} else if (e.key === "ArrowDown" || e.key === "ArrowUp") {e.preventDefault();setOpen(true);setActive(old => hits.length ? (old + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length : -1);} else if(e.key === "Enter" && visible) {e.preventDefault();if (hits[active]) choose(hits[active]); else if (needle) {const term = q.trim();reset();router.push(`/feed?q=${encodeURIComponent(term)}`);}} }} className={`search-capsule h-11 rounded-full text-[15px] text-ink outline-none transition-[width] duration-300 ease-spring ${open || q ? `${openWidth} cursor-text !pl-10 pr-3` : "w-11 cursor-pointer !px-0 text-transparent"}`}/>
    {visible && <div className="glass absolute right-0 z-40 mt-2 max-h-[65dvh] w-[min(22rem,calc(100vw-2rem))] overflow-auto rounded-3xl p-2">
      {!needle && <div className="flex items-center justify-between px-3 pb-1 pt-2"><span className="text-[13px] font-semibold text-subtle">Recent</span><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { writeRecent([]); setRecent([]); setActive(-1); }} className="press-sm !min-h-8 rounded-full px-2 text-[13px] font-medium text-subtle hover:text-ink">Clear</button></div>}
      {needle && loading && <p role="status" className="p-3 text-sm text-subtle">Loading search …</p>}
      {needle && failed && <div role="status" className="p-3 text-sm text-warn">Part of the search is unavailable. <button onClick={() => void ensureData()} className="underline">Try again</button></div>}
      {needle && !loading && !failed && !hits.length && <p role="status" className="px-3 pb-1 pt-3 text-sm text-subtle">No investors, stocks or politicians for “{q}”.</p>}
      <ul id={`${id}-results`} role="listbox" aria-label="Search results">{hits.map((hit,index) => <li key={hit.href} id={`${id}-${index}`} role="option" aria-selected={index === active}>
        <Link href={hit.href} onClick={() => { remember(hit); reset(); }} onMouseDown={e => e.preventDefault()} onPointerMove={() => setActive(index)} className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-[15px] text-ink active:bg-ink/[0.08] ${index === active ? "bg-ink/[0.06]" : ""}`}>
          {hit.ticker ? <CompanyLogo ticker={hit.ticker} company={hit.name} size={30} rounded="rounded-[9px]" /> : <Avatar name={hit.name} src={hit.photo} kind={hit.kind === "Politician" ? "politician" : "investor"} size={30} />}
          <span className="min-w-0 flex-1 truncate font-medium">{hit.name}</span><span className="shrink-0 text-xs text-subtle">{hit.kind}</span>
        </Link>
      </li>)}
        {/* Insiders and every other ticker live in the disclosures. */}
        {needle && <li role="option" aria-selected={false}>
          <Link href={`/feed?q=${encodeURIComponent(q.trim())}`} onClick={reset} onMouseDown={e => e.preventDefault()} className="flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2 text-[15px] text-ink active:bg-ink/[0.08]">
            <span className="icon-ring h-[30px] w-[30px]"><Icon name="search" className="h-4 w-4 text-subtle" /></span>
            <span className="min-w-0 flex-1 truncate">All filings for “{q.trim()}”</span>
          </Link>
        </li>}
      </ul>
      <p className="px-3 pt-2 text-[11px] text-subtle">↑ ↓ select · Enter open · Esc close</p>
    </div>}
  </div>;
}
