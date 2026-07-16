"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { fixTicker } from "@/lib/format";
import { InvestorRow, InvestorsResponse, StockRow, StocksResponse } from "@/lib/types";

import { Avatar } from "./Avatar";
import { CompanyLogo } from "./CompanyLogo";

export function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const ensureData = () => {
    if (loaded) return;
    setLoaded(true);
    Promise.all([
      fetch("/api/investors").then((r) => r.json() as Promise<InvestorsResponse>),
      fetch("/api/stocks").then((r) => r.json() as Promise<StocksResponse>),
    ])
      .then(([iv, st]) => {
        setInvestors(iv.rows);
        setStocks(st.rows);
      })
      .catch(() => {});
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const needle = q.trim().toLowerCase();
  const ivHits = needle
    ? investors
        .filter((i) => (i.person ?? i.fund).toLowerCase().includes(needle) || i.fund.toLowerCase().includes(needle))
        .slice(0, 4)
    : [];
  const stHits = needle
    ? stocks
        .filter(
          (s) =>
            s.company.toLowerCase().includes(needle) ||
            (s.ticker ?? "").toLowerCase().includes(needle),
        )
        .slice(0, 5)
    : [];
  const hasHits = ivHits.length + stHits.length > 0;

  return (
    <div ref={boxRef} className="relative">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          ensureData();
          setOpen(true);
        }}
        placeholder="Suchen…"
        className="w-36 rounded-full border border-hair bg-white px-4 py-1.5 text-sm outline-none focus:w-52 focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-44"
      />

      {open && needle.length > 0 && (
        <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-hair bg-white shadow-cardhover">
          {!hasHits && <div className="px-4 py-4 text-sm text-subtle">Nichts gefunden.</div>}

          {ivHits.length > 0 && (
            <div className="border-b border-hair py-1">
              <div className="px-4 py-1 text-[10px] font-medium uppercase tracking-wide text-subtle">
                Investoren
              </div>
              {ivHits.map((i) => (
                <Link
                  key={i.slug}
                  href={`/investor/${i.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50"
                >
                  <Avatar name={i.person ?? i.fund} size={26} />
                  <span className="truncate text-sm font-medium">{i.person ?? i.fund}</span>
                </Link>
              ))}
            </div>
          )}

          {stHits.length > 0 && (
            <div className="py-1">
              <div className="px-4 py-1 text-[10px] font-medium uppercase tracking-wide text-subtle">
                Aktien
              </div>
              {stHits.map((s) => (
                <Link
                  key={s.ticker}
                  href={`/stock/${s.ticker}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50"
                >
                  <CompanyLogo ticker={s.ticker} company={s.company} size={26} rounded="rounded-lg" />
                  <span className="truncate text-sm font-medium">{s.company}</span>
                  <span className="ml-auto font-mono text-xs text-subtle">
                    {fixTicker(s.ticker, s.company)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
