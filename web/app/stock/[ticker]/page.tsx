"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { ErrorRetry } from "@/components/ErrorRetry";
import { FollowButton } from "@/components/FollowButton";
import { PriceChart } from "@/components/PriceChart";
import { SkeletonChart, SkeletonPage } from "@/components/Skeleton";
import { SegmentedControl, StatRow, DetailTopBar } from "@/components/ui";
import { HoldersSheet, INFLOW, MovesSheet, OUTFLOW, StockActivity, TradesSheet } from "@/components/StockActivity";
import { TradeFeed } from "@/components/TradeFeed";
import { fetchJson } from "@/lib/fetchJson";
import { abbrevMoney, fixTicker, weightPct, formatDate, isStaleDate, shortMoney } from "@/lib/format";
import { FeedRow, PriceBar, PricesResponse, StockDetail, StockMoveKind, StockResponse } from "@/lib/types";
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
  type Open = { kind: "holders" } | { kind: "moves"; kinds: StockMoveKind[]; title: string } | { kind: "trades"; rows: FeedRow[]; title: string; subtitle: string };
  const [open, setOpen] = useState<Open | null>(null);
  const [allHolders, setAllHolders] = useState(false);
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

  // Zugänge/Abgänge: the tracked funds that bought or sold in their latest
  // 13F, the same source as the activity ring below, so both agree. Older
  // API responses without it fall back to the loaded filings.
  const moves = stock.activity ?? null;
  const inflow = moves ? moves.filter((m) => INFLOW.includes(m.kind)) : null;
  const outflow = moves ? moves.filter((m) => OUTFLOW.includes(m.kind)) : null;
  const buyRows = stock.trades.filter((t) => t.txnType === "buy");
  const sellRows = stock.trades.filter((t) => t.txnType === "sell");
  const holderAsOf = moves?.find((m) => m.shares !== null)?.asOf ?? null;
  const holderList = allHolders ? stock.holders : stock.holders.slice(0, 6);

  // Stored closes end at the last import; the live quote extends the line to
  // now, so the chart and the price above it tell the same story.
  const liveDay = quote ? new Date(quote.t).toISOString().slice(0, 10) : null;
  const series: PriceBar[] | null = bars && quote && liveDay && (!quote.currency || quote.currency === "USD")
    ? bars.length && bars[bars.length - 1].date >= liveDay
      ? [...bars.slice(0, -1), { ...bars[bars.length - 1], close: quote.price }]
      : [...bars, { date: liveDay, close: quote.price }]
    : bars;
  const up = series && series.length > 1 ? series[series.length - 1].close >= series[0].close : true;

  const openHolders = stock.holders.length ? () => setOpen({ kind: "holders" }) : undefined;
  const stats = [
    { label: "Investoren mit Bestand", value: stock.investors.toLocaleString("de-DE"), onClick: openHolders, hint: "Alle Investoren mit Bestand anzeigen" },
    { label: "Gehaltener Wert", value: shortMoney(stock.value), onClick: openHolders, hint: "Bestände nach Wert anzeigen" },
    inflow
      ? { label: "Zugänge im Quartal", value: String(inflow.length), cls: "text-bull", onClick: () => setOpen({ kind: "moves", kinds: INFLOW, title: "Zugänge im Quartal" }), hint: "Investoren anzeigen, die gekauft haben" }
      : { label: "Käufe in den Meldungen", value: String(buyRows.length), cls: "text-bull", onClick: () => setOpen({ kind: "trades", rows: buyRows, title: "Käufe", subtitle: `Gemeldete Käufe in den letzten ${stock.trades.length} Meldungen.` }) },
    outflow
      ? { label: "Abgänge im Quartal", value: String(outflow.length), cls: "text-bear", onClick: () => setOpen({ kind: "moves", kinds: OUTFLOW, title: "Abgänge im Quartal" }), hint: "Investoren anzeigen, die verkauft haben" }
      : { label: "Verkäufe in den Meldungen", value: String(sellRows.length), cls: "text-bear", onClick: () => setOpen({ kind: "trades", rows: sellRows, title: "Verkäufe", subtitle: `Gemeldete Verkäufe in den letzten ${stock.trades.length} Meldungen.` }) },
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
          <p className="mt-3 text-[12px] leading-snug text-subtle">Schlusskurse bis {formatDate(bars[bars.length - 1].date)}{quote ? ` · Kurs von ${new Date(quote.t).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} Uhr` : isStaleDate(bars[bars.length - 1].date) ? " · veraltet" : ""}</p>
        </div>
      )}
      </div>

      {priceError && <ErrorRetry onRetry={() => setTick(t => t+1)}/>}
      {bars && bars.length <= 1 && !priceError && <p className="text-sm text-subtle">Kein historischer Kursverlauf vorhanden.</p>}
      <StatRow items={stats} />

      <StockActivity
        company={stock.company}
        moves={moves}
        trades={stock.trades}
        onOpenMoves={(kinds, title) => setOpen({ kind: "moves", kinds, title })}
        onOpenTrades={(rows, title, subtitle) => setOpen({ kind: "trades", rows, title, subtitle })}
      />

      <section className="space-y-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Wer hält diese Aktie</h2>
        <div className="card overflow-hidden">
          {holderList.map((h) => (
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
          {stock.holders.length > holderList.length && (
            <button type="button" onClick={() => setAllHolders(true)} className="flex w-full items-center justify-center gap-1 border-t border-hair py-3 text-[15px] font-medium text-ink hover:bg-ink/[0.03]">
              Alle {stock.holders.length} anzeigen <Icon name="chevronDown" className="h-4 w-4 text-subtle" />
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-[22px] font-bold tracking-[-0.01em]">Letzte Meldungen</h2>
        <TradeFeed rows={stock.trades} empty="Keine gemeldeten Trades für diese Aktie." />
      </section>

      {open?.kind === "holders" && <HoldersSheet holders={stock.holders} company={stock.company} value={stock.value} asOf={holderAsOf} onClose={() => setOpen(null)} />}
      {open?.kind === "moves" && moves && <MovesSheet title={open.title} kinds={open.kinds} moves={moves} company={stock.company} onClose={() => setOpen(null)} />}
      {open?.kind === "trades" && <TradesSheet title={open.title} subtitle={open.subtitle} rows={open.rows} onClose={() => setOpen(null)} />}
    </div>
  );
}
