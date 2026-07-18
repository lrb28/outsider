"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Donut } from "@/components/Donut";
import { FollowButton } from "@/components/FollowButton";
import { SkeletonPage } from "@/components/Skeleton";
import { Sparkline } from "@/components/Sparkline";
import { TradeFeed } from "@/components/TradeFeed";
import { abbrevMoney, fixTicker, weightPct } from "@/lib/format";
import { PriceBar, PricesResponse, StockDetail, StockResponse } from "@/lib/types";

export default function StockPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = params?.ticker as string;
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [bars, setBars] = useState<PriceBar[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [actTab, setActTab] = useState<"inv" | "ins">("inv");

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`/api/stock?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json() as Promise<StockResponse>)
      .then((d) => setStock(d.stock))
      .finally(() => setLoading(false));
    fetch(`/api/prices?ticker=${encodeURIComponent(ticker)}`)
      .then((r) => r.json() as Promise<PricesResponse>)
      .then((d) => setBars(d.bars))
      .catch(() => setBars([]));
  }, [ticker]);

  if (loading) return <SkeletonPage />;
  if (!stock)
    return (
      <div className="py-16 text-center text-sm text-subtle">
        Aktie nicht gefunden.{" "}
        <Link href="/portfolio" className="text-brand underline">
          Zurück zum Portfolio
        </Link>
      </div>
    );

  const buys = stock.trades.filter((t) => t.txnType === "buy").length;
  const sells = stock.trades.filter((t) => t.txnType === "sell").length;

  // Investor activity this quarter: who bought / sold / just held (institutions).
  const insts = stock.trades.filter((t) => t.entityType === "institution");
  const boughtSet = new Set(insts.filter((t) => t.txnType === "buy").map((t) => t.entitySlug ?? t.entityName));
  const soldSet = new Set(insts.filter((t) => t.txnType === "sell").map((t) => t.entitySlug ?? t.entityName));
  const heldCount = stock.holders.filter(
    (h) => !boughtSet.has(h.slug) && !soldSet.has(h.slug),
  ).length;
  const act = [
    { label: "Gekauft", value: boughtSet.size, color: "#16a34a" },
    { label: "Gehalten", value: heldCount, color: "#94a3b8" },
    { label: "Verkauft", value: soldSet.size, color: "#dc2626" },
  ];
  const actTotal = act.reduce((a, s) => a + s.value, 0);

  // Insider activity from Form 4 trades (no holdings snapshot, so no "held").
  const insiderTrades = stock.trades.filter((t) => t.entityType === "corporate_insider");
  const insBought = new Set(insiderTrades.filter((t) => t.txnType === "buy").map((t) => t.entityName));
  const insSold = new Set(insiderTrades.filter((t) => t.txnType === "sell").map((t) => t.entityName));
  const insAct = [
    { label: "Gekauft", value: insBought.size, color: "#16a34a" },
    { label: "Verkauft", value: insSold.size, color: "#dc2626" },
  ];
  const insTotal = insBought.size + insSold.size;

  const curSegs = actTab === "inv" ? act : insAct;
  const curTotal = actTab === "inv" ? actTotal : insTotal;
  const curTop = [...curSegs].sort((a, b) => b.value - a.value)[0];

  const up = bars && bars.length > 1 ? bars[bars.length - 1].close >= bars[0].close : true;
  const chg =
    bars && bars.length > 1 ? (bars[bars.length - 1].close - bars[0].close) / bars[0].close : null;

  const stats = [
    { label: "Verfolgte Investoren", value: stock.investors.toLocaleString("de-DE") },
    { label: "Gehaltener Wert", value: abbrevMoney(stock.value) },
    { label: "Käufe (verfolgt)", value: String(buys), cls: "text-bull" },
    { label: "Verkäufe (verfolgt)", value: String(sells), cls: "text-bear" },
  ];

  return (
    <div className="space-y-6">
      <Link href="/portfolio" className="inline-block text-sm text-subtle hover:text-ink">
        ‹ Portfolio
      </Link>

      <div className="flex items-center gap-4">
        <CompanyLogo ticker={stock.ticker} company={stock.company} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{stock.company}</h1>
          <div className="font-mono text-sm text-subtle">{fixTicker(stock.ticker, stock.company) ?? "—"}</div>
        </div>
        {stock.ticker && <FollowButton kind="stock" id={stock.ticker} />}
      </div>

      {bars && bars.length > 1 && (
        <div className="rounded-2xl bg-card p-4 shadow-card">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-sm text-subtle">Kurs (12 Monate)</span>
            <span className={`text-sm font-semibold ${up ? "text-bull" : "text-bear"}`}>
              {chg === null ? "" : `${chg >= 0 ? "+" : ""}${(chg * 100).toFixed(1)} %`}
            </span>
          </div>
          <Sparkline bars={bars} up={up} height={140} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-card p-4 shadow-card">
            <div className={`text-lg font-semibold tracking-tight ${s.cls ?? ""}`}>{s.value}</div>
            <div className="mt-0.5 text-xs text-subtle">{s.label}</div>
          </div>
        ))}
      </div>

      {(actTotal > 0 || insTotal > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Aktivität</h2>
            <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-medium">
              {(
                [
                  ["inv", "Investoren"],
                  ["ins", "Insider"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setActTab(k)}
                  className={`rounded-full px-3 py-1 transition ${
                    actTab === k ? "bg-white text-ink shadow-card" : "text-subtle"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {curTotal === 0 ? (
            <div className="rounded-2xl bg-card p-6 text-center text-sm text-subtle shadow-card">
              Keine {actTab === "inv" ? "Investoren" : "Insider"}-Aktivität in dieser Meldung.
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 rounded-2xl bg-card p-5 shadow-card sm:flex-row">
              <Donut
                segments={curSegs}
                centerTop={`${Math.round((curTop.value / curTotal) * 100)} %`}
                centerBottom={curTop.label}
              />
              <div className="w-full flex-1 space-y-2.5">
                {curSegs.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-ink">{s.label}</span>
                    <span className="text-xs text-subtle">
                      {s.value}{" "}
                      {actTab === "inv"
                        ? s.value === 1
                          ? "Investor"
                          : "Investoren"
                        : "Insider"}
                    </span>
                    <span className="ml-auto font-semibold">
                      {Math.round((s.value / curTotal) * 100)} %
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

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
