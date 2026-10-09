"use client";

import { stockHref } from "@/lib/format";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchCatalogue } from "@/lib/fetchJson";
import type { InvestorRow, InvestorsResponse, PoliticianRow, PoliticiansResponse, StockRow, StocksResponse } from "@/lib/types";
import { getFollowed, personHref, watchedPeople } from "@/lib/watchlist";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";
import { ErrorRetry } from "./ErrorRetry";
import { Icon } from "./Icon";
import { SwipeRow } from "./SwipeRow";
import { SectionHeader } from "./ui";

export function Watchlist() {
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [politicians, setPoliticians] = useState<PoliticianRow[]>([]);
  const [follow, setFollow] = useState({ investor: [] as string[], stock: [] as string[], politician: [] as string[] });
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const sync = () => setFollow({ investor: getFollowed("investor"), stock: getFollowed("stock"), politician: getFollowed("politician") });
    sync();
    window.addEventListener("watchlist", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("watchlist", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const any = follow.investor.length + follow.stock.length + follow.politician.length > 0;
  useEffect(() => {
    if (!any) return;
    setFailed(false);
    Promise.all([
      fetchCatalogue<InvestorsResponse>("/api/investors"),
      fetchCatalogue<StocksResponse>("/api/stocks"),
      fetchCatalogue<PoliticiansResponse>("/api/politicians").catch(() => ({ rows: [] as PoliticianRow[] })),
    ])
      .then(([iv, st, po]) => {
        setInvestors(iv.rows);
        setStocks(st.rows);
        setPoliticians(po.rows);
      })
      .catch(() => setFailed(true));
  }, [retry, any]);

  if (!any) {
    return (
      <section className="card flex items-start gap-3 p-5 text-[15px] text-subtle">
        <span className="icon-ring h-10 w-10"><Icon name="star" className="h-5 w-5" /></span>
        <p>
          <span className="font-semibold text-ink">Your watchlist is empty.</span>{" "}
          Follow investors, politicians or stocks to collect them here.{" "}
          <Link href="/?welcome=folgen" className="font-medium text-ink underline underline-offset-2">Set up now</Link>
        </p>
      </section>
    );
  }

  // Opened from here, a person's page swipes through this row.
  const people = watchedPeople(investors, politicians, follow).map((p) => ({ key: `${p.kind}-${p.slug}`, href: personHref(p, true), name: p.name, src: p.photo, kind: p.kind }));
  // Two share classes of one company (GOOGL, GOOG) made two identical
  // "Alphabet" tiles: one tile per company, the class most investors hold.
  const myStk = [...stocks]
    .filter((s) => s.ticker && follow.stock.includes(s.ticker))
    .sort((a, b) => b.investors - a.investors)
    .filter((s, i, all) => all.findIndex((o) => o.company === s.company) === i)
    .sort((a, b) => follow.stock.indexOf(a.ticker!) - follow.stock.indexOf(b.ticker!));

  return (
    <section className="space-y-3">
      <SectionHeader title="Your watchlist" />
      {failed && <ErrorRetry onRetry={() => setRetry((r) => r + 1)} />}

      {people.length > 0 && (
        <SwipeRow>
          {people.map((p) => (
            <Link key={p.key} href={p.href} className="card lcard-hover press flex w-28 shrink-0 flex-col items-center p-3 text-center">
              <Avatar name={p.name} src={p.src} kind={p.kind} size={56} />
              {/* Two lines, so "Warren Buffett" is not cut to "Warren Buff…". */}
              <div className="mt-2 line-clamp-2 flex min-h-[2.1rem] w-full items-start justify-center text-[13px] font-semibold leading-[1.05rem]">{p.name}</div>
            </Link>
          ))}
        </SwipeRow>
      )}

      {myStk.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {myStk.map((s) => (
            <Link key={s.ticker} href={stockHref(s.ticker ?? "")} className="card lcard-hover press flex items-center gap-3 p-3">
              <CompanyLogo ticker={s.ticker} company={s.company} size={38} />
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold">{s.company}</div>
                <div className="text-[13px] text-subtle">
                  {s.investors} {s.investors === 1 ? "investor" : "investors"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
