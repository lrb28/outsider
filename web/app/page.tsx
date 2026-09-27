"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { DataStatus } from "@/components/DataStatus";
import { ErrorRetry } from "@/components/ErrorRetry";
import { SkeletonList } from "@/components/Skeleton";
import { SwipeRow } from "@/components/SwipeRow";
import { TradeDetailModal } from "@/components/TradeDetailModal";
import { Watchlist } from "@/components/Watchlist";
import { fetchCatalogue, fetchJson } from "@/lib/fetchJson";
import { abbrevMoney, companyName, formatDate, investorPerson, tradeSignal } from "@/lib/format";
import { getTxns, positionsFrom } from "@/lib/portfolio";
import type { DiscoverData, FeedRow, InvestorRow, InvestorsResponse, MatchResponse, MatchRow, TradesResponse } from "@/lib/types";

function varied(rows: FeedRow[]) {
  const entities = new Map<string, number>();
  const tickers = new Set<string>();
  const result: FeedRow[] = [];
  for (const row of rows) {
    const id = row.entitySlug ?? row.entityName;
    if ((entities.get(id) ?? 0) >= 2 || row.ticker && tickers.has(row.ticker)) continue;
    entities.set(id, (entities.get(id) ?? 0) + 1);
    if (row.ticker) tickers.add(row.ticker);
    result.push(row);
    if (result.length === 6) break;
  }
  return result;
}
function TradeCard({ row, onOpen }: { row: FeedRow; onOpen: () => void }) {
  const signal = tradeSignal(row);
  const company = companyName(row.ticker, row.securityName);
  return <button onClick={onOpen} className="press flex w-72 shrink-0 snap-start flex-col rounded-2xl border border-hair bg-white p-5 text-left hover:border-indigo-200 hover:shadow-cardhover">
    <div className="mb-4 flex w-full items-center justify-between"><Avatar name={row.entityName} size={38} /><CompanyLogo ticker={row.ticker} company={company} size={34} /></div>
    <span className="text-xs text-subtle">{row.entityType === "institution" ? investorPerson(row.entityName) ?? row.entityName : row.entityName}</span>
    <span className="mt-1 text-base font-semibold">{company}</span>
    <span className={`mt-3 text-sm font-medium ${signal.tone === "bull" ? "text-bull" : signal.tone === "bear" ? "text-bear" : "text-slate-600"}`}>{signal.text}</span>
    <span className="mt-1 text-xs text-subtle">{row.sizeDisplay} · {formatDate(row.disclosedAt)}</span>
    <span className="mt-4 text-xs font-medium text-brand">Meldung und Beleg ansehen →</span>
  </button>;
}
export default function HomePage() {
  const [discover, setDiscover] = useState<DiscoverData | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [inst, setInst] = useState<FeedRow[] | null>(null);
  const [insiders, setInsiders] = useState<FeedRow[] | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<FeedRow | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const fail = (key: string) => { if (!controller.signal.aborted) setErrors(e => [...e, key]); };
    setErrors([]);
    fetchCatalogue<DiscoverData>("/api/discover").then(d => { if (!controller.signal.aborted) setDiscover(d); }).catch(() => fail("discover"));
    fetchCatalogue<InvestorsResponse>("/api/investors").then(d => { if (!controller.signal.aborted) setInvestors(d.rows); }).catch(() => fail("investors"));
    fetchJson<TradesResponse>("/api/trades?type=institution&limit=120", { signal: controller.signal }).then(d => setInst(d.rows)).catch(() => fail("inst"));
    fetchJson<TradesResponse>("/api/trades?type=corporate_insider&limit=60", { signal: controller.signal }).then(d => setInsiders(d.rows)).catch(() => fail("insiders"));
    const holdings = positionsFrom(getTxns()).filter(p => p.shares > 0);
    if (holdings.length) fetchJson<MatchResponse>(`/api/match?tickers=${encodeURIComponent(holdings.map(p => p.ticker).filter(t => /^[A-Z0-9.\-]{1,12}$/.test(t)).slice(0, 200).join(","))}`, { signal: controller.signal }).then(d => setMatches(d.rows.slice(0, 4))).catch(() => {});
    return () => controller.abort();
  }, [attempt]);
  const retry = () => setAttempt(n => n + 1);
  const cards = [
    { href: "/discover/boughtq", label: "Investoren", title: "Was sich im Portfolio verändert", description: "Aufstockungen aus den letzten erfassten 13F-Quartalen.", items: discover?.mostBoughtQ ?? [], color: "from-sky-100 to-white" },
    { href: "/discover/insiderbuys", label: "Unternehmensinsider", title: "Käufe mit Originalbeleg", description: "Bestätigte Form-4-Käufe der letzten 90 Tage.", items: discover?.insiderBuys ?? [], color: "from-emerald-100 to-white" },
    { href: "/feed?type=politician", label: "US-Politiker", title: "Politik und Wertpapiermeldungen", description: "Erfasste Offenlegungen mit Datum und gemeldeter Betragsspanne.", items: [], color: "from-violet-100 to-white" },
  ];
  return <div className="space-y-10 sm:space-y-12">
    <section className="fade-up grid gap-8 rounded-3xl border border-indigo-100 bg-white/70 px-6 py-8 sm:p-9 lg:grid-cols-[1.5fr_1fr] lg:items-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Öffentliche Daten. Mehr Einblick.</p>
        <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl">Die Meldung dahinter.<br /><span className="text-indigo-600">Dein eigener Blick.</span></h1>
        <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">Entdecke, was Investoren, Unternehmensinsider und US-Politiker offenlegen. Mit Quellen und Kontext für deine eigene Recherche.</p>
        <div className="mt-7 flex flex-wrap gap-3"><Link href="/feed" className="btn-primary inline-flex min-h-11 items-center px-5">Meldungen ansehen <span aria-hidden="true" className="ml-3">→</span></Link><Link href="/discover?tab=investors" className="inline-flex min-h-11 items-center rounded-full border border-hair bg-white px-5 text-sm font-semibold hover:border-indigo-300">Investoren entdecken</Link></div>
        <p className="mt-5 text-xs text-subtle">Zeitversetzte Offenlegungen · Keine Anlageberatung</p>
      </div>
      <aside className="rounded-2xl bg-slate-900 p-6 text-white">
        <p className="text-xs font-medium uppercase tracking-widest text-indigo-200">Wissen, was die Daten sagen</p>
        <div className="mt-5 space-y-4">
          {[['01', 'Investoren', 'Gemeldete Bestände zum Quartalsende.'], ['02', 'Insider', 'Käufe, Verkäufe und weitere Eigentumsänderungen.'], ['03', 'Politiker', 'Offenlegungen mit Betragsspannen.']].map(([n, title, description]) => <div key={n} className="flex gap-3"><span className="pt-0.5 font-mono text-xs text-indigo-300">{n}</span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-slate-300">{description}</p></div></div>)}
        </div>
        <Link href="/methodik" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-indigo-200 underline underline-offset-4">Quellen und Grenzen verstehen →</Link>
      </aside>
    </section>
    <DataStatus />
    <section aria-labelledby="explore-title" className="space-y-4">
      <div className="flex items-center justify-between gap-3"><h2 id="explore-title" className="text-xl font-semibold tracking-tight">Eine neue Perspektive</h2><Link href="/discover" className="text-sm text-brand">Alles entdecken →</Link></div>
      {errors.includes("discover") && <ErrorRetry onRetry={retry}/>}
      <div className="grid gap-4 sm:grid-cols-3">{cards.map(card => <Link key={card.href} href={card.href} className={`press flex flex-col rounded-2xl border border-hair bg-gradient-to-b p-5 hover:shadow-cardhover ${card.color}`}>
        <div className="flex min-h-11 items-center justify-between gap-2"><span className="text-xs font-medium text-slate-600">{card.label}</span><span aria-hidden="true" className="text-brand">↗</span></div>
        {card.items.length > 0 && <div className="my-3 flex gap-2">{card.items.slice(0, 3).map((item, i) => <CompanyLogo key={`${item.ticker}-${i}`} ticker={item.ticker} company={item.company} size={36} />)}</div>}
        <h3 className="mt-3 text-lg font-semibold leading-snug">{card.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
      </Link>)}</div>
    </section>
    <Watchlist />
    {matches.length > 0 && <section className="space-y-4"><h2 className="text-xl font-semibold">Überschneidungen mit deinem Depot</h2><div className="grid gap-3 sm:grid-cols-2">{matches.map(m => <Link className="rounded-2xl border border-hair bg-white p-4" href={`/investor/${m.slug}`} key={m.slug}><span className="font-semibold">{m.person ?? m.fund}</span><p className="mt-1 text-sm text-subtle">{m.sharedCount} gemeinsame Wertpapiere im gemeldeten Portfolio</p></Link>)}</div></section>}
    <section className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Investoren im Blick</h2><Link href="/discover?tab=investors" className="text-sm text-brand">Alle ansehen →</Link></div>
      {errors.includes("investors") ? <ErrorRetry onRetry={retry} /> : <SwipeRow>{investors.slice(0, 10).map(iv => <Link key={iv.slug} href={`/investor/${iv.slug}`} className="press w-44 shrink-0 snap-start rounded-2xl border border-hair bg-white p-5 hover:shadow-cardhover"><Avatar name={iv.person ?? iv.fund} size={56} /><div className="mt-4 truncate text-sm font-semibold">{iv.person ?? iv.fund}</div><p className="mt-1 text-xs text-subtle">{abbrevMoney(iv.value)}</p><p className="mt-1 text-[11px] text-subtle">13F · {formatDate(iv.asOf)}</p></Link>)}</SwipeRow>}
    </section>
    {([{ key: "inst", title: "Gemeldete Bestandsänderungen", type: "institution", rows: inst }, { key: "insiders", title: "Neue Insider-Meldungen", type: "corporate_insider", rows: insiders }]).map(section => <section key={section.key} className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{section.title}</h2><Link href={`/feed?type=${section.type}`} className="text-sm text-brand">Zum gefilterten Feed →</Link></div>
      {errors.includes(section.key) ? <ErrorRetry onRetry={retry} /> : section.rows === null ? <SkeletonList n={3} /> : section.rows.length === 0 ? <p className="rounded-2xl border border-hair bg-white p-6 text-sm text-subtle">Noch keine Meldungen vorhanden.</p> : <SwipeRow>{varied(section.rows).map(row => <TradeCard key={row.id} row={row} onOpen={() => setSelected(row)} />)}</SwipeRow>}
    </section>)}
    {selected && <TradeDetailModal row={selected} onClose={() => setSelected(null)} />}
  </div>;
}
