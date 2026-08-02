"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { AllocationBar } from "@/components/AllocationBar";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
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

interface PriceInfo {
  last: number | null;
  first: number | null;
}

function price(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return `$${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function MePage() {
  const [holdings, setHoldings] = useState<MyHolding[]>([]);
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const [spy, setSpy] = useState<PriceInfo | null>(null);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // sync with localStorage
  useEffect(() => {
    const sync = () => setHoldings(getMyHoldings());
    sync();
    window.addEventListener("mydepot", sync);
    return () => window.removeEventListener("mydepot", sync);
  }, []);

  // fetch prices for held tickers + SPY benchmark
  useEffect(() => {
    let on = true;
    const need = holdings.map((h) => h.ticker).filter((t) => !(t in prices));
    need.forEach((t) => {
      fetch(`/api/prices?ticker=${encodeURIComponent(t)}`)
        .then((r) => r.json() as Promise<PricesResponse>)
        .then((d) => {
          if (!on) return;
          const bars: PriceBar[] = d.source === "database" ? d.bars : [];
          setPrices((p) => ({
            ...p,
            [t]: {
              last: bars.length ? bars[bars.length - 1].close : null,
              first: bars.length ? bars[0].close : null,
            },
          }));
        })
        .catch(() => on && setPrices((p) => ({ ...p, [t]: { last: null, first: null } })));
    });
    if (!spy) {
      fetch(`/api/prices?ticker=SPY`)
        .then((r) => r.json() as Promise<PricesResponse>)
        .then((d) => {
          if (!on) return;
          const bars = d.source === "database" ? d.bars : [];
          setSpy({
            last: bars.length ? bars[bars.length - 1].close : null,
            first: bars.length ? bars[0].close : null,
          });
        })
        .catch(() => on && setSpy({ last: null, first: null }));
    }
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings]);

  // investor match
  useEffect(() => {
    if (holdings.length === 0) {
      setMatches(null);
      return;
    }
    let on = true;
    const ts = holdings.map((h) => h.ticker).join(",");
    fetch(`/api/match?tickers=${encodeURIComponent(ts)}`)
      .then((r) => r.json() as Promise<MatchResponse>)
      .then((d) => on && setMatches(d.rows))
      .catch(() => on && setMatches([]));
    return () => {
      on = false;
    };
  }, [holdings]);

  // derived rows
  const rows = useMemo(() => {
    return holdings.map((h) => {
      const p = prices[h.ticker];
      const value = p?.last != null ? h.shares * p.last : null;
      const perf12 = p?.last != null && p?.first ? (p.last - p.first) / p.first : null;
      const gain =
        p?.last != null && h.buyPrice ? (p.last - h.buyPrice) / h.buyPrice : null;
      return { ...h, last: p?.last ?? null, value, perf12, gain };
    });
  }, [holdings, prices]);

  const total = rows.reduce((a, r) => a + (r.value ?? 0), 0);
  const withValue = rows.filter((r) => r.value !== null);
  const perfPortfolio =
    total > 0
      ? withValue.reduce((a, r) => a + (r.perf12 ?? 0) * ((r.value ?? 0) / total), 0)
      : null;
  const perfSpy = spy?.last != null && spy?.first ? (spy.last - spy.first) / spy.first : null;
  const noPriceCount = rows.filter((r) => r.value === null).length;

  const allocRows: HoldingRow[] = withValue.map((r) => ({
    ticker: r.ticker,
    securityName: r.ticker,
    company: companyName(r.ticker, null),
    weight: total > 0 ? (r.value ?? 0) / total : null,
    value: r.value,
    shares: r.shares,
    putCall: null,
  }));

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
    if (!/^[A-Z][A-Z0-9.\-]{0,7}$/.test(t) || !Number.isFinite(s) || s <= 0) {
      setCsvMsg("Bitte gültigen Ticker (z. B. AAPL) und Stückzahl eingeben.");
      return;
    }
    upsertHolding({ ticker: t, shares: s });
    setTicker("");
    setShares("");
    setCsvMsg(null);
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
          Lade dein Portfolio hoch und vergleiche es mit den Star-Investoren und dem S&P 500.
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
          <form onSubmit={onAdd} className="flex items-center gap-2">
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
            <button className="rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
              + Hinzufügen
            </button>
          </form>
          {holdings.length > 0 && (
            <button
              onClick={() => clearHoldings()}
              className="ml-auto text-xs text-subtle underline hover:text-bear"
            >
              Alle löschen
            </button>
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
              <div className="text-lg font-semibold tracking-tight">{holdings.length}</div>
              <div className="mt-0.5 text-xs text-subtle">Positionen</div>
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
                  perfSpy == null ? "" : perfSpy >= 0 ? "text-bull" : "text-bear"
                }`}
              >
                {pct(perfSpy)}
              </div>
              <div className="mt-0.5 text-xs text-subtle">S&P 500 (12M)</div>
            </div>
          </div>

          {perfPortfolio != null && perfSpy != null && (
            <div
              className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                perfPortfolio >= perfSpy
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {perfPortfolio >= perfSpy
                ? `Dein Depot schlägt den S&P 500 um ${((perfPortfolio - perfSpy) * 100).toFixed(1)} Prozentpunkte (12 Monate, gewichtet).`
                : `Dein Depot liegt ${((perfSpy - perfPortfolio) * 100).toFixed(1)} Prozentpunkte hinter dem S&P 500 (12 Monate, gewichtet).`}
            </div>
          )}

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
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {r.value != null ? abbrevMoney(r.value) : "keine Kursdaten"}
                      </div>
                      <div className="text-xs text-subtle">
                        {w != null ? `${w.toFixed(1)} %` : "—"}
                        {r.gain != null && (
                          <span className={r.gain >= 0 ? "text-bull" : "text-bear"}>
                            {" "}
                            · {pct(r.gain)}
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
