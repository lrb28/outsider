"use client";

import Link from "next/link";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { DataStatus } from "@/components/DataStatus";
import { ErrorRetry } from "@/components/ErrorRetry";
import { Icon } from "@/components/Icon";
import { Skeleton, SkeletonList } from "@/components/Skeleton";
import { SwipeRow } from "@/components/SwipeRow";
import { TradeDetailModal } from "@/components/TradeDetailModal";
import { Watchlist } from "@/components/Watchlist";
import { fetchCatalogue, fetchJson } from "@/lib/fetchJson";
import { abbrevMoney, companyName, formatDate, investorPerson, pct, tradeSignal } from "@/lib/format";
import { getTxns, positionsFrom } from "@/lib/portfolio";
import type { CollectionItem, DiscoverData, FeedRow, InvestorRow, InvestorsResponse, MatchResponse, MatchRow, TradesResponse } from "@/lib/types";

/* ── Gateway hero card: floating logos on a soft gradient ─────────────────── */
const LOGO_SPOTS = [
  { left: "14%", top: "32%", rot: -8, size: 58 },
  { left: "50%", top: "9%", rot: 7, size: 66 },
  { left: "46%", top: "50%", rot: -3, size: 54 },
];

function GatewayCard({ href, title, subtitle, gradient, items }: { href: string; title: string; subtitle: string; gradient: string; items: CollectionItem[] }) {
  return (
    <Link href={href} className={`lcard lcard-hover press relative flex h-72 w-[300px] shrink-0 snap-start flex-col justify-end overflow-hidden p-5 ${gradient}`}>
      <div className="absolute inset-x-0 top-0 h-44">
        {items.slice(0, 3).map((it, i) => {
          const s = LOGO_SPOTS[i];
          return (
            <div key={`${it.ticker ?? it.company}-${i}`} className="animate-floaty absolute drop-shadow-md" style={{ left: s.left, top: s.top, "--rot": `${s.rot}deg`, animationDelay: `${i * 0.7}s` } as CSSProperties}>
              <CompanyLogo ticker={it.ticker} company={it.company} size={s.size} rounded="rounded-2xl" />
            </div>
          );
        })}
      </div>
      <div className="glass -mx-2 -mb-2 rounded-2xl px-4 py-3">
        <div className="flex items-center justify-between gap-2 text-lg font-semibold leading-tight tracking-tight text-ink">
          {title}
          <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-subtle" />
        </div>
        <p className="mt-1 text-sm leading-snug text-subtle">{subtitle}</p>
      </div>
    </Link>
  );
}

function GatewaySkeleton() {
  return <div className="lcard flex h-72 w-[300px] shrink-0 flex-col justify-end gap-2 p-5"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-3 w-5/6" /></div>;
}

/* ── Trade card: who, what happened, which company ────────────────────────── */
function TradeCard({ row, onOpen }: { row: FeedRow; onOpen: () => void }) {
  const signal = tradeSignal(row);
  const company = companyName(row.ticker, row.securityName);
  const name = row.entityType === "institution" ? investorPerson(row.entityName) ?? row.entityName : row.entityName;
  const perf = row.pctSinceDisclosure;
  const tone = signal.tone === "bull" ? "text-bull" : signal.tone === "bear" ? "text-bear" : "text-ink";
  return (
    <button onClick={onOpen} className="lcard lcard-hover press w-72 shrink-0 snap-start p-4 text-left">
      <div className="relative mb-3 h-12 w-16">
        <Avatar name={row.entityName} size={46} />
        <div className="absolute -bottom-1 left-8 rounded-lg ring-2 ring-white">
          <CompanyLogo ticker={row.ticker} company={company} size={28} rounded="rounded-lg" />
        </div>
      </div>
      <div className="text-sm leading-snug">
        <span className="font-semibold">{name}</span>
        <span className="text-subtle"> · </span>
        <span className={`font-medium ${tone}`}>{signal.text}</span>
        <span className="text-subtle"> · </span>
        <span className="font-semibold">{company}</span>
      </div>
      <div className="mt-1.5 text-xs text-subtle">
        {row.sizeDisplay} · {formatDate(row.disclosedAt)}
        {perf != null && <span className={perf >= 0 ? "text-bull" : "text-bear"}> · {pct(perf)} seit Meldung</span>}
      </div>
    </button>
  );
}

/* ── Section shell ────────────────────────────────────────────────────────── */
function Section({ title, moreHref, moreLabel = "Alle", children }: { title: string; moreHref?: string; moreLabel?: string; children: ReactNode }) {
  return (
    <section className="fade-up space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {moreHref && (
          <Link href={moreHref} className="inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-subtle hover:text-ink">
            {moreLabel}
            <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Ein einzelner 13F-Bericht oder eine Form-4-Serie erzeugt Dutzende Zeilen zum
 * selben Akteur bzw. zur selben Aktie. Deshalb je Akteur höchstens zwei und je
 * Aktie nur die jüngste Karte zeigen.
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
  // Lieber ein paar Wiederholungen als eine fast leere Reihe.
  return out.length >= 3 ? out : rows.slice(0, n);
}

export default function HomePage() {
  const [discover, setDiscover] = useState<DiscoverData | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [inst, setInst] = useState<FeedRow[] | null>(null);
  const [insiders, setInsiders] = useState<FeedRow[] | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [depotCount, setDepotCount] = useState(0);
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
    setDepotCount(holdings.length);
    if (holdings.length) {
      const tickers = holdings.map(p => p.ticker).filter(t => /^[A-Z0-9.\-]{1,12}$/.test(t)).slice(0, 200).join(",");
      fetchJson<MatchResponse>(`/api/match?tickers=${encodeURIComponent(tickers)}`, { signal: controller.signal }).then(d => setMatches(d.rows.slice(0, 5))).catch(() => {});
    }
    return () => controller.abort();
  }, [attempt]);
  const retry = () => setAttempt(n => n + 1);

  const spotlight = investors.filter(i => i.person).slice(0, 10);
  const gateways = [
    { href: "/discover/boughtq", title: "Häufigste Aufstockungen", subtitle: "Diese Aktien stocken die verfolgten Investoren im letzten 13F-Quartal am häufigsten auf.", gradient: "bg-gradient-to-b from-sky-200 via-sky-100 to-blue-50", items: discover?.mostBoughtQ ?? [] },
    { href: "/discover/insiderbuys", title: "Insider greifen zu", subtitle: "Bestätigte Form-4-Käufe von Führungskräften der letzten 90 Tage.", gradient: "bg-gradient-to-b from-emerald-200 via-emerald-100 to-teal-50", items: discover?.insiderBuys ?? [] },
    { href: "/discover/conviction", title: "Die mutigsten Wetten", subtitle: "Aktien mit dem höchsten Anteil am gemeldeten Depot eines Investors.", gradient: "bg-gradient-to-b from-zinc-300 via-zinc-100 to-white", items: discover?.highestConviction ?? [] },
    { href: "/discover/biggest", title: "Die größten Positionen", subtitle: "Die wertvollsten gemeldeten Einzelpositionen des smarten Geldes.", gradient: "bg-gradient-to-b from-amber-200 via-orange-100 to-yellow-50", items: discover?.biggest ?? [] },
  ];

  return (
    <div className="space-y-9">
      {/* Gateway hero */}
      <div>
        <h1 className="sr-only">Outsider – öffentliche Meldungen von Investoren, Insidern und US-Politikern</h1>
        {errors.includes("discover") ? <ErrorRetry onRetry={retry} /> : (
          <SwipeRow className="fade-up gap-4">
            {discover ? gateways.map(g => <GatewayCard key={g.href} {...g} />) : [0, 1, 2].map(i => <GatewaySkeleton key={i} />)}
          </SwipeRow>
        )}
      </div>

      <Watchlist />

      {/* Portfolio matches */}
      {depotCount > 0 && matches.length > 0 && (
        <Section title="Portfolio-Matches" moreHref="/me" moreLabel="Mein Depot">
          <SwipeRow className="gap-4">
            {matches.map(m => (
              <Link key={m.slug} href={`/investor/${m.slug}`} className="lcard lcard-hover press flex w-56 shrink-0 snap-start flex-col items-center p-5 text-center">
                <Avatar name={m.person ?? m.fund} size={64} />
                <div className="mt-2 w-full truncate text-sm font-semibold">{m.person ?? m.fund}</div>
                <div className="mt-1 text-xl font-bold text-ink">
                  {m.sharedCount} <span className="text-xs font-medium text-subtle">von {depotCount} deiner Werte</span>
                </div>
                <div className="mt-2 flex items-center">
                  {m.sharedTickers.slice(0, 3).map((t, i) => (
                    <div key={t} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }} className="rounded-lg ring-2 ring-white">
                      <CompanyLogo ticker={t} company={t} size={26} rounded="rounded-lg" />
                    </div>
                  ))}
                </div>
              </Link>
            ))}
          </SwipeRow>
        </Section>
      )}

      {/* Spotlight */}
      <Section title="Im Rampenlicht" moreHref="/discover?tab=investors">
        {errors.includes("investors") ? <ErrorRetry onRetry={retry} /> : spotlight.length === 0 ? <SkeletonList n={2} /> : (
          <SwipeRow className="gap-4">
            {spotlight.map(iv => (
              <Link key={iv.slug} href={`/investor/${iv.slug}`} className="press w-40 shrink-0 snap-start">
                <div className="lcard lcard-hover flex h-40 items-center justify-center !bg-gradient-to-b from-sky-200 via-sky-100 to-blue-50">
                  <Avatar name={iv.person ?? iv.fund} size={92} />
                </div>
                <div className="mt-2 px-1">
                  <div className="truncate text-sm font-semibold">{iv.person ?? iv.fund}</div>
                  <div className="text-xs text-subtle">{abbrevMoney(iv.value)} · 13F {formatDate(iv.asOf)}</div>
                </div>
              </Link>
            ))}
          </SwipeRow>
        )}
      </Section>

      {/* Recent disclosures */}
      {[
        { key: "inst", title: "Letzte Investoren-Meldungen", type: "institution", rows: inst, empty: "Noch keine Investoren-Meldungen." },
        { key: "insiders", title: "Letzte Insider-Meldungen", type: "corporate_insider", rows: insiders, empty: "Noch keine Insider-Meldungen." },
      ].map(section => (
        <Section key={section.key} title={section.title} moreHref={`/feed?type=${section.type}`} moreLabel="Zum Feed">
          {errors.includes(section.key) ? <ErrorRetry onRetry={retry} /> : section.rows === null ? <SkeletonList n={3} /> : section.rows.length === 0 ? (
            <div className="lcard p-8 text-center text-sm text-subtle">{section.empty}</div>
          ) : (
            <SwipeRow className="gap-4">
              {varied(section.rows).map(row => <TradeCard key={row.id} row={row} onOpen={() => setSelected(row)} />)}
            </SwipeRow>
          )}
        </Section>
      ))}

      <DataStatus />

      {selected && <TradeDetailModal row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
