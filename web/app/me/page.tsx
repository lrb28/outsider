"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AllocationBar } from "@/components/AllocationBar";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CompareChart } from "@/components/CompareChart";
import { Donut } from "@/components/Donut";
import { abbrevMoney, companyName, fixTicker, pct } from "@/lib/format";
import {
  MyHolding,
  clearHoldings,
  getMyHoldings,
  parseCsv,
  parseNum,
  removeHolding,
  setMyHoldings,
  upsertHolding,
} from "@/lib/myportfolio";
import { HoldingRow, MatchResponse, MatchRow, PriceBar, PricesResponse } from "@/lib/types";

const BENCHMARKS: [string, string][] = [
  ["SPY", "S&P 500"],
  ["IVV", "S&P 500"],
  ["VOO", "S&P 500"],
  ["QQQ", "Nasdaq 100"],
];

const DONUT_COLORS = ["#4f46e5", "#0ea5e9", "#16a34a", "#f59e0b", "#db2777", "#8b5cf6"];

function price(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `$${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MePage() {
  const [holdings, setHoldings] = useState<MyHolding[]>([]);
  const [bars, setBars] = useState<Record<string, PriceBar[] | null>>({});
  const [bench, setBench] = useState<{ label: string; bars: PriceBar[] } | null | undefined>(
    undefined,
  );
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // sync with localStorage
  useEffect(() => {
    const sync = () => setHoldings(getMyHoldings());
    sync();
    window.addEventListener("mydepot", sync);
    return () => window.removeEventListener("mydepot", sync);
  }, []);

  // fetch price bars for held tickers
  useEffect(() => {
    let on = true;
    holdings
      .map((h) => h.ticker)
      .filter((t) => !(t in bars))
      .forEach((t) => {
        fetch(`/api/prices?ticker=${encodeURIComponent(t)}`)
          .then((r) => r.json() as Promise<PricesResponse>)
          .then((d) => {
            if (!on) return;
            setBars((p) => ({
              ...p,
              [t]: d.source === "database" && d.bars.length > 1 ? d.bars : null,
            }));
          })
          .catch(() => on && setBars((p) => ({ ...p, [t]: null })));
      });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings]);

  // benchmark with fallback chain (SPY -> IVV -> VOO -> QQQ)
  useEffect(() => {
    if (bench !== undefined) return;
    let on = true;
    (async () => {
      for (const [t, label] of BENCHMARKS) {
        try {
          const d = (await fetch(`/api/prices?ticker=${t}`).then((r) =>
            r.json(),
          )) as PricesResponse;
          if (d.source === "database" && d.bars.length > 1) {
            if (on) setBench({ label, bars: d.bars });
            return;
          }
        } catch {
          /* try next */
        }
      }
      if (on) setBench(null);
    })();
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // investor match
  useEffect(() => {
    if (holdings.length === 0) {
      setMatches(null);
      return;
    }
    let on = true;
    fetch(`/api/match?tickers=${encodeURIComponent(holdings.map((h) => h.ticker).join(","))}`)
      .then((r) => r.json() as Promise<MatchResponse>)
      .then((d) => on && setMatches(d.rows))
      .catch(() => on && setMatches([]));
    return () => {
      on = false;
    };
  }, [holdings]);

  // per-holding derived values
  const rows = useMemo(() => {
    return holdings.map((h) => {
      const b = bars[h.ticker];
      const last = b && b.length ? b[b.length - 1].close : null;
      const value = last != null ? h.shares * last : null;
      const invested = h.buyPrice ? h.buyPrice * h.shares : null;
      const plAbs = last != null && h.buyPrice ? (last - h.buyPrice) * h.shares : null;
      const plPct = last != null && h.buyPrice ? (last - h.buyPrice) / h.buyPrice : null;
      return { ...h, last, value, invested, plAbs, plPct };
    });
  }, [holdings, bars]);

  const total = rows.reduce((a, r) => a + (r.value ?? 0), 0);
  const withValue = rows.filter((r) => r.value !== null);
  const noPriceCount = rows.length - withValue.length;

  // portfolio value series (constant shares, forward-filled closes)
  const series = useMemo((): PriceBar[] => {
    const withBars = holdings
      .map((h) => ({ h, b: bars[h.ticker] }))
      .filter((x): x is { h: MyHolding; b: PriceBar[] } => !!x.b && x.b.length > 1);
    if (withBars.length === 0) return [];
    const start = withBars
      .map(({ b }) => b[0].date)
      .reduce((a, d) => (d > a ? d : a), "0000-00-00");
    const dates = [...new Set(withBars.flatMap(({ b }) => b.map((x) => x.date)))]
      .filter((d) => d >= start)
      .sort();
    const cur = new Map<string, number>();
    const idx = new Map<string, number>();
    const out: PriceBar[] = [];
    for (const d of dates) {
      for (const { h, b } of withBars) {
        let i = idx.get(h.ticker) ?? 0;
        while (i < b.length && b[i].date <= d) {
          cur.set(h.ticker, b[i].close);
          i++;
        }
        idx.set(h.ticker, i);
      }
      if (cur.size === withBars.length) {
        let v = 0;
        for (const { h } of withBars) v += h.shares * (cur.get(h.ticker) ?? 0);
        out.push({ date: d, close: v });
      }
    }
    return out;
  }, [holdings, bars]);

  const benchTrimmed = useMemo(() => {
    if (!bench || series.length < 2) return null;
    const start = series[0].date;
    const t = bench.bars.filter((b) => b.date >= start);
    return t.length > 1 ? t : null;
  }, [bench, series]);

  const perfPortfolio =
    series.length > 1 ? (series[series.length - 1].close - series[0].close) / series[0].close : null;
  const perfBench =
    benchTrimmed && benchTrimmed.length > 1
      ? (benchTrimmed[benchTrimmed.length - 1].close - benchTrimmed[0].close) /
        benchTrimmed[0].close
      : null;
  const benchLabel = bench?.label ?? "S&P 500";

  // invested / P&L (only for positions with a known buy price)
  const investedRows = rows.filter((r) => r.invested !== null && r.value !== null);
  const investedSum = investedRows.reduce((a, r) => a + (r.invested ?? 0), 0);
  const investedCur = investedRows.reduce((a, r) => a + (r.value ?? 0), 0);
  const plSum = investedSum > 0 ? investedCur - investedSum : null;

  const allocRows: HoldingRow[] = withValue.map((r) => ({
    ticker: r.ticker,
    securityName: r.ticker,
    company: companyName(r.ticker, null),
    weight: total > 0 ? (r.value ?? 0) / total : null,
    value: r.value,
    shares: r.shares,
    putCall: null,
  }));

  const donutSegs = useMemo(() => {
    const sorted = [...withValue].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6).reduce((a, r) => a + (r.value ?? 0), 0);
    const segs = top.map((r, i) => ({
      label: companyName(r.ticker, null),
      value: r.value ?? 0,
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }));
    if (rest > 0) segs.push({ label: "Übrige", value: rest, color: "#cbd5e1" });
    return segs;
  }, [withValue]);

  const sortedRows = [...rows].sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

  const onFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const { holdings: parsed, skipped } = parseCsv(String(reader.result || ""));
      if (parsed.length === 0) {
        setCsvMsg("Keine gültigen Zeilen gefunden. Format: TICKER,Anzahl — z. B. AAPL,10");
        return;
      }
      setMyHoldings(parsed);
      setCsvMsg(
        `${parsed.length} Positionen importiert${skipped > 0 ? ` (${skipped} Zeilen übersprungen)` : ""}.`,
      );
    };
    reader.readAsText(f);
  };

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const t = ticker.trim().toUpperCase();
    const s = parseNum(shares);
    const bp = buyPrice.trim() ? parseNum(buyPrice) : NaN;
    if (!/^[A-Z][A-Z0-9.\-]{0,7}$/.test(t) || !Number.isFinite(s) || s <= 0) {
      setCsvMsg("Bitte gültigen Ticker (z. B. AAPL) und Stückzahl eingeben.");
      return;
    }
    upsertHolding({ ticker: t, shares: s, ...(Number.isFinite(bp) && bp > 0 ? { buyPrice: bp } : {}) });
    setTicker("");
    setShares("");
    setBuyPrice("");
    setCsvMsg(null);
  };

  const exportCsv = () => {
    const lines = holdings.map((h) =>
      h.buyPrice ? `${h.ticker},${h.shares},${h.buyPrice}` : `${h.ticker},${h.shares}`,
    );
    const blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mein-depot.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const userWeightWith = (m: MatchRow) => {
    if (total <= 0) return null;
    const w = withValue
      .filter((r) => m.sharedTickers.includes(r.ticker.toUpperCase()))
      .reduce((a, r) => a + (r.value ?? 0), 0);
    return w / total;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mein Depot</h1>
        <p className="text-sm text-subtle">
          Lade dein Portfolio hoch und vergleiche es mit den Star-Investoren und dem Markt.
          Gespeichert wird nur lokal in deinem Browser.
        </p>
      </div>

      {/* Import */}
      <div className="rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-card hover:bg-indigo-600"
          >
            CSV hochladen
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <form onSubmit={onAdd} className="flex flex-wrap items-center gap-2">
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Ticker (AAPL)"
              className="w-32 rounded-full border border-hair bg-white px-3.5 py-1.5 text-sm outline-none focus:border-brand"
            />
            <input
              value={shares}
              onChange={(e) => setShares(e.target.value)}
              placeholder="Stück"
              className="w-24 rounded-full border border-hair bg-white px-3.5 py-1.5 text-sm outline-none focus:border-brand"
            />
            <input
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              placeholder="Kaufpreis $ (optional)"
              className="w-40 rounded-full border border-hair bg-white px-3.5 py-1.5 text-sm outline-none focus:border-brand"
            />
            <button className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
              + Hinzufügen
            </button>
          </form>
          {holdings.length > 0 && (
            <div className="ml-auto flex items-center gap-3">
              <button onClick={exportCsv} className="text-xs text-subtle underline hover:text-brand">
                CSV exportieren
              </button>
              <button
                onClick={() => clearHoldings()}
                className="text-xs text-subtle underline hover:text-bear"
              >
                Alle löschen
              </button>
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-subtle">
          CSV-Format: eine Zeile pro Position — <span className="font-mono">TICKER,Anzahl</span>{" "}
          (optional dritte Spalte Kaufpreis in USD). Beispiel:{" "}
          <span className="font-mono">AAPL,10,180</span>. Auch mit Semikolon möglich.
        </p>
        {csvMsg && <p className="mt-1 text-xs font-medium text-brand">{csvMsg}</p>}
      </div>

      {holdings.length === 0 && (
        <div className="rounded-2xl border border-dashed border-hair bg-white/50 p-8 text-center text-sm text-subtle">
          <span className="font-medium text-ink">Noch keine Positionen.</span> Lade eine CSV hoch
          oder füge oben deine erste Aktie hinzu.
        </div>
      )}

      {holdings.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <div className="text-lg font-semibold tracking-tight">{abbrevMoney(total || null)}</div>
              <div className="mt-0.5 text-xs text-subtle">Depotwert</div>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <div
                className={`text-lg font-semibold tracking-tight ${
                  perfPortfolio == null ? "" : perfPortfolio >= 0 ? "text-bull" : "text-bear"
                }`}
              >
                {pct(perfPortfolio)}
              </div>
              <div className="mt-0.5 text-xs text-subtle">Dein Depot (12M)</div>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <div
                className={`text-lg font-semibold tracking-tight ${
                  perfBench == null ? "" : perfBench >= 0 ? "text-bull" : "text-bear"
                }`}
              >
                {pct(perfBench)}
              </div>
              <div className="mt-0.5 text-xs text-subtle">{benchLabel} (12M)</div>
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-card">
              {plSum != null ? (
                <>
                  <div
                    className={`text-lg font-semibold tracking-tight ${
                      plSum >= 0 ? "text-bull" : "text-bear"
                    }`}
                  >
                    {plSum >= 0 ? "+" : "-"}
                    {abbrevMoney(Math.abs(plSum))}
                  </div>
                  <div className="mt-0.5 text-xs text-subtle">
                    Gewinn/Verlust (auf {abbrevMoney(investedSum)} Einstand)
                  </div>
                </>
              ) : (
                <>
                  <div className="text-lg font-semibold tracking-tight">{holdings.length}</div>
                  <div className="mt-0.5 text-xs text-subtle">Positionen</div>
                </>
              )}
            </div>
          </div>

          {perfPortfolio != null && perfBench != null && (
            <div
              className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                perfPortfolio >= perfBench
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {perfPortfolio >= perfBench
                ? `Dein Depot schlägt den ${benchLabel} um ${((perfPortfolio - perfBench) * 100).toFixed(1)} Prozentpunkte (12 Monate, heutige Stückzahlen).`
                : `Dein Depot liegt ${((perfBench - perfPortfolio) * 100).toFixed(1)} Prozentpunkte hinter dem ${benchLabel} (12 Monate, heutige Stückzahlen).`}
            </div>
          )}

          {/* Wertentwicklung + Allokation */}
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <div className="mb-1 text-sm font-semibold">Wertentwicklung (12M, indexiert)</div>
              <CompareChart
                a={series}
                b={benchTrimmed}
                labelA="Dein Depot"
                labelB={benchTrimmed ? benchLabel : null}
              />
            </div>
            <div className="rounded-2xl bg-card p-4 shadow-card">
              <div className="mb-1 text-sm font-semibold">Allokation</div>
              <div className="flex items-center justify-center">
                <Donut
                  segments={donutSegs}
                  size={170}
                  centerTop={abbrevMoney(total || null)}
                  centerBottom="Depotwert"
                />
              </div>
              <div className="mt-2 space-y-1">
                {donutSegs.map((s) => (
                  <div key={s.label} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate">{s.label}</span>
                    <span className="ml-auto font-medium text-subtle">
                      {total > 0 ? ((s.value / total) * 100).toFixed(1) : "0"} %
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <AllocationBar holdings={allocRows} />

          {/* Holdings table */}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">Positionen</h2>
            <div className="overflow-hidden rounded-2xl bg-card shadow-card">
              {sortedRows.map((r) => {
                const company = companyName(r.ticker, null);
                const w = r.value != null && total > 0 ? (r.value / total) * 100 : null;
                return (
                  <div
                    key={r.ticker}
                    className="flex items-center gap-3 border-b border-hair px-4 py-3 last:border-0"
                  >
                    <CompanyLogo ticker={r.ticker} company={company} size={38} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/stock/${r.ticker}`}
                        className="block truncate text-sm font-medium hover:text-brand"
                      >
                        {company}
                      </Link>
                      <div className="font-mono text-xs text-subtle">
                        {fixTicker(r.ticker, company)} · {r.shares.toLocaleString("de-DE")} St.
                        {r.last != null ? ` · ${price(r.last)}` : ""}
                        {r.buyPrice ? ` · Einstand ${price(r.buyPrice)}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {r.value != null ? abbrevMoney(r.value) : "keine Kursdaten"}
                      </div>
                      <div className="text-xs text-subtle">
                        {w != null ? `${w.toFixed(1)} %` : "—"}
                        {r.plPct != null && r.plAbs != null && (
                          <span className={r.plPct >= 0 ? "text-bull" : "text-bear"}>
                            {" "}
                            · {pct(r.plPct)} ({r.plAbs >= 0 ? "+" : "-"}
                            {abbrevMoney(Math.abs(r.plAbs))})
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeHolding(r.ticker)}
                      aria-label="Entfernen"
                      className="shrink-0 rounded-full px-1.5 text-slate-300 hover:text-bear"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            {noPriceCount > 0 && (
              <p className="text-[11px] text-subtle">
                Für {noPriceCount} {noPriceCount === 1 ? "Position" : "Positionen"} haben wir keine
                Kursdaten — wir führen Kurse für die US-Aktien, die von den verfolgten Investoren
                gehalten werden.
              </p>
            )}
          </section>

          {/* Investor match */}
          {matches && matches.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Welche Investoren dir ähneln
              </h2>
              <div className="overflow-hidden rounded-2xl bg-card shadow-card">
                {matches.map((m) => {
                  const uw = userWeightWith(m);
                  return (
                    <Link
                      key={m.slug}
                      href={`/investor/${m.slug}`}
                      className="flex items-center gap-3 border-b border-hair px-4 py-3 transition last:border-0 hover:bg-slate-50"
                    >
                      <Avatar name={m.person ?? m.fund} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{m.person ?? m.fund}</div>
                        <div className="truncate text-xs text-subtle">
                          {m.sharedCount} gemeinsame {m.sharedCount === 1 ? "Aktie" : "Aktien"}:{" "}
                          {m.sharedTickers.slice(0, 4).join(", ")}
                          {m.sharedTickers.length > 4 ? "…" : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">
                          {uw != null ? `${(uw * 100).toFixed(0)} %` : "—"}
                        </div>
                        <div className="text-xs text-subtle">deines Depots</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <p className="text-[11px] text-subtle">
                „% deines Depots“ = Anteil deines Depotwerts in Aktien, die dieser Investor
                ebenfalls hält.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}
