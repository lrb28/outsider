"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchCatalogue } from "@/lib/fetchJson";
import { ErrorRetry } from "./ErrorRetry";
import { getFollowed } from "@/lib/watchlist";
import { InvestorRow, InvestorsResponse, StockRow, StocksResponse } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";
import { SwipeRow } from "./SwipeRow";

export function Watchlist() {
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [followInv, setFollowInv] = useState<string[]>([]);
  const [followStk, setFollowStk] = useState<string[]>([]);

  const [failed,setFailed] = useState(false); const [retry,setRetry] = useState(0);
  useEffect(() => {
    setFailed(false);
    Promise.all([
      fetchCatalogue<InvestorsResponse>("/api/investors"),
      fetchCatalogue<StocksResponse>("/api/stocks"),
    ])
      .then(([iv, st]) => {
        setInvestors(iv.rows);
        setStocks(st.rows);
      })
      .catch(() => setFailed(true));
  }, [retry]);

  useEffect(() => {
    const sync = () => {
      setFollowInv(getFollowed("investor"));
      setFollowStk(getFollowed("stock"));
    };
    sync();
    window.addEventListener("watchlist", sync);
    window.addEventListener("storage", sync);
    return () => {window.removeEventListener("watchlist", sync);window.removeEventListener("storage", sync);};
  }, []);

  const myInv = investors.filter((i) => followInv.includes(i.slug));
  const myStk = stocks.filter((s) => s.ticker && followStk.includes(s.ticker));

  if (followInv.length === 0 && followStk.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-hair bg-white/50 p-5 text-sm text-subtle">
        <span className="font-medium text-ink">Deine Beobachtungsliste ist leer.</span>{" "}
        Tippe auf das ☆ bei einem Investor oder einer Aktie, um ihn hier zu sammeln. <Link href="/discover?tab=investors" className="ml-1 text-brand underline">Investoren entdecken</Link>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Deine Beobachtungsliste</h2>
      {failed && <ErrorRetry onRetry={() => setRetry(r => r+1)}/>}

      {myInv.length > 0 && (
        <SwipeRow>
          {myInv.map((i) => (
            <Link
              key={i.slug}
              href={`/investor/${i.slug}`}
              className="flex w-32 shrink-0 flex-col items-center rounded-2xl bg-card p-3 text-center shadow-card ring-1 ring-hair transition hover:shadow-cardhover"
            >
              <Avatar name={i.person ?? i.fund} size={52} />
              <div className="mt-2 w-full truncate text-xs font-semibold">{i.person ?? i.fund}</div>
            </Link>
          ))}
        </SwipeRow>
      )}

      {myStk.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {myStk.map((s) => (
            <Link
              key={s.ticker}
              href={`/stock/${s.ticker}`}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-card transition hover:shadow-cardhover"
            >
              <CompanyLogo ticker={s.ticker} company={s.company} size={38} />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{s.company}</div>
                <div className="text-xs text-subtle">
                  {s.investors} {s.investors === 1 ? "Investor" : "Investoren"}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
