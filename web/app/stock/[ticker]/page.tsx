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
import { SkeletonChart, SkeletonPage } from "@/components/Skeleton";
import { SegmentedControl, StatRow, DetailTopBar } from "@/components/ui";
import { TradeFeed } from "@/components/TradeFeed";
import { fetchJson } from "@/lib/fetchJson";
import { abbrevMoney, fixTicker, weightPct, formatDate, isStaleDate, shortMoney } from "@/lib/format";
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
  const [range, setRange] = useState<"1M" | "3M" | "6M" | "1J" | "Max">("1J");
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
      <div className="py-16 text-center text-[15px] text-subtle">
        Aktie nicht gefunden.{" "}
        <Link href="/discover" className="text-ink underline">
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
    { label: "Gehalten", value: countBy("hold"), color: "rgb(var(--flat-fill))" },
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

  // Stored closes end at the last import; the live quote extends the line to
  // now, so the chart and the price above it tell the same story.
  const liveDay = quote ? new Date(quote.t).toISOString().slice(0, 10) : null;
  const series: PriceBar[] | null = bars && quote && liveDay && (!quote.currency || quote.currency === "USD")
    ? bars.length && bars[bars.length - 1].date >= liveDay
      ? [...bars.slice(0, -1), { ...bars[bars.length - 1], close: quote.price }]
      : [...bars, { date: liveDay, close: quote.price }]
    : bars;
  const up = series && series.length > 1 ? series[series.length - 1].close >= series[0].close : true;

  const stats = [
    { label: "Investoren mit Bestand", value: stock.investors.toLocaleString("de-DE") },
    { label: "Gehaltener Wert", value: shortMoney(stock.value) },
    { label: "Zugänge (geladen)", value: String(buys), cls: "text-bull" },
    { label: "Abgänge (geladen)", value: String(sells), cls: "text-bear" },
  ];

  return (
    <div className="space-y-8">
      <div className="aura-header space-y-5" style={{ ["--aura" as string]: up ? "var(--bull-fill)" : "var(--bear-fill)", ["--aura-2" as string]: "var(--aura-investor)" }}>
      <DetailTopBar back="/discover?tab=stocks" label="Aktien" action={stock.ticker ? <FollowButton kind="stock" id={stock.ticker} /> : undefined} />

      <div className="fade-up flex items-center gap-4">
        <CompanyLogo ticker={stock.ticker} company={stock.company} size={72} rounded="rounded-[20px]" />
        <div className="min-w-0 flex-1">
          <h1 className="large-title truncate">{stock.company}</h1>
          <div className="mt-1 text-[15px] font-medium text-subtle">{fixTicker(stock.ticker, stock.company) ?? "—"}</div>
        </div>
      </div>
      {quote && (
        <div className="fade-up flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="num-xl">{quote.price.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[17px] font-semibold text-subtle">{quote.currency || ""}</span></span>
          {quote.changePct != null && (
            <span className={`text-[15px] font-semibold tabular-nums ${quote.changePct >= 0 ? "text-bull" : "text-bear"}`}>
              {quote.changePct >= 0 ? "▲" : "▼"} {Math.abs(quote.changePct * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} % heute
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[13px] text-subtle">
            <span className={`h-1.5 w-1.5 rounded-full ${quote.marketState === "REGULAR" ? "animate-live bg-bull-fill" : "bg-slate-300"}`} />
            {quote.marketState === "REGULAR" ? "Live" : "Letzter Kurs"} · {new Date(quote.t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}

      {bars === null ? (
        <div className="card p-4 sm:p-5"><SkeletonChart height={260} /></div>
      ) : bars.length > 1 && (
        <div className="card fade-up p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="eyebrow">Kurs</span>
            <SegmentedControl label="Zeitraum" size="sm" options={[["1M", "1M"], ["3M", "3M"], ["6M", "6M"], ["1J", "1J"], ["Max", "Max"]] as const} value={range} onChange={setRange} />
          </div>
          <PriceChart key={range} bars={(series ?? bars).slice(-({ "1M": 22, "3M": 64, "6M": 127, "1J": 253, Max: (series ?? bars).length }[range]))} height={220} />
        </div>
      )}
      </div>

      {priceError && <ErrorRetry onRetry={() => setTick(t => t+1)}/>}
      {bars?.length ? <p className="-mt-5 text-[13px] text-subtle">Schlusskurse bis {formatDate(bars[bars.length-1].date)}{quote ? ` · aktueller Kurs von ${new Date(quote.t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} Uhr` : isStaleDate(bars[bars.length-1].date) ? " · veraltet" : ""}</p> : !priceError && <p className="text-sm text-subtle">Kein historischer Kursverlauf vorhanden.</p>}
      <StatRow items={stats} />

      {(actTotal > 0 || insTotal > 0) && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[14rem] flex-1">
              <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Aktivität</h2>
              {/* Hinweis, weil diese Summe größer sein darf als „Investoren mit
                  Bestand“: wer komplett verkauft hat, taucht hier noch auf. */}
              <p className="text-xs text-subtle">
                {actTab === "inv"
                  ? "Jüngste geladene Bestandsänderung je Investor. Optionspositionen sind ausgenommen."
                  : "Jüngster bestätigter Kauf oder Verkauf je Insider in den geladenen Meldungen."}
              </p>
            </div>
            <SegmentedControl label="Aktivität von" size="sm" options={[["inv", "Investoren"], ["ins", "Insider"]] as const} value={actTab} onChange={setActTab} />
          </div>

          {curTotal === 0 ? (
            <div className="card p-6 text-center text-[15px] text-subtle">
              Keine {actTab === "inv" ? "Investoren" : "Insider"}-Aktivität in dieser Meldung.
            </div>
          ) : (
            <div className="card flex flex-col items-center gap-6 p-5 sm:flex-row">
              <Donut
                segments={curSegs}
                centerTop={`${Math.round((curTop.value / curTotal) * 100)} %`}
                centerBottom={curTop.label}
              />
              <div className="w-full flex-1 space-y-2.5">
                {curSegs.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-sm">
                    <span className="dot-3d" style={{ ["--c" as string]: s.color }} />
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
        <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Wer hält diese Aktie</h2>
        <div className="card overflow-hidden">
          {stock.holders.map((h) => (
            <Link
              key={`${h.slug || h.fund}-${h.putCall ?? "stock"}`}
              href={h.slug ? `/investor/${h.slug}` : "#"}
              className="relative flex items-center gap-3 px-4 py-3 transition-colors after:absolute after:bottom-0 after:left-[4.25rem] after:right-0 after:h-px after:bg-hair last:after:hidden hover:bg-ink/[0.03]"
            >
              <Avatar name={h.person ?? h.fund} size={42} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{h.person ?? h.fund}</div>
                <div className="truncate text-[13px] text-subtle">
                  {h.fund}
                  {h.putCall ? ` · ${h.putCall}-Option` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-semibold tabular-nums">{weightPct(h.weight)}</div>
                <div className="text-[13px] tabular-nums text-subtle">{abbrevMoney(h.value)}</div>
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
        <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Letzte Meldungen</h2>
        <TradeFeed rows={stock.trades} empty="Keine gemeldeten Trades für diese Aktie." />
      </section>
    </div>
  );
}
