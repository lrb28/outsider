"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ErrorRetry } from "@/components/ErrorRetry";
import { FaceStack } from "@/components/FaceStack";
import { FollowButton } from "@/components/FollowButton";
import { SkeletonList } from "@/components/Skeleton";
import { AuraCard, ChipBar, EmptyState, ListCard, ListRow, PageTitle, politicianLine, SegmentedControl } from "@/components/ui";
import { fetchCatalogue } from "@/lib/fetchJson";
import { abbrevMoney, formatDate, pctOf, stockHref } from "@/lib/format";
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
  { key: "highlights", label: "Highlights" },
  { key: "investors", label: "Investors", aura: "investor" },
  { key: "politicians", label: "Politicians", aura: "politician" },
  { key: "stocks", label: "Stocks" },
] as const;

/** Three logos side by side: overlapping tiles cut each other's marks off. */
function LogoTrio({ items }: { items: CollectionItem[] }) {
  if (!items.length) return <div className="h-12" />;
  return (
    <div className="flex items-center gap-2">
      {items.slice(0, 3).map((it, i) => (
        <CompanyLogo key={(it.ticker ?? it.company) + i} ticker={it.ticker} company={it.company} size={48} rounded="rounded-[14px]" className="logo-lift" />
      ))}
    </div>
  );
}

function FaceTrio({ people, kind = "investor" }: { people: CollectionInvestor[]; kind?: "investor" | "politician" }) {
  if (!people.length) return <div className="h-[52px]" />;
  return (
    <div className="flex items-center">
      {people.slice(0, 3).map((p, i) => (
        <div key={p.slug + i} style={{ marginLeft: i === 0 ? 0 : -12, zIndex: 3 - i }} className="flex">
          <Avatar name={p.person ?? p.fund} src={p.photo} kind={kind} size={i === 0 ? 52 : 44} className="face-lift" />
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
  const tab = (TABS.some((t) => t.key === query.get("tab")) ? query.get("tab") : "highlights") as Tab;
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
  // Investors by size or by the last twelve months' 13F return (after Eaves's
  // "Best performers"); those without a full year go last.
  const [invSort, setInvSort] = useState<"value" | "return">("value");
  const sortedInvestors = useMemo(
    () =>
      investors
        ? invSort === "value"
          ? investors
          : [...investors].sort((a, b) => (b.oneYear ?? -Infinity) - (a.oneYear ?? -Infinity))
        : null,
    [investors, invSort],
  );

  return (
    <div className="space-y-6">
      <PageTitle title="Discover" subtitle="What investors hold, insiders buy and politicians trade — straight from the original filings." />

      <ChipBar label="Sections" items={TABS} value={tab} onChange={setTab} className="fade-up" />

      {error && <ErrorRetry onRetry={() => setRetry((r) => r + 1)} />}

      {tab === "highlights" &&
        (!data ? (
          error ? null : <SkeletonList n={5} />
        ) : (
          <div className="fade-up space-y-8">
            <section className="space-y-3">
              <h2 className="eyebrow">Stocks</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AuraCard href="/discover/boughtq" aura="investor" title="Most added to" blurb="Positions raised in each investor’s latest quarterly report." visual={<LogoTrio items={data.mostBoughtQ} />} />
                <AuraCard href="/discover/insiderbuys" aura="insider" title="Insiders buying" blurb="Officers and directors buying with their own money (Form 4, code P), last 90 days." visual={<LogoTrio items={data.insiderBuys} />} />
                <AuraCard href="/discover/mostheld" aura="neutral" title="Most held" blurb="The stocks most of the tracked investors hold." visual={<LogoTrio items={data.mostHeld} />} />
                <AuraCard href="/discover/conviction" aura="neutral" title="Highest conviction" blurb="The largest single-stock weights in the reported holdings, options excluded." visual={<LogoTrio items={data.highestConviction} />} />
                <AuraCard href="/discover/biggest" aura="neutral" title="Biggest positions" blurb="The most valuable single positions reported, in US dollars." visual={<LogoTrio items={data.biggest} />} />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="eyebrow">People</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AuraCard href="/discover/politicians" aura="politician" title="Most active politicians" blurb="Members of the US House with the most stock trades in the last year." visual={<FaceTrio people={data.topPoliticians} kind="politician" />} />
                {(data.bestPerformers?.length ?? 0) > 0 && (
                  <AuraCard href="/discover/best" aura="investor" title="Best performers" blurb="Whose reported stocks did best over the last 12 months." visual={<FaceTrio people={data.bestPerformers ?? []} />} />
                )}
                <AuraCard href="/discover/biggestfunds" aura="investor" title="Biggest funds" blurb="The tracked investors with the largest reported portfolios." visual={<FaceTrio people={data.biggestFunds} />} />
                <AuraCard href="/discover/concentrated" aura="investor" title="Most concentrated" blurb="Investors who put the biggest share into a single stock." visual={<FaceTrio people={data.mostConcentrated} />} />
              </div>
            </section>
          </div>
        ))}

      {tab === "investors" &&
        (sortedInvestors === null ? (
          error ? null : <SkeletonList n={8} />
        ) : sortedInvestors.length === 0 ? (
          <EmptyState title="No investor data yet" />
        ) : (
          <div className="fade-up space-y-3">
          <SegmentedControl label="Sort investors by" size="sm" options={[["value", "Portfolio value"], ["return", "12-month return"]] as const} value={invSort} onChange={setInvSort} />
          <ListCard>
            {sortedInvestors.map((iv) => (
              <ListRow
                key={iv.slug}
                href={`/investor/${iv.slug}`}
                leading={<Avatar name={iv.person ?? iv.fund} size={44} />}
                title={iv.person ?? iv.fund}
                subtitle={iv.person ? iv.fund : `13F ${formatDate(iv.asOf)}`}
                trailing={
                  invSort === "return" ? (
                    <>
                      <div className={`text-[15px] font-semibold tabular-nums ${iv.oneYear == null ? "text-subtle" : iv.oneYear >= 0 ? "text-bull" : "text-bear"}`}>{iv.oneYear == null ? "—" : pctOf(iv.oneYear, 1)}</div>
                      <div className="text-[13px] text-subtle">{iv.oneYear == null ? "under a year" : "12 months"}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-[15px] font-semibold tabular-nums">{abbrevMoney(iv.value)}</div>
                      <div className="text-[13px] text-subtle">{iv.positions} positions</div>
                    </>
                  )
                }
                chevron={false}
                after={<FollowButton kind="investor" id={iv.slug} variant="star" />}
              />
            ))}
          </ListCard>
          </div>
        ))}

      {tab === "politicians" &&
        (politicians === null ? (
          error ? null : <SkeletonList n={6} />
        ) : politicians.length === 0 ? (
          <EmptyState icon="people" title="No politician trades yet">The House filings are being read in right now.</EmptyState>
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
                    <div className="text-[15px] font-semibold tabular-nums">{p.trades} trades</div>
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
          <EmptyState title="No stock data yet" />
        ) : (
          <ListCard className="fade-up">
            {sortedStocks.map((s) => (
              <ListRow
                key={s.ticker ?? s.company}
                href={stockHref(s.ticker ?? "")}
                leading={<CompanyLogo ticker={s.ticker} company={s.company} size={44} />}
                title={s.company}
                subtitle={`${s.investors} ${s.investors === 1 ? "investor" : "investors"} · ${abbrevMoney(s.value)}`}
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
