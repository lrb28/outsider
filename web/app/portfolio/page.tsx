"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { FaceStack } from "@/components/FaceStack";
import { FollowButton } from "@/components/FollowButton";
import { abbrevMoney } from "@/lib/format";
import { InvestorRow, InvestorsResponse, StockRow, StocksResponse } from "@/lib/types";

type IvSort = "value" | "positions" | "name";
type StSort = "investors" | "value" | "name";

const IV_SORTS: [IvSort, string][] = [
  ["value", "Wert"],
  ["positions", "Positionen"],
  ["name", "Name"],
];
const ST_SORTS: [StSort, string][] = [
  ["investors", "Investoren"],
  ["value", "Wert"],
  ["name", "Name"],
];

function SortBar<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-medium">
      {options.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`rounded-full px-3 py-1 transition ${
            value === key ? "bg-white text-ink shadow-card" : "text-subtle"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function PortfolioPage() {
  const [tab, setTab] = useState<"investors" | "stocks">("investors");
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ivSort, setIvSort] = useState<IvSort>("value");
  const [stSort, setStSort] = useState<StSort>("investors");

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

  const sortedInvestors = useMemo(() => {
    const a = [...investors];
    a.sort((x, y) =>
      ivSort === "name"
        ? (x.person ?? x.fund).localeCompare(y.person ?? y.fund)
        : ivSort === "positions"
        ? y.positions - x.positions
        : (y.value ?? 0) - (x.value ?? 0),
    );
    return a;
  }, [investors, ivSort]);

  const sortedStocks = useMemo(() => {
    const a = [...stocks];
    a.sort((x, y) =>
      stSort === "name"
        ? x.company.localeCompare(y.company)
        : stSort === "value"
        ? (y.value ?? 0) - (x.value ?? 0)
        : y.investors - x.investors,
    );
    return a;
  }, [stocks, stSort]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-subtle">Alle verfolgten Investoren und ihre Aktien.</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
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
        {tab === "investors" ? (
          <SortBar options={IV_SORTS} value={ivSort} onChange={setIvSort} />
        ) : (
          <SortBar options={ST_SORTS} value={stSort} onChange={setStSort} />
        )}
      </div>

      {loading && <div className="py-10 text-center text-sm text-subtle">Lädt…</div>}

      {!loading && tab === "investors" && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {sortedInvestors.map((iv) => (
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
              <FollowButton kind="investor" id={iv.slug} variant="star" />
              <span className="text-slate-300">›</span>
            </Link>
          ))}
          {sortedInvestors.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">
              Noch keine Portfolios geladen.
            </div>
          )}
        </div>
      )}

      {!loading && tab === "stocks" && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {sortedStocks.map((s) => (
            <Link
              key={s.ticker}
              href={`/stock/${s.ticker}`}
              className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50"
            >
              <CompanyLogo ticker={s.ticker} company={s.company} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{s.company}</div>
                <div className="text-xs text-subtle">
                  {s.investors} {s.investors === 1 ? "Investor" : "Investoren"} ·{" "}
                  {abbrevMoney(s.value)}
                </div>
              </div>
              <FaceStack names={s.holderNames} />
              {s.ticker && <FollowButton kind="stock" id={s.ticker} variant="star" />}
              <span className="text-slate-300">›</span>
            </Link>
          ))}
          {sortedStocks.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">
              Noch keine Aktien geladen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
