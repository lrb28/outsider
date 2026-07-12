"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { TradeFeed } from "@/components/TradeFeed";
import { abbrevMoney, weightPct } from "@/lib/format";
import { StockDetail, StockResponse } from "@/lib/types";

export default function StockPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = params?.ticker as string;
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json() as Promise<StockResponse>)
      .then((d) => setStock(d.stock))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div className="py-16 text-center text-sm text-subtle">Lädt…</div>;
  if (!stock)
    return (
      <div className="py-16 text-center text-sm text-subtle">
        Aktie nicht gefunden.{" "}
        <Link href="/portfolio" className="text-brand underline">
          Zurück zum Portfolio
        </Link>
      </div>
    );

  const stats = [
    {
      label: "Verfolgte Investoren",
      value: stock.investors.toLocaleString("de-DE"),
    },
    { label: "Gehaltener Wert", value: abbrevMoney(stock.value) },
  ];

  return (
    <div className="space-y-6">
      <Link href="/portfolio" className="inline-block text-sm text-subtle hover:text-ink">
        ‹ Portfolio
      </Link>

      <div className="flex items-center gap-4">
        <CompanyLogo ticker={stock.ticker} company={stock.company} size={64} />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{stock.company}</h1>
          <div className="font-mono text-sm text-subtle">{stock.ticker ?? "—"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-card p-4 shadow-card">
            <div className="text-lg font-semibold tracking-tight">{s.value}</div>
            <div className="mt-0.5 text-xs text-subtle">{s.label}</div>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Wer hält diese Aktie</h2>
        <div className="overflow-hidden rounded-2xl bg-card shadow-card">
          {stock.holders.map((h) => (
            <Link
              key={h.slug || h.fund}
              href={h.slug ? `/investor/${h.slug}` : "#"}
              className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50"
            >
              <Avatar name={h.person ?? h.fund} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{h.person ?? h.fund}</div>
                <div className="truncate text-xs text-subtle">{h.fund}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{weightPct(h.weight)}</div>
                <div className="text-xs text-subtle">{abbrevMoney(h.value)}</div>
              </div>
            </Link>
          ))}
          {stock.holders.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-subtle">
              Aktuell hält keiner der verfolgten Investoren diese Aktie.
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Letzte Trades</h2>
        <TradeFeed rows={stock.trades} empty="Keine gemeldeten Trades für diese Aktie." />
      </section>
    </div>
  );
}
