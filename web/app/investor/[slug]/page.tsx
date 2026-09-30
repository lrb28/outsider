"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { DepotSkyline } from "@/components/DepotSkyline";
import { SegmentedControl, StatRow, DetailTopBar } from "@/components/ui";
import { ErrorRetry } from "@/components/ErrorRetry";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Donut } from "@/components/Donut";
import { FollowButton } from "@/components/FollowButton";
import { MatchSheet, matchPct, myHoldings, normTicker } from "@/components/MatchSheet";
import { SkeletonPage } from "@/components/Skeleton";
import { TradeFeed } from "@/components/TradeFeed";
import { fetchJson } from "@/lib/fetchJson";
import { abbrevMoney, companyName, fixTicker, shortDate, shortMoney, weightPct, stockHref } from "@/lib/format";
import { InvestorDetail, InvestorResponse } from "@/lib/types";
import { Icon } from "@/components/Icon";

export default function InvestorPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug as string;
  const [inv, setInv] = useState<InvestorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"value" | "name">("value");
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);
  // Point72 reports almost 2,000 positions; rendering them all at once made
  // the page stutter on phones. The list grows on request.
  const [shown, setShown] = useState(40);
  // Your Portfolio (on this device), for the match with this investor.
  const [mine, setMine] = useState<Map<string, string>>(new Map());
  const [showMatch, setShowMatch] = useState(false);
  useEffect(() => setMine(myHoldings()), []);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLoading(true);
    setErr(false);
    fetchJson<InvestorResponse>(`/api/investor?slug=${encodeURIComponent(slug)}`, {signal:controller.signal})
      .then((d) => setInv(d.investor))
      .catch(() => {if(!controller.signal.aborted) setErr(true);})
      .finally(() => {if(!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [slug, tick]);

  const holdings = useMemo(() => {
    if (!inv) return [];
    const h = [...inv.holdings];
    // Weight = value / total, so it sorts exactly like value; value (size)
    // and name (A–Z) are the two real choices.
    h.sort((a, b) =>
      sort === "name" ? a.company.localeCompare(b.company) : (b.value ?? 0) - (a.value ?? 0),
    );
    return h;
  }, [inv, sort]);

  // Stocks in both portfolios (options are not a stake in the company).
  const shared = useMemo(() => {
    if (!inv || !mine.size) return [];
    const theirs = inv.holdings.filter((h) => h.ticker && !h.putCall).map((h) => normTicker(fixTicker(h.ticker, h.company) ?? h.ticker!));
    return [...new Set(theirs)].filter((t) => mine.has(t));
  }, [inv, mine]);

  if (loading) return <SkeletonPage />;
  if (err) return <ErrorRetry onRetry={() => setTick((t) => t + 1)} />;
  if (!inv)
    return (
      <div className="py-16 text-center text-[15px] text-subtle">
        Investor not found.{" "}
        <Link href="/discover" className="text-ink underline">
          Back to Discover
        </Link>
      </div>
    );

  const stats: { label: string; value: string; cls?: string; onClick?: () => void; hint?: string }[] = [
    { label: "Portfolio value", value: shortMoney(inv.value) },
    { label: "Positions", value: inv.positions.toLocaleString("en-US") },
    { label: "As of", value: shortDate(inv.asOf) },
  ];
  if (mine.size > 0)
    stats.unshift({
      label: `Match · ${shared.length} shared`,
      value: `${matchPct(shared.length, mine.size)}%`,
      cls: "text-[rgb(var(--aura-investor))]",
      onClick: shared.length ? () => setShowMatch(true) : undefined,
      hint: "Show the stocks you both hold",
    });

  const buys = inv.moves?.buys ?? inv.trades.filter((t) => t.txnType === "buy").length;
  const sells = inv.moves?.sells ?? inv.trades.filter((t) => t.txnType === "sell").length;
  const moves = [
    { label: "Added to", value: buys, color: "rgb(var(--bull-fill))" },
    { label: "Reduced", value: sells, color: "rgb(var(--bear-fill))" },
  ];
  const moveTotal = buys + sells;

  return (
    <div className="space-y-8">
      <div className="aura-header space-y-5" style={{ ["--aura" as string]: "var(--aura-investor)" }}>
        <DetailTopBar back="/discover?tab=investors" label="Investors" action={<FollowButton kind="investor" id={inv.slug} />} />

        <div className="fade-up flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar name={inv.person ?? inv.fund} size={96} className="shadow-[0_10px_30px_rgb(0_0_0/0.14)]" />
          <div className="min-w-0 flex-1">
            <h1 className="large-title">{inv.person ?? inv.fund}</h1>
          </div>
        </div>
        {inv.bio && <p className="fade-up max-w-2xl text-[17px] leading-relaxed text-ink/80">{inv.bio}</p>}

        <div className="fade-up"><StatRow items={stats} /></div>
      </div>

      <DepotSkyline holdings={inv.holdings} trades={inv.trades} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">All positions</h2>
          <SegmentedControl label="Sort by" size="sm" options={[["value", "Value"], ["name", "Name"]] as const} value={sort} onChange={setSort} />
        </div>

        <div className="card overflow-hidden">
          {holdings.slice(0, shown).map((h, i) => {
            const company = companyName(h.ticker, h.securityName);
            return (
              <div
                key={`${h.ticker ?? h.securityName}-${i}`}
                className="relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-[4.25rem] after:right-0 after:h-px after:bg-hair last:after:hidden"
              >
                <CompanyLogo ticker={h.ticker} company={company} size={40} />
                <div className="min-w-0 flex-1">
                  {h.ticker ? (
                    <Link
                      href={stockHref(h.ticker)}
                      className="block truncate text-[15px] font-semibold hover:underline"
                    >
                      {company}
                    </Link>
                  ) : (
                    <div className="truncate text-[15px] font-semibold">{company}</div>
                  )}
                  <div className="text-[13px] text-subtle">
                    {fixTicker(h.ticker, company) ?? "—"}
                    {h.putCall ? ` · ${h.putCall}` : ""}
                  </div>
                </div>
                <div className="w-28 text-right">
                  <div className="text-[15px] font-semibold tabular-nums">{weightPct(h.weight)}</div>
                  <div className="text-[13px] tabular-nums text-subtle">{abbrevMoney(h.value)}</div>
                </div>
              </div>
            );
          })}
          {holdings.length > shown && (
            <button
              onClick={() => setShown((n) => n + 100)}
              className="flex w-full items-center justify-center gap-1 border-t border-hair px-4 py-3 text-[15px] font-medium text-ink hover:bg-ink/[0.03]"
            >
              Show {Math.min(100, holdings.length - shown)} more
              <span className="text-subtle">· {(holdings.length - shown).toLocaleString("en-US")} left</span>
            </button>
          )}
          {holdings.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">
              No 13F positions. (A 13F is filed up to 45 days after quarter end.)
            </div>
          )}
        </div>
      </section>

      {moveTotal > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Moves this quarter</h2>
          <div className="card flex flex-col items-center gap-6 p-5 sm:flex-row">
            <Donut
              segments={moves}
              centerTop={`${Math.round((buys / moveTotal) * 100)}%`}
              centerBottom="added to"
            />
            <div className="w-full flex-1 space-y-2.5">
              {moves.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-sm">
                  <span className="dot-3d" style={{ ["--c" as string]: s.color }} />
                  <span className="text-ink">{s.label}</span>
                  <span className="text-xs text-subtle">{s.value} positions</span>
                  <span className="ml-auto font-semibold">
                    {Math.round((s.value / moveTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Latest filings</h2>
        <TradeFeed
          rows={inv.trades}
          showActor={false}
          empty="No reported changes yet."
        />
      </section>

      {showMatch && <MatchSheet slug={inv.slug} who={inv.person ?? inv.fund} shared={shared} total={mine.size} names={mine} onClose={() => setShowMatch(false)} />}

      <p className="text-[13px] leading-relaxed text-subtle">13F reports show quarterly holdings. Changes are not dated trades. Stock values and weights exclude option positions. People are an editorial attribution to the fund, not a confirmation of who manages the money today.</p>
    </div>
  );
}
