"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { Donut } from "@/components/Donut";
import { ErrorRetry } from "@/components/ErrorRetry";
import { FollowButton } from "@/components/FollowButton";
import { PriceChart } from "@/components/PriceChart";
import { SkeletonPage } from "@/components/Skeleton";
import { TradeFeed } from "@/components/TradeFeed";
import { fetchJson } from "@/lib/fetchJson";
import { abbrevMoney, fixTicker, weightPct, formatDate, isStaleDate } from "@/lib/format";
import { PriceBar, PricesResponse, StockDetail, StockResponse } from "@/lib/types";
import { useQuotes } from "@/lib/useQuotes";
import { Icon } from "@/components/Icon";

export default function StockPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = params?.ticker as string;
  const [stock, setStock] = useState<StockDetail | null>(null);
  const [bars, setBars] = useState<PriceBar[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(false);
  const [tick, setTick] = useState(0);
  const [priceError,setPriceError] = useState(false);
  const [actTab, setActTab] = useState<"inv" | "ins">("inv");
  const [range, setRange] = useState(3); // default 1J
  const liveTicker = ticker;
  const quotes = useQuotes(liveTicker ? [liveTicker] : []);
  const quote = liveTicker ? quotes[liveTicker.toUpperCase()] : undefined;

  useEffect(() => {
    if (!ticker) return;
    const controller = new AbortController();
    setPriceError(false); setBars(null);
    setLoading(true);
    setErr(false);
    fetchJson<StockResponse>(`/api/stock?ticker=${encodeURIComponent(ticker)}`, {signal:controller.signal})
      .then((d) => setStock(d.stock))
      .catch(() => {if(!controller.signal.aborted) setErr(true);})
      .finally(() => {if(!controller.signal.aborted) setLoading(false);});
    fetchJson<PricesResponse>(`/api/prices?ticker=${encodeURIComponent(ticker)}`, {signal:controller.signal})
      .then((d) => setBars(d.bars))
      .catch(() => {if(!controller.signal.aborted) {setBars([]);setPriceError(true);}});
    return () => controller.abort();
  }, [ticker, tick]);

  if (loading) return <SkeletonPage />;
  if (err) return <ErrorRetry onRetry={() => setTick((t) => t + 1)} />;
  if (!stock)
    return (
      <div className="py-16 text-center text-sm text-subtle">
        Aktie nicht gefunden.{" "}
        <Link href="/discover" className="text-brand underline">
          Zurück zu Entdecken
        </Link>
      </div>
    );

  const buys = stock.trades.filter((t) => t.txnType === "buy").length;
  const sells = stock.trades.filter((t) => t.txnType === "sell").length;

  // Investorenaktivität: jeder Investor landet in genau einem Topf. Die Meldungen
  // reichen über mehrere Quartale — wer erst kaufte und später verkaufte, wurde
  // vorher doppelt gezählt, sodass die Ringsumme über der Kopfzahl lag.
  // Maßgeblich ist deshalb die jüngste Meldung je Investor (Liste ist nach
  // Datum absteigend sortiert), Bestandshalter ohne Meldung gelten als gehalten.
  const insts = stock.trades.filter((t) => t.entityType === "institution" && !t.putCall);
  const lastAction = new Map<string, "buy" | "sell" | "hold">();
  for (const t of insts) {
    const key = t.entitySlug ?? t.entityName;
    if (lastAction.has(key)) continue;
    if (t.txnType === "buy" || t.txnType === "sell") lastAction.set(key, t.txnType);
  }
  for (const h of stock.holders) if (!h.putCall && !lastAction.has(h.slug)) lastAction.set(h.slug, "hold");
  const countBy = (v: "buy" | "sell" | "hold") =>
    [...lastAction.values()].filter((x) => x === v).length;
  const act = [
    { label: "Bestand erhöht", value: countBy("buy"), color: "rgb(var(--bull-fill))" },
    { label: "Gehalten", value: countBy("hold"), color: "rgb(var(--n-400))" },
    { label: "Bestand reduziert", value: countBy("sell"), color: "rgb(var(--bear-fill))" },
  ];
  const actTotal = act.reduce((a, s) => a + s.value, 0);

  // Insider activity from Form 4 trades (no holdings snapshot, so no "held").
  const insiderTrades = stock.trades.filter(t => t.entityType === "corporate_insider" && !t.isDerivative && ["P","S"].includes(t.transactionCode ?? ""));
  const latestInsider = new Map<string,string>();
  for (const t of insiderTrades) if (!latestInsider.has(t.entityName)) latestInsider.set(t.entityName,t.transactionCode!);
  const insBought = new Set([...latestInsider].filter(([,code]) => code === "P").map(([name]) => name));
  const insSold = new Set([...latestInsider].filter(([,code]) => code === "S").map(([name]) => name));
  const insAct = [
    { label: "Gekauft", value: insBought.size, color: "rgb(var(--bull-fill))" },
    { label: "Verkauft", value: insSold.size, color: "rgb(var(--bear-fill))" },
  ];
  const insTotal = insBought.size + insSold.size;

  const curSegs = actTab === "inv" ? act : insAct;
  const curTotal = actTab === "inv" ? actTotal : insTotal;
  const curTop = [...curSegs].sort((a, b) => b.value - a.value)[0];

  const up = bars && bars.length > 1 ? bars[bars.length - 1].close >= bars[0].close : true;
  const chg =
    bars && bars.length > 1 ? (bars[bars.length - 1].close - bars[0].close) / bars[0].close : null;

  const stats = [
    { label: "Investoren mit Bestand", value: stock.investors.toLocaleString("de-DE") },
    { label: "Gehaltener Wert", value: abbrevMoney(stock.value) },
    { label: "Zugänge (geladen)", value: String(buys), cls: "text-bull" },
    { label: "Abgänge (geladen)", value: String(sells), cls: "text-bear" },
  ];

  return (
    <div className="space-y-6">
      <Link href="/discover" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-subtle hover:text-ink">
        <Icon name="chevronLeft" className="h-4 w-4" />
        Entdecken
      </Link>

      <div className="flex items-center gap-4">
        <CompanyLogo ticker={stock.ticker} company={stock.company} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{stock.company}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-subtle">
              {fixTicker(stock.ticker, stock.company) ?? "—"}
            </span>
            {quote && (
              <span className="flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-sm font-semibold">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    quote.marketState === "REGULAR" ? "animate-live bg-bull-fill" : "bg-slate-300"
                  }`}
                />
                {quote.currency || "Kurs"} {" "}
                {quote.price.toLocaleString("de-DE", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                <span className="text-[10px] font-normal text-subtle">{new Date(quote.t).toLocaleString("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
                {quote.changePct != null && (
                  <span className={quote.changePct >= 0 ? "text-bull" : "text-bear"}>
                    {quote.changePct >= 0 ? "+" : ""}
                    {(quote.changePct * 100).toLocaleString("de-DE",{maximumFractionDigits:2})} %
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        {stock.ticker && <FollowButton kind="stock" id={stock.ticker} />}
      </div>

      {bars && bars.length > 1 && (
        <div className="lcard p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">Kurs</span>
            <div className="inline-flex rounded-full bg-slate-100 p-0.5 text-xs font-medium">
              {(["1M", "3M", "6M", "1J", "Max"] as const).map((label, i) => (
                <button
                  key={label}
                  onClick={() => setRange(i)}
                  className={`press-sm rounded-full px-2.5 py-1 ${
                    range === i ? "bg-card text-ink shadow-card" : "text-subtle"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <PriceChart bars={bars.slice(-[21, 63, 126, 252, bars.length][range])} height={170} />
        </div>
      )}

      {priceError && <ErrorRetry onRetry={() => setTick(t => t+1)}/>}
      {bars?.length ? <p className="text-xs text-subtle">Historische Schlusskurse · Stand {formatDate(bars[bars.length-1].date)}{isStaleDate(bars[bars.length-1].date) ? " · veraltet" : ""}</p> : !priceError && <p className="text-sm text-subtle">Kein historischer Kursverlauf vorhanden.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-card p-4 shadow-card">
            <div className={`num-lg ${s.cls ?? ""}`}>{s.value}</div>
            <div className="mt-0.5 text-xs text-subtle">{s.label}</div>
          </div>
        ))}
      </div>

      {(actTotal > 0 || insTotal > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Aktivität</h2>
              {/* Hinweis, weil diese Summe größer sein darf als „Investoren mit
                  Bestand“: wer komplett verkauft hat, taucht hier noch auf. */}
              <p className="text-xs text-subtle">
                {actTab === "inv"
                  ? "Jüngste geladene Bestandsänderung je Investor. Optionspositionen sind ausgenommen."
                  : "Jüngster bestätigter Kauf oder Verkauf je Insider in den geladenen Meldungen."}
              </p>
            </div>
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
                  className={`press-sm rounded-full px-3 py-1 ${
                    actTab === k ? "bg-card text-ink shadow-card" : "text-subtle"
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
              key={`${h.slug || h.fund}-${h.putCall ?? "stock"}`}
              href={h.slug ? `/investor/${h.slug}` : "#"}
              className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50"
            >
              <Avatar name={h.person ?? h.fund} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{h.person ?? h.fund}</div>
                <div className="truncate text-xs text-subtle">
                  {h.fund}
                  {h.putCall ? ` · ${h.putCall}-Option` : ""}
                </div>
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
        <h2 className="text-lg font-semibold tracking-tight">Letzte Meldungen</h2>
        <TradeFeed rows={stock.trades} empty="Keine gemeldeten Trades für diese Aktie." />
      </section>
    </div>
  );
}
