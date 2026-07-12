"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { FaceStack } from "@/components/FaceStack";
import { abbrevMoney } from "@/lib/format";
import { InvestorRow, InvestorsResponse, StockRow, StocksResponse } from "@/lib/types";

export default function PortfolioPage() {
  const [tab, setTab] = useState<"investors" | "stocks">("investors");
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/investors").then((r) => r.json() as Promise<InvestorsResponse>),
      fetch("/api/stocks").then((r) => r.json() as Promise<StocksResponse>),
    ])
      .then(([iv, st]) => {
        setInvestors(iv.rows);
        setStocks(st.rows);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-subtle">Alle verfolgten Investoren und ihre Aktien.</p>
      </div>

      <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm font-medium">
        {(
          [
            ["investors", "Investoren"],
            ["stocks", "Aktien"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-5 py-1.5 transition ${
              tab === key ? "bg-white text-ink shadow-card" : "text-subtle hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="py-10 text-center text-sm text-subtle">Lädt…</div>}

      {!loading && tab === "investors" && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {investors.map((iv) => (
            <Link
              key={iv.slug}
              href={`/investor/${iv.slug}`}
              className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50"
            >
              <Avatar name={iv.person ?? iv.fund} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{iv.person ?? iv.fund}</div>
                <div className="truncate text-xs text-subtle">{iv.fund}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{iv.positions} Positionen</div>
                <div className="text-xs text-subtle">{abbrevMoney(iv.value)}</div>
              </div>
              <span className="text-slate-300">›</span>
            </Link>
          ))}
          {investors.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">
              Noch keine Portfolios geladen.
            </div>
          )}
        </div>
      )}

      {!loading && tab === "stocks" && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {stocks.map((s) => (
            <Link
              key={s.ticker}
              href={`/stock/${s.ticker}`}
              className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50"
            >
              <CompanyLogo ticker={s.ticker} company={s.company} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{s.company}</div>
                <div className="text-xs text-subtle">
                  {s.investors} {s.investors === 1 ? "Investor" : "Investoren"}
                </div>
              </div>
              <FaceStack names={s.holderNames} />
              <span className="text-slate-300">›</span>
            </Link>
          ))}
          {stocks.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">
              Noch keine Aktien geladen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
