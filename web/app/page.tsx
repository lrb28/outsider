"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { TradeFeed } from "@/components/TradeFeed";
import { Watchlist } from "@/components/Watchlist";
import { abbrevMoney } from "@/lib/format";
import { FeedRow, InvestorRow, InvestorsResponse, TradesResponse } from "@/lib/types";

interface Stats {
  entities: number;
  institutions: number;
  insiders: number;
  politicians: number;
  trades: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [trades, setTrades] = useState<FeedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats).catch(() => {});
    Promise.all([
      fetch("/api/investors").then((r) => r.json() as Promise<InvestorsResponse>),
      fetch("/api/trades?limit=8").then((r) => r.json() as Promise<TradesResponse>),
    ])
      .then(([iv, tr]) => {
        setInvestors(iv.rows);
        setTrades(tr.rows);
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = stats
    ? [
        { label: "Verfolgte Akteure", value: stats.entities },
        { label: "Institutionen", value: stats.institutions },
        { label: "Insider", value: stats.insiders },
        { label: "Politiker", value: stats.politicians },
      ]
    : [];

  const spotlight = investors.filter((i) => i.person).slice(0, 10);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Verfolge das smarte Geld.
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-subtle">
          Trades von Star-Investoren, Konzern-Insidern und Politikern — aus offiziellen
          Offenlegungen, mit Kursentwicklung seit der Meldung.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="text-2xl font-semibold tracking-tight">
              {c.value.toLocaleString("de-DE")}
            </div>
            <div className="mt-0.5 text-xs text-subtle">{c.label}</div>
          </div>
        ))}
      </div>

      <Watchlist />

      {spotlight.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Im Rampenlicht</h2>
            <Link href="/portfolio" className="text-sm text-brand hover:underline">
              Alle ›
            </Link>
          </div>
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {spotlight.map((iv) => (
              <Link
                key={iv.slug}
                href={`/investor/${iv.slug}`}
                className="flex w-36 shrink-0 flex-col items-center rounded-2xl bg-gradient-to-b from-sky-50 to-white p-4 text-center shadow-card ring-1 ring-hair transition hover:shadow-cardhover"
              >
                <Avatar name={iv.person ?? iv.fund} size={72} />
                <div className="mt-2 w-full truncate text-sm font-semibold leading-tight">
                  {iv.person ?? iv.fund}
                </div>
                <div className="mt-0.5 text-xs text-subtle">{abbrevMoney(iv.value)}</div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Letzte Trades</h2>
          <Link href="/feed" className="text-sm text-brand hover:underline">
            Zum Feed ›
          </Link>
        </div>
        <TradeFeed rows={trades} loading={loading} />
      </section>
    </div>
  );
}
