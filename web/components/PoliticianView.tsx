"use client";

import Link from "next/link";
import { type ReactNode, useMemo } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TradeFeed } from "@/components/TradeFeed";
import { politicianLine, StatRow } from "@/components/ui";
import { fetchDetail } from "@/lib/fetchJson";
import { companyName, shortDate, stockHref } from "@/lib/format";
import type { PoliticianDetail, PoliticianResponse } from "@/lib/types";

export function loadPolitician(slug: string, fresh = false): Promise<PoliticianDetail | null> {
  return fetchDetail<PoliticianResponse>(`/api/politician?slug=${encodeURIComponent(slug)}`, fresh).then((d) => d.politician);
}

/**
 * Everything a politician page shows about one member of the House. Same
 * options as `InvestorView`: `top` is the back button row, `preview` draws
 * only the head and the most traded stocks (the neighbour in the watchlist
 * pager). Picture, name and seat stand centred (user, 2026-10-09).
 */
export function PoliticianView({ pol, top, preview = false }: { pol: PoliticianDetail; top?: ReactNode; preview?: boolean }) {
  const summary = useMemo(() => {
    const buys = pol.trades.filter((t) => t.txnType === "buy");
    const sells = pol.trades.filter((t) => t.txnType === "sell");
    const byTicker = new Map<string, { ticker: string; name: string; n: number; buys: number }>();
    for (const t of pol.trades) {
      if (!t.ticker) continue;
      const cur = byTicker.get(t.ticker) ?? { ticker: t.ticker, name: companyName(t.ticker, t.securityName), n: 0, buys: 0 };
      cur.n++;
      if (t.txnType === "buy") cur.buys++;
      byTicker.set(t.ticker, cur);
    }
    const top = [...byTicker.values()].sort((a, b) => b.n - a.n).slice(0, 6);
    return { buys: buys.length, sells: sells.length, top };
  }, [pol]);

  const stats = [
    { label: "Reported trades", value: pol.trades.length.toLocaleString("en-US") },
    { label: "Buys / sells", value: `${summary.buys} / ${summary.sells}` },
    { label: "Latest filing", value: shortDate(pol.trades[0]?.disclosedAt) },
  ];

  return (
    <div className="space-y-8">
      <div className="aura-header space-y-5" style={{ ["--aura" as string]: "var(--aura-politician)", ["--aura-2" as string]: "var(--aura-investor)" }}>
        {top}

        <div className="fade-up flex flex-col items-center gap-4 text-center">
          <Avatar name={pol.name} src={pol.photo} kind="politician" size={104} className="shadow-[0_10px_30px_rgb(0_0_0/0.16)]" />
          <div className="min-w-0 flex-1">
            <h1 className="large-title">{pol.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-2 text-[15px] text-subtle">
              <span className="rounded-full bg-politician/10 px-2.5 py-1 text-[13px] font-semibold text-politician">{politicianLine(pol.party, pol.seat)}</span>
              <span>US House of Representatives</span>
            </div>
          </div>
        </div>

        <div className="fade-up"><StatRow items={stats} /></div>
      </div>

      {summary.top.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Most traded</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {summary.top.map((t) => (
              <Link key={t.ticker} href={stockHref(t.ticker)} className="card lcard-hover press flex items-center gap-3 p-3">
                <CompanyLogo ticker={t.ticker} company={t.name} size={40} />
                <div className="min-w-0">
                  <div className="truncate text-[15px] font-semibold">{t.name}</div>
                  <div className="text-[13px] text-subtle">{t.n} trades · {t.buys} buys</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {!preview && (
        <>
          <section className="space-y-3">
            <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">All filings</h2>
            <TradeFeed
              rows={pol.trades}
              showActor={false}
              empty="No machine-readable filings yet. Scanned PDFs can’t be read automatically (yet)."
            />
          </section>

          <p className="text-[13px] leading-relaxed text-subtle">
            Source: Periodic Transaction Reports (STOCK Act) of the US House of Representatives. Amounts are ranges, filed up to 45 days after the trade. Official portrait of the US Congress (public domain).
          </p>
        </>
      )}
    </div>
  );
}
