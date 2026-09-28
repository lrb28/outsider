"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ErrorRetry } from "@/components/ErrorRetry";
import { FaceStack } from "@/components/FaceStack";
import { FollowButton } from "@/components/FollowButton";
import { SkeletonList } from "@/components/Skeleton";
import { AuraCard, EmptyState, ListCard, ListRow, PageTitle, SegmentedControl, politicianLine } from "@/components/ui";
import { fetchCatalogue } from "@/lib/fetchJson";
import { abbrevMoney, formatDate } from "@/lib/format";
import type {
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

type Tab = "highlights" | "investors" | "stocks" | "politicians";

const TABS = [
  ["highlights", "Highlights"],
  ["investors", "Investoren"],
  ["politicians", "Politiker"],
  ["stocks", "Aktien"],
] as const;

function LogoTrio({ items }: { items: CollectionItem[] }) {
  if (!items.length) return <div className="h-[52px]" />;
  return (
    <div className="flex items-center">
      {items.slice(0, 3).map((it, i) => (
        <div key={(it.ticker ?? it.company) + i} style={{ marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }} className="rounded-[14px] shadow-[0_2px_10px_rgb(0_0_0/0.12)]">
          <CompanyLogo ticker={it.ticker} company={it.company} size={i === 0 ? 52 : 44} rounded="rounded-[14px]" />
        </div>
      ))}
    </div>
  );
}

function FaceTrio({ people, kind = "investor" }: { people: CollectionInvestor[]; kind?: "investor" | "politician" }) {
  if (!people.length) return <div className="h-[52px]" />;
  return (
    <div className="flex items-center">
      {people.slice(0, 3).map((p, i) => (
        <div key={p.slug + i} style={{ marginLeft: i === 0 ? 0 : -12, zIndex: 3 - i }} className="rounded-full shadow-[0_2px_10px_rgb(0_0_0/0.14)]">
          <Avatar name={p.person ?? p.fund} src={p.photo} kind={kind} size={i === 0 ? 52 : 44} />
        </div>
      ))}
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<SkeletonList n={4} />}>
      <Discover />
    </Suspense>
  );
}

function Discover() {
  const query = useSearchParams();
  const router = useRouter();
  const tab = (TABS.some(([key]) => key === query.get("tab")) ? query.get("tab") : "highlights") as Tab;
  const setTab = (key: Tab) => router.push(`/discover?tab=${key}`, { scroll: false });
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<DiscoverData | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[] | null>(null);
  const [stocks, setStocks] = useState<StockRow[] | null>(null);
  const [politicians, setPoliticians] = useState<PoliticianRow[] | null>(null);

  useEffect(() => {
    let on = true;
    setError(false);
    const request =
      tab === "highlights" ? fetchCatalogue<DiscoverData>("/api/discover").then((d) => on && setData(d))
      : tab === "investors" ? fetchCatalogue<InvestorsResponse>("/api/investors").then((d) => on && setInvestors(d.rows))
      : tab === "stocks" ? fetchCatalogue<StocksResponse>("/api/stocks").then((d) => on && setStocks(d.rows))
      : fetchCatalogue<PoliticiansResponse>("/api/politicians").then((d) => on && setPoliticians(d.rows));
    request.catch(() => on && setError(true));
    return () => {
      on = false;
    };
  }, [tab, retry]);

  const sortedStocks = useMemo(() => (stocks ? [...stocks].sort((a, b) => b.investors - a.investors) : null), [stocks]);

  return (
    <div className="space-y-6">
      <PageTitle title="Entdecken" subtitle="Was Investoren halten, Insider kaufen und Abgeordnete handeln – aus den Originalmeldungen." />

      <SegmentedControl label="Bereiche" options={TABS} value={tab} onChange={setTab} className="fade-up" />

      {error && <ErrorRetry onRetry={() => setRetry((r) => r + 1)} />}

      {tab === "highlights" &&
        (!data ? (
          error ? null : <SkeletonList n={5} />
        ) : (
          <div className="fade-up space-y-8">
            <section className="space-y-3">
              <h2 className="eyebrow">Aktien</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AuraCard href="/discover/boughtq" aura="investor" title="Häufige Aufstockungen" blurb="Bestandserhöhungen im jüngsten Quartalsbericht jedes Investors." visual={<LogoTrio items={data.mostBoughtQ} />} />
                <AuraCard href="/discover/insiderbuys" aura="insider" title="Insider kaufen" blurb="Käufe von Vorständen und Direktoren mit eigenem Geld (Form 4, Code P), letzte 90 Tage." visual={<LogoTrio items={data.insiderBuys} />} />
                <AuraCard href="/discover/mostheld" aura="neutral" title="Am meisten gehalten" blurb="Aktien, die die meisten verfolgten Investoren gemeinsam im Depot haben." visual={<LogoTrio items={data.mostHeld} />} />
                <AuraCard href="/discover/conviction" aura="neutral" title="Höchste Gewichtung" blurb="Die größten Aktiengewichte innerhalb der gemeldeten Bestände, ohne Optionen." visual={<LogoTrio items={data.highestConviction} />} />
                <AuraCard href="/discover/biggest" aura="neutral" title="Größte Positionen" blurb="Die wertvollsten gemeldeten Einzelpositionen in US-Dollar." visual={<LogoTrio items={data.biggest} />} />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="eyebrow">Menschen</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AuraCard href="/discover/politicians" aura="politician" title="Aktivste Politiker" blurb="Abgeordnete des US-Repräsentantenhauses mit den meisten Aktien-Trades im letzten Jahr." visual={<FaceTrio people={data.topPoliticians} kind="politician" />} />
                <AuraCard href="/discover/biggestfunds" aura="investor" title="Größte Fonds" blurb="Die verfolgten Investoren mit dem größten gemeldeten Portfolio." visual={<FaceTrio people={data.biggestFunds} />} />
                <AuraCard href="/discover/concentrated" aura="investor" title="Am konzentriertesten" blurb="Investoren, die den größten Anteil in eine einzige Aktie stecken." visual={<FaceTrio people={data.mostConcentrated} />} />
              </div>
            </section>
          </div>
        ))}

      {tab === "investors" &&
        (investors === null ? (
          error ? null : <SkeletonList n={8} />
        ) : investors.length === 0 ? (
          <EmptyState title="Noch keine Investoren-Daten" />
        ) : (
          <ListCard className="fade-up">
            {investors.map((iv) => (
              <ListRow
                key={iv.slug}
                href={`/investor/${iv.slug}`}
                leading={<Avatar name={iv.person ?? iv.fund} size={44} />}
                title={iv.person ?? iv.fund}
                subtitle={iv.person ? iv.fund : `13F ${formatDate(iv.asOf)}`}
                trailing={
                  <>
                    <div className="text-[15px] font-semibold tabular-nums">{abbrevMoney(iv.value)}</div>
                    <div className="text-[13px] text-subtle">{iv.positions} Positionen</div>
                  </>
                }
                chevron={false}
                after={<FollowButton kind="investor" id={iv.slug} variant="star" />}
              />
            ))}
          </ListCard>
        ))}

      {tab === "politicians" &&
        (politicians === null ? (
          error ? null : <SkeletonList n={6} />
        ) : politicians.length === 0 ? (
          <EmptyState icon="people" title="Noch keine Politiker-Trades">Die Meldungen des Repräsentantenhauses werden gerade eingelesen.</EmptyState>
        ) : (
          <ListCard className="fade-up">
            {politicians.map((p) => (
              <ListRow
                key={p.slug}
                href={`/politician/${p.slug}`}
                leading={<Avatar name={p.name} src={p.photo} kind="politician" size={44} />}
                title={p.name}
                subtitle={politicianLine(p.party, p.seat)}
                trailing={
                  <>
                    <div className="text-[15px] font-semibold tabular-nums">{p.trades} Trades</div>
                    <div className="text-[13px] text-subtle">{formatDate(p.lastTrade)}</div>
                  </>
                }
              />
            ))}
          </ListCard>
        ))}

      {tab === "stocks" &&
        (sortedStocks === null ? (
          error ? null : <SkeletonList n={8} />
        ) : sortedStocks.length === 0 ? (
          <EmptyState title="Noch keine Aktien-Daten" />
        ) : (
          <ListCard className="fade-up">
            {sortedStocks.map((s) => (
              <ListRow
                key={s.ticker ?? s.company}
                href={`/stock/${encodeURIComponent(s.ticker ?? "")}`}
                leading={<CompanyLogo ticker={s.ticker} company={s.company} size={44} />}
                title={s.company}
                subtitle={`${s.investors} ${s.investors === 1 ? "Investor" : "Investoren"} · ${abbrevMoney(s.value)}`}
                trailing={<FaceStack names={s.holderNames} />}
                chevron={false}
                after={s.ticker ? <FollowButton kind="stock" id={s.ticker} variant="star" /> : null}
              />
            ))}
          </ListCard>
        ))}
    </div>
  );
}
