"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ErrorRetry } from "@/components/ErrorRetry";
import { fetchCatalogue } from "@/lib/fetchJson";
import { Suspense, ReactNode, useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { FaceStack } from "@/components/FaceStack";
import { FollowButton } from "@/components/FollowButton";
import { LiquidGlass } from "@/components/LiquidGlass";
import { SkeletonList } from "@/components/Skeleton";
import { abbrevMoney, formatDate } from "@/lib/format";
import {
  CollectionInvestor,
  CollectionItem,
  DiscoverData,
  InvestorRow,
  InvestorsResponse,
  PoliticianRow,
  PoliticiansResponse,
  StockRow,
  StocksResponse,
} from "@/lib/types";
import { Icon } from "@/components/Icon";

type Tab = "highlights" | "investors" | "stocks" | "politicians";

const TABS: [Tab, string][] = [
  ["highlights", "Highlights"],
  ["investors", "Investoren"],
  ["stocks", "Aktien"],
  ["politicians", "Politiker"],
];

function LogoTrio({ items }: { items: CollectionItem[] }) {
  return (
    <div className="flex items-center">
      {items.slice(0, 3).map((it, i) => (
        <div
          key={(it.ticker ?? it.company) + i}
          style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }}
          className="rounded-2xl shadow-[0_2px_10px_rgb(28_28_30/0.18)]"
        >
          <CompanyLogo ticker={it.ticker} company={it.company} size={i === 0 ? 52 : 44} rounded="rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

function FaceTrio({ people }: { people: CollectionInvestor[] }) {
  return (
    <div className="flex items-center">
      {people.slice(0, 3).map((p, i) => (
        <div
          key={p.slug + i}
          style={{ marginLeft: i === 0 ? 0 : -12, zIndex: 3 - i }}
          className="rounded-full shadow-[0_2px_10px_rgb(28_28_30/0.18)]"
        >
          <Avatar name={p.person ?? p.fund} size={i === 0 ? 52 : 44} />
        </div>
      ))}
    </div>
  );
}

function Hero({
  href,
  title,
  blurb,
  gradient,
  visual,
}: {
  href: string;
  title: string;
  blurb: string;
  gradient: string;
  visual: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`press lcard-hover flex flex-col justify-between rounded-3xl p-5 shadow-card ring-1 ring-black/5 ${gradient}`}
    >
      {visual}
      <div className="mt-6">
        <div className="flex items-center gap-1 text-lg font-semibold tracking-tight text-slate-900">
          {title} <Icon name="chevronRight" className="inline h-4 w-4 align-[-2px] text-subtle" />
        </div>
        <p className="mt-1 text-sm leading-snug text-slate-600">{blurb}</p>
      </div>
    </Link>
  );
}

export default function DiscoverPage() { return <Suspense fallback={<SkeletonList n={4}/>}><Discover /></Suspense>; }
function Discover() {
  const query = useSearchParams(); const router = useRouter();
  const tab = (TABS.some(([key]) => key === query.get("tab")) ? query.get("tab") : "highlights") as Tab;
  const setTab = (key: Tab) => router.push(`/discover?tab=${key}`, {scroll:false});
  const [error,setError] = useState(false); const [retry,setRetry] = useState(0);
  const [data, setData] = useState<DiscoverData | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[] | null>(null);
  const [stocks, setStocks] = useState<StockRow[] | null>(null);
  const [politicians, setPoliticians] = useState<PoliticianRow[] | null>(null);

  useEffect(() => {
    let on = true; setError(false);
    const request = tab === "highlights" ? fetchCatalogue<DiscoverData>("/api/discover").then(d => {if(on) setData(d);})
      : tab === "investors" ? fetchCatalogue<InvestorsResponse>("/api/investors").then(d => {if(on) setInvestors(d.rows);})
      : tab === "stocks" ? fetchCatalogue<StocksResponse>("/api/stocks").then(d => {if(on) setStocks(d.rows);})
      : fetchCatalogue<PoliticiansResponse>("/api/politicians").then(d => {if(on) setPoliticians(d.rows);});
    request.catch(() => {if(on) setError(true);}); return () => {on = false;};
  }, [tab,retry]);

  const sortedStocks = useMemo(
    () => (stocks ? [...stocks].sort((a, b) => b.investors - a.investors) : null),
    [stocks],
  );

  return (
    <div className="space-y-6">
      <div className="fade-up">
        <h1 className="text-2xl font-semibold tracking-tight">Entdecken</h1>
        <p className="text-sm text-subtle">Öffentliche Meldungen und gemeldete Bestände einordnen.</p>
      </div>

      {/* Segments */}
      <LiquidGlass role="tablist" aria-label="Bereiche" radius={999} className="fade-up no-scrollbar flex w-fit max-w-full overflow-x-auto rounded-full p-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`press-sm shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
              tab === key
                ? "bg-white/80 font-semibold text-ink shadow-[inset_0_1px_0_#fff,0_2px_10px_rgb(28_28_30/0.12)]"
                : "font-medium text-subtle hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </LiquidGlass>

      {error && <ErrorRetry onRetry={() => setRetry(r => r+1)} />}
      {tab === "politicians" && <p className="text-sm text-amber-800">Historische Quelle mit Datenlücken. <Link href="/status" className="underline">Datenstand prüfen</Link></p>}
      {/* ── Highlights ─────────────────────────────────────────────────────── */}
      {tab === "highlights" &&
        (!data ? (
          error ? null : <SkeletonList n={5} />
        ) : (
          <div className="fade-up space-y-8">
            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">Aktien</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Hero
                  href="/discover/boughtq"
                  title="Häufige Aufstockungen"
                  blurb="Bestandserhöhungen im jüngsten verfügbaren Quartalsbericht jedes Investors."
                  gradient="bg-gradient-to-b from-amber-100 via-orange-50 to-white"
                  visual={<LogoTrio items={data.mostBoughtQ} />}
                />
                <Hero
                  href="/discover/mostheld"
                  title="Am meisten gehalten"
                  blurb="Aktien, die die meisten verfolgten Investoren gemeinsam im Depot haben."
                  gradient="bg-gradient-to-b from-sky-100 via-cyan-50 to-white"
                  visual={<LogoTrio items={data.mostHeld} />}
                />
                <Hero
                  href="/discover/conviction"
                  title="Höchste Gewichtung"
                  blurb="Die größten Aktiengewichte innerhalb der gemeldeten Bestände ohne Optionen."
                  gradient="bg-gradient-to-b from-zinc-200 via-zinc-50 to-white"
                  visual={<LogoTrio items={data.highestConviction} />}
                />
                <Hero
                  href="/discover/biggest"
                  title="Größte Positionen"
                  blurb="Die größten gemeldeten Aktienpositionen in US-Dollar."
                  gradient="bg-gradient-to-b from-emerald-100 via-teal-50 to-white"
                  visual={<LogoTrio items={data.biggest} />}
                />
                <Hero
                  href="/discover/insiderbuys"
                  title="Insider kaufen"
                  blurb="Form-4-Käufe mit Code P, ohne Derivate, in den letzten 90 Tagen."
                  gradient="bg-gradient-to-b from-lime-100 via-green-50 to-white"
                  visual={<LogoTrio items={data.insiderBuys} />}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-subtle">
                Investoren & Politiker
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Hero
                  href="/discover/biggestfunds"
                  title="Größte Fonds"
                  blurb="Die verfolgten Investoren mit dem größten gemeldeten Portfolio."
                  gradient="bg-gradient-to-b from-rose-100 via-pink-50 to-white"
                  visual={<FaceTrio people={data.biggestFunds} />}
                />
                <Hero
                  href="/discover/concentrated"
                  title="Am konzentriertesten"
                  blurb="Investoren, die den größten Anteil in eine einzige Aktie stecken."
                  gradient="bg-gradient-to-b from-slate-100 via-slate-50 to-white"
                  visual={<FaceTrio people={data.mostConcentrated} />}
                />
                <Hero
                  href="/discover/politicians"
                  title="Aktivste Politiker"
                  blurb="Kongressmitglieder mit den meisten gemeldeten Aktien-Trades."
                  gradient="bg-gradient-to-b from-blue-100 via-sky-50 to-white"
                  visual={<FaceTrio people={data.topPoliticians} />}
                />
              </div>
            </section>
          </div>
        ))}

      {/* ── Investoren ─────────────────────────────────────────────────────── */}
      {tab === "investors" &&
        (investors === null ? (
          error ? null : <SkeletonList n={8} />
        ) : (
          <div className="fade-up overflow-hidden rounded-3xl bg-white/80 shadow-card ring-1 ring-black/5 backdrop-blur">
            {investors.map((iv) => (
              <div key={iv.slug} className="flex items-center border-b border-hair pr-3 last:border-0"><Link href={`/investor/${iv.slug}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-white">
                <Avatar name={iv.person ?? iv.fund} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{iv.person ?? iv.fund}</div>
                  <div className="truncate text-xs text-subtle">{iv.fund}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{iv.positions} Positionen</div>
                  <div className="text-xs text-subtle">{abbrevMoney(iv.value)}</div>
                </div>
              </Link><FollowButton kind="investor" id={iv.slug} variant="star" /></div>
            ))}
            {investors.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-subtle">Noch keine Daten.</div>
            )}
          </div>
        ))}

      {/* ── Aktien ─────────────────────────────────────────────────────────── */}
      {tab === "stocks" &&
        (sortedStocks === null ? (
          error ? null : <SkeletonList n={8} />
        ) : (
          <div className="fade-up overflow-hidden rounded-3xl bg-white/80 shadow-card ring-1 ring-black/5 backdrop-blur">
            {sortedStocks.map((s) => (
              <div key={s.ticker} className="flex items-center border-b border-hair pr-3 last:border-0"><Link href={`/stock/${s.ticker}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 hover:bg-white">
                <CompanyLogo ticker={s.ticker} company={s.company} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{s.company}</div>
                  <div className="text-xs text-subtle">
                    {s.investors} {s.investors === 1 ? "Investor" : "Investoren"} ·{" "}
                    {abbrevMoney(s.value)}
                  </div>
                </div>
                <FaceStack names={s.holderNames} />
              </Link>{s.ticker && <FollowButton kind="stock" id={s.ticker} variant="star" />}</div>
            ))}
            {sortedStocks.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-subtle">Noch keine Daten.</div>
            )}
          </div>
        ))}

      {/* ── Politiker ──────────────────────────────────────────────────────── */}
      {tab === "politicians" &&
        (politicians === null ? (
          error ? null : <SkeletonList n={6} />
        ) : (
          <div className="fade-up overflow-hidden rounded-3xl bg-white/80 shadow-card ring-1 ring-black/5 backdrop-blur">
            {politicians.map((p) => (
              <Link
                key={p.slug}
                href={`/politician/${p.slug}`}
                className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-white"
              >
                <Avatar name={p.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="text-xs text-subtle">
                    {[p.party, p.chamber].filter(Boolean).join(" · ") || "US-Kongress"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{p.trades} Trades</div>
                  <div className="text-xs text-subtle">{formatDate(p.lastTrade)}</div>
                </div>
                <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-zinc-300" />
              </Link>
            ))}
            {politicians.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-subtle">
                Noch keine Politiker-Trades geladen.
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
