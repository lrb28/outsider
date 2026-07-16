"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getFollowed } from "@/lib/watchlist";
import { InvestorRow, InvestorsResponse, StockRow, StocksResponse } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";

export function Watchlist() {
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [followInv, setFollowInv] = useState<string[]>([]);
  const [followStk, setFollowStk] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/investors").then((r) => r.json() as Promise<InvestorsResponse>),
      fetch("/api/stocks").then((r) => r.json() as Promise<StocksResponse>),
    ])
      .then(([iv, st]) => {
        setInvestors(iv.rows);
        setStocks(st.rows);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const sync = () => {
      setFollowInv(getFollowed("investor"));
      setFollowStk(getFollowed("stock"));
    };
    sync();
    window.addEventListener("watchlist", sync);
    return () => window.removeEventListener("watchlist", sync);
  }, []);

  const myInv = investors.filter((i) => followInv.includes(i.slug));
  const myStk = stocks.filter((s) => s.ticker && followStk.includes(s.ticker));

  if (followInv.length === 0 && followStk.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-hair bg-white/50 p-5 text-sm text-subtle">
        <span className="font-medium text-ink">Deine Beobachtungsliste ist leer.</span>{" "}
        Tippe auf das ☆ bei einem Investor oder einer Aktie, um ihn hier zu sammeln.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">Deine Beobachtungsliste</h2>

      {myInv.length > 0 && (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
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
        </div>
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
