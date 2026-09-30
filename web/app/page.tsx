"use client";

import Link from "next/link";
import { type CSSProperties, useEffect, useState } from "react";

import { AuraField } from "@/components/AuraField";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CountUp } from "@/components/CountUp";
import { DataStatus } from "@/components/DataStatus";
import { ErrorRetry } from "@/components/ErrorRetry";
import { Icon } from "@/components/Icon";
import { Skeleton, SkeletonList } from "@/components/Skeleton";
import { SwipeRow } from "@/components/SwipeRow";
import { TradeDetailModal } from "@/components/TradeDetailModal";
import { AuraCard, SectionHeader } from "@/components/ui";
import { Watchlist } from "@/components/Watchlist";
import { fetchCatalogue, fetchJson } from "@/lib/fetchJson";
import { abbrevMoney, auraOf, companyName, formatDate, investorPerson, pct, tradeSignal } from "@/lib/format";
import { getTxns, positionsFrom } from "@/lib/portfolio";
import type { StatsResponse } from "@/lib/stats";
import type { CollectionItem, DiscoverData, FeedRow, InvestorRow, InvestorsResponse, MatchResponse, MatchRow, PoliticianRow, PoliticiansResponse, TradesResponse } from "@/lib/types";

/* ── Floating logos for the entry cards ──────────────────────────────────── */
// Three logos in a loose row, each tilted a little and bobbing on its own
// beat. They never overlap: stacked tiles hid each other's marks.
const LOGO_TILT = [-6, 4, -3];

function FloatingLogos({ items }: { items: CollectionItem[] }) {
  return (
    <div className="flex h-28 items-center gap-3 pl-1">
      {items.slice(0, 3).map((it, i) => (
        <div
          key={`${it.ticker ?? it.company}-${i}`}
          className="animate-floaty flex"
          style={{ "--rot": `${LOGO_TILT[i]}deg`, animationDelay: `${i * 0.7}s`, marginTop: i === 1 ? -18 : 12 } as CSSProperties}
        >
          <CompanyLogo ticker={it.ticker} company={it.company} size={60} rounded="rounded-[16px]" className="logo-lift" />
        </div>
      ))}
    </div>
  );
}

/* ── Trade card: who, what happened, which company ────────────────────────── */
function TradeCard({ row, onOpen }: { row: FeedRow; onOpen: () => void }) {
  const signal = tradeSignal(row);
  const company = companyName(row.ticker, row.securityName);
  const name = row.entityType === "institution" ? investorPerson(row.entityName) ?? row.entityName : row.entityName;
  const insider = row.entityType === "corporate_insider";
  const perf = row.pctSinceDisclosure;
  const tone = signal.tone === "bull" ? "text-bull" : signal.tone === "bear" ? "text-bear" : "text-ink";
  return (
    <button onClick={onOpen} className="card lcard-hover press w-72 shrink-0 snap-start p-4 text-left">
      <div className="relative mb-3 h-12 w-16">
        {insider ? (
          // An insider's picture is their company's logo, so no second badge.
          <CompanyLogo ticker={row.ticker} company={company} size={46} rounded="rounded-[14px]" />
        ) : (
          <>
            <Avatar name={name} src={row.entityPhoto} kind={auraOf(row.entityType)} size={46} />
            <CompanyLogo ticker={row.ticker} company={company} size={28} rounded="rounded-[10px]" className="logo-lift !absolute -bottom-1 left-8" />
          </>
        )}
      </div>
      <div className="text-[15px] leading-snug">
        <span className="font-semibold">{name}</span>
        <span className="text-subtle"> · </span>
        <span className={`font-medium ${tone}`}>{signal.text}</span>
        <span className="text-subtle"> · </span>
        <span className="font-semibold">{company}</span>
      </div>
      <div className="mt-1.5 text-[13px] text-subtle">
        {row.sizeDisplay} · {formatDate(row.disclosedAt)}
        {perf != null && <span className={perf >= 0 ? "text-bull" : "text-bear"}> · {perf >= 0 ? "▲" : "▼"} {pct(perf)} since filing</span>}
      </div>
    </button>
  );
}

function TradeCardSkeleton() {
  return (
    <div className="card w-72 shrink-0 space-y-3 p-4">
      <Skeleton className="h-11 w-11 rounded-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/**
 * A single row of cards per actor would be one fund's 13F over and over, so
 * each actor appears at most twice and each stock once.
 */
function varied(rows: FeedRow[], n = 8) {
  const entities = new Map<string, number>();
  const tickers = new Set<string>();
  const out: FeedRow[] = [];
  for (const row of rows) {
    const id = row.entitySlug ?? row.entityName;
    if ((entities.get(id) ?? 0) >= 2 || (row.ticker && tickers.has(row.ticker))) continue;
    entities.set(id, (entities.get(id) ?? 0) + 1);
    if (row.ticker) tickers.add(row.ticker);
    out.push(row);
    if (out.length >= n) break;
  }
  return out.length >= 3 ? out : rows.slice(0, n);
}

/* ── The three auras: who discloses ───────────────────────────────────────── */
function AuraTile({ href, kind, title, count, unit, faces }: { href: string; kind: "investor" | "insider" | "politician"; title: string; count: number | null; unit: string; faces: { name: string; src?: string | null; ticker?: string | null }[] }) {
  return (
    <Link href={href} className="card lcard-hover press relative flex min-h-[9rem] flex-col justify-between overflow-hidden p-3 sm:p-4">
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full blur-2xl" style={{ background: `rgb(var(--aura-${kind}) / 0.32)` }} />
      <div className="relative flex items-center">
        {faces.slice(0, 3).map((f, i) => (
          <div key={f.name + i} style={{ marginLeft: i === 0 ? 0 : -9, zIndex: 3 - i }} className="flex">
            <Avatar name={f.name} src={f.src} kind={kind} ticker={f.ticker} size={30} className="face-lift" />
          </div>
        ))}
        {faces.length === 0 && <Skeleton className="h-[34px] w-20 rounded-full" />}
      </div>
      <div className="relative">
        <div className="num-lg">{count == null ? "–" : <CountUp value={count} />}</div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[14px] font-semibold leading-tight">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full" style={{ background: `rgb(var(--aura-${kind}))` }} />
          {title}
        </div>
        <div className="mt-0.5 text-[12px] leading-tight text-subtle">{unit}</div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [discover, setDiscover] = useState<DiscoverData | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [politicians, setPoliticians] = useState<PoliticianRow[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [inst, setInst] = useState<FeedRow[] | null>(null);
  const [insiders, setInsiders] = useState<FeedRow[] | null>(null);
  const [pols, setPols] = useState<FeedRow[] | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [depotCount, setDepotCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<FeedRow | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const live = () => !controller.signal.aborted;
    const fail = (key: string) => { if (live()) setErrors((e) => [...e, key]); };
    setErrors([]);
    fetchCatalogue<DiscoverData>("/api/discover").then((d) => live() && setDiscover(d)).catch(() => fail("discover"));
    fetchCatalogue<InvestorsResponse>("/api/investors").then((d) => live() && setInvestors(d.rows)).catch(() => fail("investors"));
    fetchCatalogue<PoliticiansResponse>("/api/politicians").then((d) => live() && setPoliticians(d.rows)).catch(() => {});
    fetchCatalogue<StatsResponse>("/api/stats").then((d) => live() && setStats(d)).catch(() => {});
    fetchJson<TradesResponse>("/api/trades?type=institution&limit=120", { signal: controller.signal }).then((d) => setInst(d.rows)).catch(() => fail("inst"));
    fetchJson<TradesResponse>("/api/trades?type=corporate_insider&limit=60", { signal: controller.signal }).then((d) => setInsiders(d.rows)).catch(() => fail("insiders"));
    fetchJson<TradesResponse>("/api/trades?type=politician&limit=60", { signal: controller.signal }).then((d) => setPols(d.rows)).catch(() => fail("pols"));
    const holdings = positionsFrom(getTxns()).filter((p) => p.shares > 0);
    setDepotCount(holdings.length);
    if (holdings.length) {
      const tickers = holdings.map((p) => p.ticker).filter((t) => /^[A-Z0-9.\-]{1,12}$/.test(t)).slice(0, 200).join(",");
      fetchJson<MatchResponse>(`/api/match?tickers=${encodeURIComponent(tickers)}`, { signal: controller.signal }).then((d) => setMatches(d.rows.slice(0, 5))).catch(() => {});
    }
    return () => controller.abort();
  }, [attempt]);
  const retry = () => setAttempt((n) => n + 1);

  const spotlight = investors.filter((i) => i.person).slice(0, 12);
  // Insiders are shown by their companies' logos, three different ones.
  const insiderFaces = (insiders ?? []).filter((r, i, all) => r.ticker && all.findIndex((x) => x.ticker === r.ticker) === i).slice(0, 3).map((r) => ({ name: r.entityName, ticker: r.ticker }));
  const gateways = [
    { href: "/discover/boughtq", aura: "investor" as const, title: "Most added to", blurb: "The stocks the tracked investors added to most often last quarter.", items: discover?.mostBoughtQ ?? [] },
    { href: "/discover/insiderbuys", aura: "insider" as const, title: "Insiders buying", blurb: "Officers and directors buying their own company’s stock with their own money.", items: discover?.insiderBuys ?? [] },
    { href: "/discover/conviction", aura: "neutral" as const, title: "The boldest bets", blurb: "Stocks that make up the largest share of an investor’s reported portfolio.", items: discover?.highestConviction ?? [] },
    { href: "/discover/biggest", aura: "neutral" as const, title: "The biggest positions", blurb: "The most valuable single positions reported by big money.", items: discover?.biggest ?? [] },
  ];

  return (
    <div className="space-y-10">
      {/* Hero: the aura behind plain, large type. */}
      <section className="fade-up relative isolate -mx-4 px-4 pb-2 pt-6 sm:pt-10">
        <AuraField focus={[0.85, 1.25, 1]} className="pointer-events-none absolute -right-40 -top-28 -z-10 h-[34rem] w-[48rem] max-w-none [mask-image:radial-gradient(closest-side,#000_35%,transparent)] sm:-right-16" />
        <p className="eyebrow">Live from the original sources</p>
        <h1 className="mt-3 max-w-2xl font-display text-[clamp(34px,11vw,44px)] font-bold leading-[0.98] tracking-[-0.025em] sm:text-[64px]">
          See what the powerful buy.
        </h1>
        <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-subtle">
          Investors, corporate insiders and members of Congress have to disclose their trades. ĀURA turns them into a clear overview — every row with its source.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link href="/feed" className="btn-primary">See the filings <Icon name="arrowRight" className="h-4 w-4" /></Link>
          <Link href="/discover" className="btn-capsule">Discover</Link>
        </div>
      </section>

      {/* The three auras */}
      <section className="fade-up grid grid-cols-3 gap-2.5 sm:gap-3" aria-label="Who discloses">
        <AuraTile href="/discover?tab=investors" kind="investor" title="Investors" unit="13F portfolios" count={stats?.institutions ?? (investors.length || null)} faces={spotlight.map((i) => ({ name: i.person ?? i.fund }))} />
        <AuraTile href="/feed?type=corporate_insider" kind="insider" title="Insiders" unit="with Form 4" count={stats?.insiders ?? null} faces={insiderFaces} />
        <AuraTile href="/discover?tab=politicians" kind="politician" title="Politicians" unit="in Congress" count={stats?.politicians ?? (politicians.length || null)} faces={politicians.slice(0, 3).map((p) => ({ name: p.name, src: p.photo }))} />
      </section>

      {/* Entry cards */}
      <section className="space-y-3">
        <SectionHeader title="Start here" href="/discover" />
        {errors.includes("discover") ? <ErrorRetry onRetry={retry} /> : (
          <SwipeRow className="gap-4">
            {discover
              ? gateways.map((g) => <AuraCard key={g.href} href={g.href} aura={g.aura} title={g.title} blurb={g.blurb} visual={<FloatingLogos items={g.items} />} className="h-72 w-[290px] shrink-0 snap-start" />)
              : [0, 1, 2].map((i) => <div key={i} className="card flex h-72 w-[290px] shrink-0 flex-col justify-end gap-2 p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-5/6" /></div>)}
          </SwipeRow>
        )}
      </section>

      <Watchlist />

      {depotCount > 0 && matches.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Who holds what you hold" href="/me" more="My portfolio" />
          <SwipeRow className="gap-4">
            {matches.map((m) => (
              <Link key={m.slug} href={`/investor/${m.slug}`} className="card lcard-hover press flex w-56 shrink-0 snap-start flex-col items-center p-5 text-center">
                <Avatar name={m.person ?? m.fund} size={64} />
                <div className="mt-2 w-full truncate text-[15px] font-semibold">{m.person ?? m.fund}</div>
                <div className="mt-1 num-lg">
                  {m.sharedCount} <span className="font-sans text-xs font-medium text-subtle">of your {depotCount} stocks</span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {m.sharedTickers.slice(0, 4).map((t) => (
                    <CompanyLogo key={t} ticker={t} company={t} size={28} rounded="rounded-[9px]" />
                  ))}
                </div>
              </Link>
            ))}
          </SwipeRow>
        </section>
      )}

      {/* Spotlight */}
      <section className="space-y-3">
        <SectionHeader title="In the spotlight" href="/discover?tab=investors" />
        {errors.includes("investors") ? <ErrorRetry onRetry={retry} /> : spotlight.length === 0 ? <SkeletonList n={2} /> : (
          <SwipeRow className="gap-4">
            {spotlight.map((iv) => (
              <Link key={iv.slug} href={`/investor/${iv.slug}`} className="press w-36 shrink-0 snap-start">
                <div className="card lcard-hover relative flex h-40 items-center justify-center overflow-hidden">
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3" style={{ background: "radial-gradient(70% 90% at 50% 100%, rgb(var(--aura-investor) / 0.22), transparent 70%)" }} />
                  <Avatar name={iv.person ?? iv.fund} size={92} className="relative" />
                </div>
                <div className="mt-2 px-1">
                  <div className="truncate text-[15px] font-semibold">{iv.person ?? iv.fund}</div>
                  <div className="text-[13px] text-subtle">{abbrevMoney(iv.value)} · {formatDate(iv.asOf)}</div>
                </div>
              </Link>
            ))}
          </SwipeRow>
        )}
      </section>

      {/* Recent disclosures */}
      {[
        { key: "pols", title: "New from politicians", type: "politician", rows: pols, empty: "No filings from the House yet." },
        { key: "insiders", title: "New from insiders", type: "corporate_insider", rows: insiders, empty: "No insider filings yet." },
        { key: "inst", title: "New from investors", type: "institution", rows: inst, empty: "No investor filings yet." },
      ].map((section) => (
        <section key={section.key} className="space-y-3">
          <SectionHeader title={section.title} href={`/feed?type=${section.type}`} />
          {errors.includes(section.key) ? <ErrorRetry onRetry={retry} /> : section.rows === null ? (
            <SwipeRow className="gap-4">{[0, 1, 2].map((i) => <TradeCardSkeleton key={i} />)}</SwipeRow>
          ) : section.rows.length === 0 ? (
            <div className="card p-8 text-center text-[15px] text-subtle">{section.empty}</div>
          ) : (
            <SwipeRow className="gap-4">
              {varied(section.rows).map((row) => <TradeCard key={row.id} row={row} onOpen={() => setSelected(row)} />)}
            </SwipeRow>
          )}
        </section>
      ))}

      <DataStatus />

      {selected && <TradeDetailModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
