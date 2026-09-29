"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CountUp } from "@/components/Donut";
import { CAT, OTHER } from "@/lib/palette";
import { ChartSeries, DepotChart, ReturnBars } from "@/components/DepotChart";
import { DivEntry, DividendChart, DividendSplit } from "@/components/DividendChart";
import { fetchMatches } from "@/lib/fetchMatches";
import { conversionFactor, convertHistory, dailyChange, fxSymbol } from "@/lib/valuation";
import { isStaleDate } from "@/lib/format";
import { LiveValue } from "@/components/LiveValue";
import { ChipBar } from "@/components/ui";
import { RiskPoint, RiskReturnMap } from "@/components/PerformancePanels";
import {
  CapitalFlow,
  ContributionBars,
  MonthHeatmap,
  ReturnTreemap,
  TreeItem,
} from "@/components/PerformanceViews";
import { AllocView, Collapse, Concentration, Insight, Kpi, KpiGrid, Pills, Segment } from "@/components/DepotPanels";
import { NBSP, companyName, fixTicker, formatDate, num, pct, pctOf, stockHref } from "@/lib/format";
import { fetchJson } from "@/lib/fetchJson";
import { ImportReport, importCsv, summarize } from "@/lib/brokers";
import {
  Resolution,
  getBadSymbols,
  getManualPrices,
  getResolveCache,
  getUserMap,
  priceMismatch,
  setManualPrice,
  isIsin,
  mergeResolveCache,
  resolveInstrument,
  setUserSymbol,
  SYMBOL_RE,
} from "@/lib/instruments";
import {
  cAbbrev,
  cMoney,
  cSigned,
  currencySymbol,
  loadCurrency,
  saveCurrency,
  setCurrency,
} from "@/lib/money";
import {
  Bar,
  KIND_LABEL,
  Txn,
  TxnKind,
  addTxn,
  addTxns,
  adjustForSplits,
  annualReturns,
  beta,
  buildSeries,
  cashFlows,
  clearTxns,
  correlation,
  dailyReturns,
  dayDiff,
  drawdownSeries,
  extremeDays,
  getTxns,
  hitRate,
  indexTo,
  makeTxn,
  maxDrawdown,
  monthlyReturns,
  parseDate,
  parseNum,
  positionsFrom,
  removeTicker,
  removeTxn,
  SeriesPoint,
  seriesReturn,
  shareDelta,
  sharpe,
  toCsv,
  twr,
  twrAnnualized,
  volatility,
  xirr,
} from "@/lib/portfolio";
import { type AssetMeta, classify } from "@/lib/sectors";
import { useAssetMeta } from "@/lib/useAssetMeta";
import { MatchResponse, MatchRow } from "@/lib/types";
import { useQuotes } from "@/lib/useQuotes";
import { Icon } from "@/components/Icon";

// ── Konfiguration ───────────────────────────────────────────────────────────

interface HistoryEntry {
  ticker: string;
  source: "yahoo" | "database" | "none";
  bars: Bar[];
  dividends: { date: string; amount: number }[];
  currency: string | null;
  name: string | null;
}

const BENCHMARKS = [
  { key: "SPY", label: "S&P 500" },
  { key: "QQQ", label: "Nasdaq 100" },
  { key: "URTH", label: "MSCI World" },
  { key: "DIA", label: "Dow Jones" },
  { key: "GLD", label: "Gold" },
  { key: "BTC-USD", label: "Bitcoin" },
] as const;

type RangeKey = "1M" | "3M" | "6M" | "YTD" | "1J" | "3J" | "Max";
const RANGES: readonly (readonly [RangeKey, string])[] = [
  ["1M", "1M"],
  ["3M", "3M"],
  ["6M", "6M"],
  ["YTD", "YTD"],
  ["1J", "1J"],
  ["3J", "3J"],
  ["Max", "Max"],
];

type Tab =
  | "overview"
  | "positions"
  | "performance"
  | "allocation"
  | "dividends"
  | "activity"
  | "investors";

const TABS: readonly (readonly [Tab, string])[] = [
  ["overview", "Übersicht"],
  ["positions", "Positionen"],
  ["performance", "Performance"],
  ["allocation", "Aufteilung"],
  ["dividends", "Dividenden"],
  ["activity", "Aktivitäten"],
  ["investors", "Investoren"],
];

type ChartMode = "value" | "return" | "drawdown";

type PerfView = "verlauf" | "positionen" | "risiko" | "kapital";
const PERF_VIEWS: readonly (readonly [PerfView, string])[] = [
  ["verlauf", "Verlauf"],
  ["positionen", "Positionen"],
  ["risiko", "Risiko"],
  ["kapital", "Kapital"],
];

// Fixed categorical order (lib/palette); positions past the eighth share the
// "Übrige" grey instead of reusing a hue.
const posColor = (i: number) => (i < CAT.length ? CAT[i] : OTHER);

// ── Hilfen ──────────────────────────────────────────────────────────────────

const usd = cMoney;
const abbrevMoney = cAbbrev;
const signed = cSigned;

const pct2 = (v: number | null): string => pctOf(v, 2);

const tone = (v: number | null): "bull" | "bear" | null =>
  v === null || Number.isNaN(v) ? null : v >= 0 ? "bull" : "bear";

function cutoffFor(range: RangeKey, series: { date: string }[]): string {
  if (series.length === 0) return "0000-00-00";
  const last = series[series.length - 1].date;
  if (range === "Max") return "0000-00-00";
  if (range === "YTD") return `${last.slice(0, 4)}-01-01`;
  const days: Record<string, number> = { "1M": 30, "3M": 91, "6M": 182, "1J": 365, "3J": 1095 };
  const d = new Date(last);
  d.setDate(d.getDate() - (days[range] ?? 365));
  return d.toISOString().slice(0, 10);
}

/** Kumulierte zeitgewichtete Rendite als Kurve (startet bei 0 %). */
function twrCurve(series: SeriesPoint[]) {
  const out = [{ date: series[0]?.date ?? "", value: 0 }];
  let f = 1;
  for (const { date, r } of dailyReturns(series)) {
    f *= 1 + r;
    out.push({ date, value: f - 1 });
  }
  return out.filter((p) => p.date);
}

function returnCurve(bars: Bar[]) {
  if (bars.length === 0 || bars[0].close === 0) return [];
  const base = bars[0].close;
  return bars.map((b) => ({ date: b.date, value: b.close / base - 1 }));
}

/** Gehaltene Stückzahl über die Zeit — einmal aufgebaut, dann günstig abfragbar. */
function sharesTimeline(txns: Txn[], ticker: string): { date: string; shares: number }[] {
  const evs = txns
    .filter((t) => t.ticker === ticker && shareDelta(t) !== 0)
    .sort((a, b) => (a.date || "0").localeCompare(b.date || "0") || (a.seq ?? 0) - (b.seq ?? 0));
  const out: { date: string; shares: number }[] = [];
  let s = 0;
  for (const e of evs) {
    s = Math.max(0, s + shareDelta(e));
    out.push({ date: e.date || "0000-00-00", shares: s });
  }
  return out;
}

/** Kleinstbestände aus Rundungsresten (z. B. 4·10⁻⁹ Bitcoin) sind keine Position. */
const DUST = 1e-9;

function sharesAt(tl: { date: string; shares: number }[], date: string): number {
  let s = 0;
  for (const e of tl) {
    if (e.date > date) break;
    s = e.shares;
  }
  return s;
}

// ── Seite ───────────────────────────────────────────────────────────────────

export default function MePage() {
  const [txns, setTxnsState] = useState<Txn[]>([]);
  const [hist, setHist] = useState<Record<string, HistoryEntry>>({});
  const [loadingHist, setLoadingHist] = useState(false);
  const [histFailed, setHistFailed] = useState(false);
  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<RangeKey>("1J");
  const [benchIdx, setBenchIdx] = useState(0);
  const [mode, setMode] = useState<ChartMode>("value");
  const [perfView, setPerfView] = useState<PerfView>("verlauf");
  const [msg, setMsg] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [currency, setCurrencyState] = useState("USD");
  const [mapTick, setMapTick] = useState(0);

  // ── Speicher-Sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    const sync = () => {
      setTxnsState(getTxns());
      setMapTick((t) => t + 1);
    };
    sync();
    setCurrencyState(loadCurrency());
    window.addEventListener("mydepot", sync);
    return () => window.removeEventListener("mydepot", sync);
  }, []);

  // Depotwährung gilt für die gesamte Seite.
  setCurrency(currency);
  const foreign = currency !== "USD";
  const fxPair = foreign ? `${currency}USD=X` : null;

  /** Schlüssel der Papiere = ISIN aus dem Export (oder Kürzel). */
  const keys = useMemo(
    () => [...new Set(txns.map((t) => t.ticker).filter(Boolean))],
    [txns],
  );

  /** Klarnamen und Anlageklassen aus den Buchungen ziehen. */
  const meta = useMemo(() => {
    const m = new Map<string, { name: string; assetClass: string }>();
    for (const t of txns) {
      if (!t.ticker) continue;
      const cur = m.get(t.ticker);
      if (!cur || (!cur.name && t.name)) {
        m.set(t.ticker, { name: t.name ?? cur?.name ?? "", assetClass: t.assetClass ?? cur?.assetClass ?? "" });
      }
    }
    return m;
  }, [txns]);

  /** ISIN → Börsenkürzel. Reihenfolge: eigene Zuordnung, Tabelle, Suche. */
  const resolutions = useMemo(() => {
    const userMap = getUserMap();
    const cache = getResolveCache();
    const bad = getBadSymbols();
    const out = new Map<string, Resolution>();
    for (const k of keys) {
      const m = meta.get(k);
      out.set(k, resolveInstrument(k, m?.name ?? null, m?.assetClass ?? null, userMap, cache, bad));
    }
    return out;
    // mapTick zwingt zur Neuberechnung, wenn der Nutzer etwas zuordnet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, meta, mapTick]);

  // Offene ISINs serverseitig nachschlagen.
  const [resolving, setResolving] = useState(false);
  const searched = useRef<Set<string>>(new Set());
  useEffect(() => {
    const open = keys.filter(
      (k) =>
        isIsin(k) &&
        !resolutions.get(k)?.symbol &&
        !resolutions.get(k)?.unpriceable &&
        !searched.current.has(k),
    );
    if (open.length === 0) return;
    // Jede ISIN wird höchstens einmal je Sitzung nachgeschlagen, sonst dreht
    // sich die Suche im Kreis, wenn sie dasselbe untaugliche Kürzel liefert.
    let on = true;
    setResolving(true);
    (async () => {
      const symbols: Record<string,string> = {};
      for (let i=0;i<open.length;i+=20) {
        const data = await fetchJson<{symbols:Record<string,string>}>(`/api/resolve?ids=${encodeURIComponent(open.slice(i,i+20).join(","))}`, {timeoutMs:25000,tries:1});
        if (!on) return {symbols};
        open.slice(i,i+20).forEach(k => searched.current.add(k));
        Object.assign(symbols,data.symbols);
      }
      return {symbols};
    })()
      .then((d) => {
        if (!on || !d.symbols) return;
        open.forEach(k => searched.current.add(k));
        mergeResolveCache(d.symbols);
        setMapTick((t) => t + 1);
      })
      .catch(() => {})
      .finally(() => on && setResolving(false));
    return () => {
      on = false;
    };
  }, [keys, resolutions]);

  const symbols = useMemo(
    () => [...new Set([...resolutions.values()].map((r) => r.symbol).filter((s): s is string => !!s))],
    [resolutions],
  );

  // ── Kurshistorie: eigene Papiere + Benchmarks + Wechselkurs ───────────────
  useEffect(() => {
    const pairs = Object.values(hist).map(e => fxSymbol(e.currency,currency)).filter((s): s is string => !!s);
    const want = [...symbols, ...BENCHMARKS.map((b) => b.key), ...pairs, ...(fxPair ? [fxPair] : [])];
    const need = [...new Set(want)].filter((t) => !(t in hist));
    if (need.length === 0) return;
    let on = true;
    setLoadingHist(true);
    (async () => {
      const entries: Record<string,HistoryEntry> = {};
      for (let i=0;i<need.length;i+=40) {
        const data = await fetchJson<{entries:Record<string,HistoryEntry>}>(`/api/history?tickers=${encodeURIComponent(need.slice(i,i+40).join(","))}&range=10y`, {timeoutMs:35000,tries:1});
        if (!on) return {entries};
        Object.assign(entries,data.entries);
      }
      return {entries};
    })()
      .then((d) => {
        if (!on) return;
        setHistFailed(false);
        setHist((p) => ({ ...p, ...d.entries }));
      })
      .catch(() => {
        if (!on) return;
        setHistFailed(true);
        setHist((p) => {
          const next = { ...p };
          for (const t of need)
            next[t] = { ticker: t, source: "none", bars: [], dividends: [], currency: null, name: null };
          return next;
        });
      })
      .finally(() => on && setLoadingHist(false));
    return () => {
      on = false;
    };
  }, [symbols, hist, fxPair, currency]);

  /** Wechselkursreihe Depotwährung → USD. */
  const fxBars = fxPair ? hist[fxPair]?.bars ?? null : null;

  /**
   * Alle Kursreihen einmalig in die Depotwährung umgerechnet.
   *
   * Vorher war das eine Funktion, die bei jedem Rendern für jede Serie ein
   * neues Array mit tausenden Objekten erzeugt hat — bei einem Depot mit 50
   * Papieren sind das über 100.000 Objekte pro Rendervorgang. Genau daran ist
   * der Browser erstickt. Jetzt wird nur noch nachgeschlagen.
   */
  const depotBars = useMemo(() => {
    const m = new Map<string, Bar[]>();
    for (const [sym, e] of Object.entries(hist)) {
      if (!e || !e.bars || e.bars.length === 0) continue;
      const pair = fxSymbol(e.currency,currency);
      m.set(sym, convertHistory(e.bars,e.currency,currency,pair ? hist[pair]?.bars : null));
    }
    return m;
  }, [hist, currency, fxBars]);

  const toDepot = useCallback((symbol: string): Bar[] => depotBars.get(symbol) ?? [], [depotBars]);

  const quotes = useQuotes(symbols);
  const listingMeta = useAssetMeta(symbols);

  // ── Investoren-Überschneidung ─────────────────────────────────────────────
  useEffect(() => {
    if (symbols.length === 0) {
      setMatches(null);
      return;
    }
    let on = true;
    fetchMatches(symbols)
      .then((rows) => on && setMatches(rows))
      .catch(() => on && setMatches([]));
    return () => {
      on = false;
    };
  }, [symbols]);

  // ── Abgeleitete Daten ─────────────────────────────────────────────────────

  /** Kursreihen je Papier-Schlüssel, bereits in der Depotwährung. */
  const barsByTicker = useMemo(() => {
    const out: Record<string, Bar[] | null> = {};
    for (const k of keys) {
      const sym = resolutions.get(k)?.symbol;
      const bars = sym ? toDepot(sym) : [];
      out[k] = bars.length > 1 ? bars : null;
    }
    return out;
  }, [keys, resolutions, toDepot]);

  /**
   * Bestände ohne Kaufdatum (Alt-Import) auf den ersten Tag der Reihe datieren
   * und, falls kein Kaufpreis bekannt ist, mit dem Schlusskurs dieses Tages
   * bewerten. Erst dadurch stimmen zugeführtes Kapital und IZF.
   */
  const normTxns = useMemo(() => {
    const undated = txns.filter((t) => !t.date);
    if (undated.length === 0) return adjustForSplits(txns);
    const probe = buildSeries(txns, barsByTicker);
    const d0 = probe[0]?.date;
    if (!d0) return txns;
    return adjustForSplits(
      txns.map((t) => {
        if (t.date) return t;
        let price = t.price;
        if (!price && t.ticker) {
          const bars = barsByTicker[t.ticker];
          const b = bars?.find((x) => x.date >= d0) ?? bars?.[0];
          price = b?.close ?? 0;
        }
        return { ...t, date: d0, price };
      }),
    );
  }, [txns, barsByTicker]);

  const positions = useMemo(() => positionsFrom(normTxns), [normTxns]);
  const openPositions = useMemo(() => positions.filter((p) => p.shares > DUST), [positions]);
  const assumedCount = txns.filter((t) => !t.date).length;

  const series = useMemo(() => buildSeries(normTxns, barsByTicker), [normTxns, barsByTicker]);

  /** Alle offenen Positionen samt Auflösung, Live-Kurs und Plausibilitätsprüfung. */
  const allRows = useMemo(() => {
    const manual = getManualPrices();
    const today = new Date().toISOString().slice(0, 10);
    return openPositions.map((p) => {
      const res = resolutions.get(p.ticker);
      const symbol = res?.symbol ?? null;
      const manualPrice = manual[p.ticker] ?? null;
      const q = symbol ? quotes[symbol.toUpperCase()] : undefined;
      const bars = barsByTicker[p.ticker];
      const eod = bars?.length && !isStaleDate(bars[bars.length - 1].date) ? bars[bars.length - 1].close : null;
      // Live-Kurs notiert in der Kurswährung — in die Depotwährung umrechnen.
      const pair = fxSymbol(q?.currency,currency);
      const factor = conversionFactor(q?.currency,currency,pair ? hist[pair]?.bars : null,today);
      const live = q && factor !== null ? q.price * factor : null;
      const last = manualPrice ?? live ?? eod;
      const value = last != null ? p.shares * last : null;
      // Passt der Kurs überhaupt zum Einstand? Eine falsch aufgelöste ISIN
      // erzeugt sonst lautlos eine Rendite von mehreren hundert Prozent.
      const heldYears = p.firstDate ? Math.max(0.2, dayDiff(p.firstDate, today) / 365.25) : 1;
      const mismatch = manualPrice ? null : priceMismatch(p.avgPrice, last, heldYears);
      const unreal = value != null ? value - p.costBasis : null;
      const unrealPct = value != null && p.costBasis > 0 ? value / p.costBasis - 1 : null;
      const dayPct = !manualPrice && live !== null ? q?.changePct ?? null : null;
      const dayAbs = !manualPrice && q && live !== null ? dailyChange(p.shares,q.price,q.prevClose,factor) : null;
      const totalGain = (unreal ?? 0) + p.realized + p.dividends;
      const m = meta.get(p.ticker);
      const company =
        m?.name && m.name !== p.ticker
          ? m.name
          : companyName(symbol, (symbol && hist[symbol]?.name) || null);
      return {
        ...p,
        symbol,
        resolution: res ?? null,
        manualPrice,
        mismatch,
        last,
        value,
        unreal,
        unrealPct,
        dayPct,
        dayAbs,
        totalGain,
        company,
        assetClass: m?.assetClass ?? "",
        live: live !== null && !manualPrice,
      };
    });
  }, [openPositions, quotes, barsByTicker, hist, resolutions, meta, currency]);

  /** Bewertbar = Kurs vorhanden. Der Rest darf die Kennzahlen nicht verfälschen. */
  // Restbestände unter einem halben Euro sind Rundungsreste aus Teilverkäufen
  // und würden die Prozentwerte nur verzerren.
  const DUST_VALUE = 0.5;
  const rows = useMemo(
    () => allRows.filter((r) => r.value !== null && Math.abs(r.value) >= DUST_VALUE),
    [allRows],
  );
  const dustRows = useMemo(
    () => allRows.filter((r) => r.value !== null && Math.abs(r.value) < DUST_VALUE),
    [allRows],
  );
  const openIssues = useMemo(() => allRows.filter((r) => r.value === null), [allRows]);

  const total = rows.reduce((a, r) => a + (r.value ?? 0), 0);
  const costTotal = rows.reduce((a, r) => a + r.costBasis, 0);
  const unrealTotal = total - costTotal;
  const realizedTotal = positions.reduce((a, p) => a + p.realized, 0);
  const feesTotal = positions.reduce((a, p) => a + p.fees, 0);
  const noPrice = openIssues.length;
  // No position priced yet: while prices load (or the price service is
  // down) the figures would all read $0,00. Show that state instead.
  const pricesPending = txns.length > 0 && rows.length === 0 && openIssues.length > 0 && (loadingHist || histFailed || Object.keys(hist).length === 0);
  const retryPrices = () => {
    searched.current.clear();
    setHistFailed(false);
    setHist((current) => Object.fromEntries(Object.entries(current).filter(([, e]) => e.source !== "none")));
    setMapTick((t) => t + 1);
  };

  /** Hat der Export echte Ein- und Auszahlungen? Dann ist das die bessere Bezugsgröße. */
  const hasCashFlows = useMemo(
    () => txns.some((t) => t.kind === "deposit" || t.kind === "withdrawal"),
    [txns],
  );
  const depositedNet = series.length ? series[series.length - 1].deposited : 0;

  const dayAbsSum = rows.reduce((a, r) => a + (r.dayAbs ?? 0), 0);
  const dayBase = rows.reduce((a, r) => a + (r.value ?? 0) - (r.dayAbs ?? 0), 0);
  const dayPctSum = dayBase > 0 && rows.some((r) => r.dayAbs !== null) ? dayAbsSum / dayBase : null;
  const liveCount = rows.filter((r) => r.live).length;

  // ── Dividenden aus der Ausschüttungshistorie rekonstruieren ───────────────
  const divInfo = useMemo(() => {
    const byTicker = new Map<string, number>();
    const byMonth = new Map<string, number>();
    const upcoming: { ticker: string; date: string; amount: number }[] = [];
    let received = 0;
    const today = new Date().toISOString().slice(0, 10);
    const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
    const perShareYear = new Map<string, number>();

    for (const t of keys) {
      const sym = resolutions.get(t)?.symbol;
      const evs = sym ? hist[sym]?.dividends ?? [] : [];
      if (evs.length === 0) continue;
      const divCur = sym ? hist[sym]?.currency : null;
      const divPair = fxSymbol(divCur,currency);
      const tl = sharesTimeline(normTxns, t);
      let sum = 0;
      let psYear = 0;
      for (const raw of evs) {
        const conv = conversionFactor(divCur,currency,divPair ? hist[divPair]?.bars : null,raw.date);
        if (conv === null) continue;
        const e = { date: raw.date, amount: raw.amount * conv };
        if (e.date > today) {
          upcoming.push({ ticker: t, date: e.date, amount: e.amount });
          continue;
        }
        if (e.date >= yearAgo) psYear += e.amount;
        const sh = sharesAt(tl, e.date);
        if (sh <= 0) continue;
        const amt = sh * e.amount;
        sum += amt;
        byMonth.set(e.date.slice(0, 7), (byMonth.get(e.date.slice(0, 7)) ?? 0) + amt);
      }
      if (sum > 0) byTicker.set(t, sum);
      if (psYear > 0) perShareYear.set(t, psYear);
      received += sum;
    }

    // Erwartete Ausschüttung der nächsten 12 Monate = Rate der letzten 12 Monate
    // × heutige Stückzahl.
    let forecast = 0;
    let costBase = 0;
    const perPos = rows
      .map((r) => {
        const ps = perShareYear.get(r.ticker) ?? 0;
        const annual = ps * r.shares;
        forecast += annual;
        if (ps > 0) costBase += r.costBasis;
        return {
          ticker: r.ticker,
          symbol: r.symbol,
          company: r.company,
          received: byTicker.get(r.ticker) ?? 0,
          perShare: ps,
          annual,
          yieldNow: r.last && r.last > 0 ? ps / r.last : null,
          yieldOnCost: r.avgPrice && r.avgPrice > 0 ? ps / r.avgPrice : null,
          value: r.value,
        };
      })
      .filter((x) => x.annual > 0 || x.received > 0)
      .sort((a, b) => b.annual - a.annual);

    return {
      received,
      forecast,
      perPos,
      byMonth,
      upcoming: upcoming.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
      yieldNow: total > 0 ? forecast / total : null,
      yieldOnCost: costBase > 0 ? forecast / costBase : null,
    };
  }, [keys, resolutions, hist, normTxns, rows, total, currency]);

  // Aus dem Broker importierte Dividenden sind die Wahrheit; die Rekonstruktion
  // aus der Ausschüttungshistorie ist nur der Ersatz, wenn nichts importiert wurde.
  const bookedDividends = positions.reduce((a, p) => a + p.dividends, 0);
  const dividendsBooked = bookedDividends > 0;
  const dividendsTotal = dividendsBooked ? bookedDividends : divInfo.received;
  const gainTotal = unrealTotal + realizedTotal + dividendsTotal;
  // Bezugsgröße für die Gesamtrendite: was wirklich eingesetzt wurde.
  const gainBase = hasCashFlows && depositedNet > 0 ? depositedNet : costTotal;

  /** Schwankung je Position — Grundlage für die Risiko-Ertrags-Karte. */
  const riskPoints: RiskPoint[] = useMemo(() => {
    return rows
      .map((r, i) => {
        const bars = barsByTicker[r.ticker];
        if (!bars || bars.length < 40 || r.unrealPct === null) return null;
        const slice = bars.slice(-252);
        const rets: number[] = [];
        for (let j = 1; j < slice.length; j++) {
          const p0 = slice[j - 1].close;
          if (p0 > 0) rets.push(slice[j].close / p0 - 1);
        }
        if (rets.length < 30) return null;
        const m = rets.reduce((a, x) => a + x, 0) / rets.length;
        const v = rets.reduce((a, x) => a + (x - m) ** 2, 0) / (rets.length - 1);
        return {
          ticker: r.ticker,
          name: r.company,
          vol: Math.sqrt(v) * Math.sqrt(252),
          ret: r.unrealPct,
          weight: total > 0 ? (r.value ?? 0) / total : 0,
          color: posColor(i),
        } as RiskPoint;
      })
      .filter((p): p is RiskPoint => p !== null);
  }, [rows, barsByTicker, total]);

  /**
   * Einzelne Ausschüttungen für die interaktive Grafik: Monat, Papier, Betrag.
   * Bevorzugt aus den importierten Buchungen — die sind exakt und netto. Nur
   * wenn keine vorliegen, wird aus der Ausschüttungshistorie rekonstruiert.
   */
  const divEntries: DivEntry[] = useMemo(() => {
    const nameOf = (t: string) => meta.get(t)?.name || t;
    const booked = normTxns.filter((t) => t.kind === "dividend" && t.date && t.amount > 0);
    if (booked.length > 0) {
      return booked.map((t) => ({
        month: t.date.slice(0, 7),
        ticker: t.ticker,
        name: nameOf(t.ticker),
        amount: t.amount,
      }));
    }
    const out: DivEntry[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const k of keys) {
      const sym = resolutions.get(k)?.symbol;
      const evs = sym ? hist[sym]?.dividends ?? [] : [];
      if (evs.length === 0) continue;
      const divCur = sym ? hist[sym]?.currency : null;
      const divPair = fxSymbol(divCur,currency);
      const tl = sharesTimeline(normTxns, k);
      for (const e of evs) {
        if (e.date > today) continue;
        const conv = conversionFactor(divCur,currency,divPair ? hist[divPair]?.bars : null,e.date);
        if (conv === null) continue;
        const sh = sharesAt(tl, e.date);
        if (sh <= 0) continue;
        out.push({
          month: e.date.slice(0, 7),
          ticker: k,
          name: nameOf(k),
          amount: sh * e.amount * conv,
        });
      }
    }
    return out;
  }, [normTxns, keys, resolutions, hist, meta, currency]);

  /**
   * Dividenden je Papier — auch für längst verkaufte Positionen. Die
   * Positionsliste zeigt nur offene Werte; die Dividenden davor gehören
   * trotzdem in die Auswertung.
   */
  const dividendsByTicker = useMemo(() => {
    const m = new Map<string, { name: string; amount: number; open: boolean }>();
    for (const p of positions) {
      if (p.dividends <= 0) continue;
      m.set(p.ticker, {
        name: meta.get(p.ticker)?.name || p.ticker,
        amount: p.dividends,
        open: p.shares > DUST,
      });
    }
    return [...m.entries()]
      .map(([ticker, v]) => ({ ticker, ...v }))
      .sort((a, b) => b.amount - a.amount);
  }, [positions, meta]);

  // ── Zeitraum-Zuschnitt + Live-Endpunkt ────────────────────────────────────
  const seriesR = useMemo(() => {
    const cut = cutoffFor(range, series);
    const s = series.filter((p) => p.date >= cut);
    return s.length > 2 ? s : series;
    // Bewusst OHNE den Live-Depotwert am Ende: die Zeitreihe bleibt auf
    // Schlusskursen. Sonst entsteht am letzten Tag ein Sprung zwischen zwei
    // unterschiedlichen Bewertungsquellen — und der taucht dann als
    // "bester Tag +15 %" in den Kennzahlen auf.
  }, [series, range]);

  const bench = BENCHMARKS[benchIdx];
  const benchBarsFull = toDepot(bench.key);
  const benchR = useMemo(() => {
    if (benchBarsFull.length === 0 || seriesR.length < 2) return [];
    return benchBarsFull.filter((b) => b.date >= seriesR[0].date && b.date <= seriesR[seriesR.length - 1].date);
  }, [benchBarsFull, seriesR]);

  const perfPortfolio = twr(seriesR);
  const perfBench = seriesReturn(benchR);
  const perfAnnual = twrAnnualized(seriesR);
  const izf = useMemo(() => {
    if (seriesR.length < 2 || total <= 0) return null;
    const start = seriesR[0].date;
    const startValue = seriesR[0].value;
    const flows = cashFlows(normTxns, start).filter((f) => f.date >= start);
    const all = [
      ...(startValue > 0 ? [{ date: start, amount: -startValue }] : []),
      ...flows,
      { date: seriesR[seriesR.length - 1].date, amount: total },
    ];
    return xirr(all);
  }, [seriesR, normTxns, total]);

  const vol = volatility(seriesR);
  const shp = sharpe(seriesR);
  const mdd = maxDrawdown(seriesR);
  const bta = benchR.length > 20 ? beta(seriesR, benchR) : null;
  const corr = benchR.length > 20 ? correlation(seriesR, benchR) : null;
  const hit = hitRate(seriesR);
  const ext = extremeDays(seriesR);
  const years = annualReturns(series);
  const monthsAll = useMemo(() => monthlyReturns(series), [series]);

  /** Kacheln der Depot-Landkarte: Fläche = Wert, Farbe = Rendite. */
  const treeItems: TreeItem[] = useMemo(
    () =>
      rows
        .filter((r) => r.value !== null)
        .map((r) => ({
          key: r.ticker,
          label: r.company,
          value: r.value as number,
          ret: r.unrealPct,
          gain: r.unreal ?? 0,
        })),
    [rows],
  );

  /** Beitrag zum Gesamtgewinn — offene Positionen und realisierte Verkäufe. */
  const contribItems = useMemo(() => {
    const m = new Map<string, { label: string; gain: number }>();
    for (const p of positions) {
      const g = p.realized + p.dividends;
      const open = rows.find((r) => r.ticker === p.ticker);
      const total = g + (open?.unreal ?? 0);
      if (Math.abs(total) < 0.01) continue;
      m.set(p.ticker, { label: meta.get(p.ticker)?.name || p.ticker, gain: total });
    }
    return [...m.entries()].map(([key, v]) => ({ key, ...v }));
  }, [positions, rows, meta]);

  /** Ein- und Auszahlungen je Monat für den Kapitalfluss. */
  const capitalFlows = useMemo(() => {
    const m = new Map<string, { in: number; out: number }>();
    for (const t of normTxns) {
      if (!t.date) continue;
      const key = t.date.slice(0, 7);
      const cur = m.get(key) ?? { in: 0, out: 0 };
      if (t.kind === "deposit") cur.in += t.amount;
      else if (t.kind === "withdrawal") cur.out += t.amount;
      else continue;
      m.set(key, cur);
    }
    if (m.size === 0) return [];
    // Lückenlose Monatsreihe, damit Pausen sichtbar bleiben.
    const keysSorted = [...m.keys()].sort();
    const out: { month: string; in: number; out: number }[] = [];
    const [y0, m0] = keysSorted[0].split("-").map(Number);
    const [y1, m1] = keysSorted[keysSorted.length - 1].split("-").map(Number);
    for (let y = y0, mo = m0; y < y1 || (y === y1 && mo <= m1); ) {
      const k = `${y}-${String(mo).padStart(2, "0")}`;
      out.push({ month: k, in: m.get(k)?.in ?? 0, out: m.get(k)?.out ?? 0 });
      mo++;
      if (mo > 12) {
        mo = 1;
        y++;
      }
    }
    return out;
  }, [normTxns]);

  // ── Chartserien ───────────────────────────────────────────────────────────
  // The depot line wears the colour of its result over the chosen range, like
  // a stock chart: emerald when it gained, rose when it lost.
  const lineColor = perfPortfolio != null && perfPortfolio < 0 ? "rgb(var(--bear-fill))" : "rgb(var(--bull-fill))";
  const chartSeries: ChartSeries[] = useMemo(() => {
    if (seriesR.length < 2) return [];
    if (mode === "drawdown") {
      return [
        {
          key: "dd",
          label: "Rückgang vom Hoch",
          color: "rgb(var(--bear-fill))",
          fill: true,
          points: drawdownSeries(seriesR).map((p) => ({ date: p.date, value: p.dd })),
        },
      ];
    }
    if (mode === "return") {
      const out: ChartSeries[] = [
        {
          key: "twr",
          label: "Dein Depot",
          color: lineColor,
          fill: true,
          points: twrCurve(seriesR),
        },
      ];
      if (benchR.length > 1) {
        out.push({
          key: "bench",
          label: bench.label,
          color: "rgb(var(--subtle))",
          dashed: true,
          points: returnCurve(benchR),
        });
      }
      return out;
    }
    const out: ChartSeries[] = [
      {
        key: "value",
        label: "Depotwert",
        color: lineColor,
        fill: true,
        points: seriesR.map((p) => ({ date: p.date, value: p.value })),
      },
      {
        key: "invested",
        label: hasCashFlows ? "Netto eingezahlt" : "In Wertpapieren gebunden",
        color: "rgb(var(--n-400))",
        step: true,
        points: seriesR.map((p) => ({
          date: p.date,
          value: hasCashFlows ? p.deposited : p.invested,
        })),
      },
    ];
    if (benchR.length > 1 && seriesR[0].value > 0) {
      out.push({
        key: "bench",
        label: `${bench.label} (gleicher Einsatz)`,
        color: "rgb(var(--n-400))",
        dashed: true,
        points: indexTo(benchR, seriesR[0].value).map((b) => ({ date: b.date, value: b.close })),
      });
    }
    return out;
  }, [seriesR, benchR, mode, bench.label, hasCashFlows, lineColor]);

  // ── Aufteilungen ──────────────────────────────────────────────────────────
  // Sector, region and class from the curated list, the fund's name, the
  // ISIN's country and Yahoo's sector for everything else.
  const classOf = (r: Row): AssetMeta =>
    classify({
      symbol: r.symbol,
      isin: isIsin(r.ticker) ? r.ticker : null,
      name: r.company,
      assetClass: r.assetClass,
      meta: r.symbol ? listingMeta[r.symbol.toUpperCase()] : null,
    });
  // Groups take the categorical palette by size, like positions do. Fixed
  // hex colours per sector used to include near-black, which vanished on the
  // dark card ("Technologie", "USA", "Aktie").
  const groupSegs = (pick: (m: AssetMeta) => string): Segment[] => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.value === null) continue;
      const k = pick(classOf(r));
      m.set(k, (m.get(k) ?? 0) + r.value);
    }
    let i = 0;
    return [...m.entries()]
      .sort((a, b) => (a[0] === "Sonstige" ? 1 : b[0] === "Sonstige" ? -1 : b[1] - a[1]))
      .map(([label, value]) => ({
        label,
        value,
        color: label === "Sonstige" ? OTHER : CAT[i++] ?? OTHER,
      }));
  };

  const posSegs: Segment[] = rows
    .filter((r) => r.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .map((r, i) => ({ label: r.company, value: r.value as number, color: posColor(i) }));

  const weights = posSegs.map((s) => s.value / (total || 1));

  // ── Aktionen ──────────────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importCsv(String(reader.result || ""));
      if (res.txns.length === 0) {
        setReport(null);
        setMsg(
          "Keine verwertbaren Buchungen gefunden. Einfachster Fall: eine Zeile pro Position, z. B. AAPL,10,180",
        );
        return;
      }
      // Ein zweiter Import derselben Datei würde jede Position verdoppeln.
      if (txns.length > 0) {
        const replace = confirm(
          `Es sind bereits ${txns.length} Buchungen gespeichert.\n\n` +
            "OK = ersetzen (empfohlen bei einem vollständigen Broker-Export)\n" +
            "Abbrechen = die neuen Buchungen zusätzlich hinzufügen",
        );
        if (replace) clearTxns();
      }
      addTxns(res.txns);
      setReport(res);
      setMsg(null);
      saveCurrency(res.currency);
      setCurrencyState(res.currency);
      setTab("positions");
    };
    reader.readAsText(f);
  };


  const exportCsv = () => {
    const blob = new Blob([toCsv(txns)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aura-depot.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const empty = txns.length === 0;

  return (
    <div className="space-y-6">
      {/* Kopf */}
      <div className="fade-up space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="large-title">Mein Depot</h1>
          {liveCount > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-bull/10 px-2.5 py-1 text-[12px] font-medium text-bull">
              <span className="animate-live h-1.5 w-1.5 rounded-full bg-bull-fill" />
              Live-Kurse
            </span>
          )}
        </div>
        {!empty && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {pricesPending ? (
              <span aria-label="Depotwert wird geladen" className="inline-block h-9 w-52 animate-pulse rounded-xl bg-surface2 sm:h-12" />
            ) : (
              <LiveValue value={total} format={(v) => cMoney(v)} className="num-xl sm:text-5xl" />
            )}
            {dayPctSum != null && (
              <span className={`text-[15px] font-semibold tabular-nums ${dayPctSum >= 0 ? "text-bull" : "text-bear"}`}>
                {dayAbsSum >= 0 ? "▲ +" : "▼ −"}
                {cMoney(Math.abs(dayAbsSum))} ({pct2(dayPctSum)}) heute
              </span>
            )}
          </div>
        )}
        {empty && (
          <p className="max-w-xl text-[15px] leading-snug text-subtle">
            Lade dein Portfolio hoch und vergleiche es mit den Star-Investoren und dem Markt.
            Gespeichert wird nur lokal in deinem Browser.
          </p>
        )}
        {!empty && <ChipBar items={TABS.map(([key, label]) => ({ key, label }))} value={tab} onChange={setTab} label="Depotbereiche" className="!mt-4" />}
      </div>

      {empty && <EmptyState onPick={() => fileRef.current?.click()} />}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {msg && (
        <div className="rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-medium text-ink">
          {msg}
        </div>
      )}

      {report && <ImportSummary report={report} onClose={() => setReport(null)} />}

      {pricesPending && (
        histFailed && !loadingHist ? (
          <div role="alert" className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="icon-ring h-12 w-12"><Icon name="danger" className="h-6 w-6 text-subtle" /></span>
            <div className="text-[17px] font-semibold">Kurse gerade nicht erreichbar</div>
            <p className="max-w-sm text-[15px] leading-snug text-subtle">Deine Buchungen sind sicher gespeichert. Ohne Kurse lässt sich das Depot nur nicht bewerten.</p>
            <button type="button" onClick={retryPrices} className="btn-primary mt-1">Erneut versuchen</button>
          </div>
        ) : (
          <div className="card flex items-center justify-center gap-3 p-8 text-[15px] text-subtle">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-subtle/30 border-t-subtle" aria-hidden="true" />
            Kurse werden geladen …
          </div>
        )
      )}

      {!empty && !pricesPending && (
        <>
          {/* ── Übersicht ───────────────────────────────────────────────── */}
          {tab === "overview" && (
            <>
              <KpiGrid
                items={[
                  {
                    label: "Gewinn gesamt",
                    value: signed(gainTotal),
                    tone: tone(gainTotal),
                    sub: gainBase > 0 ? `${pct2(gainTotal / gainBase)} auf ${cAbbrev(gainBase)}` : undefined,
                    hint: `Kursgewinn der offenen Positionen + realisierte Gewinne + Dividenden, bezogen auf ${hasCashFlows ? "das eingezahlte Geld" : "den Einstand"}`,
                  },
                  { label: "Kursgewinn offen", value: signed(unrealTotal), tone: tone(unrealTotal), sub: costTotal > 0 ? pct2(unrealTotal / costTotal) : undefined },
                  { label: "Investiert", value: abbrevMoney(costTotal || null), sub: `${rows.length} ${rows.length === 1 ? "Position" : "Positionen"}` },
                  { label: "Dividenden", value: abbrevMoney(dividendsTotal || null), tone: dividendsTotal > 0 ? "bull" : null, sub: dividendsBooked ? "laut Buchungen" : "geschätzt" },
                  { label: "Realisiert", value: signed(realizedTotal), tone: realizedTotal === 0 ? null : tone(realizedTotal), sub: "aus Verkäufen" },
                  { label: "Depotwert", value: abbrevMoney(total || null), sub: liveCount > 0 ? "mit Live-Kursen" : "letzte Schlusskurse" },
                ]}
              />

              <ChartCard
                mode={mode}
                setMode={setMode}
                range={range}
                setRange={setRange}
                benchIdx={benchIdx}
                setBenchIdx={setBenchIdx}
                chartSeries={chartSeries}
              />

              {perfPortfolio != null && perfBench != null && (
                <Insight
                  tone={perfPortfolio >= perfBench ? "bull" : "bear"}
                  title={
                    perfPortfolio >= perfBench
                      ? `${num((perfPortfolio - perfBench) * 100)} Prozentpunkte vor dem ${bench.label}`
                      : `${num((perfBench - perfPortfolio) * 100)} Prozentpunkte hinter dem ${bench.label}`
                  }
                  text={`Zeitraum ${range}: dein Depot ${pct(perfPortfolio)}, Index ${pct(perfBench)}. Zeitgewichtet, Ein- und Auszahlungen herausgerechnet.`}
                />
              )}

              <TopMovers rows={rows} loading={liveCount === 0} />

              <div className="grid gap-4 lg:grid-cols-2">
                <AllocView segments={posSegs} total={total} title="Aufteilung nach Position" />
                <AllocView
                  segments={groupSegs((m) => m.sector)}
                  total={total}
                  title="Aufteilung nach Sektor"
                 
                />
              </div>

              {assumedCount > 0 && <AssumedHint n={assumedCount} onGo={() => setTab("activity")} />}
              {noPrice > 0 && (
                <button
                  onClick={() => setTab("positions")}
                  className="press-sm w-full rounded-xl bg-slate-50 px-4 py-3 text-left text-sm text-subtle hover:bg-slate-100"
                >
                  <span className="font-semibold text-ink">
                    {noPrice} {noPrice === 1 ? "Position ohne Kurs" : "Positionen ohne Kurs"}
                  </span>{" "}
                  — Optionsscheine und Privatmarkt-Anteile. Kurs eintragen und mitzählen lassen <Icon name="chevronRight" className="inline h-4 w-4 align-[-3px]" />
                </button>
              )}
            </>
          )}

          {/* ── Positionen ──────────────────────────────────────────────── */}
          {tab === "positions" && (
            <>
              <PositionsTable rows={rows} total={total} onRemove={(t) => removeTicker(t)} />
              {openIssues.length > 0 && (
                <UnpricedPanel rows={openIssues} resolving={resolving} onRemove={(t) => removeTicker(t)} />
              )}
              {dustRows.length > 0 && (
                <p className="text-[11px] text-subtle">
                  {dustRows.length}{" "}
                  {dustRows.length === 1 ? "Restbestand" : "Restbestände"} unter {cAbbrev(0.5)} (
                  {dustRows.map((r) => r.company).join(", ")}) werden ausgeblendet — das sind
                  Rundungsreste aus Teilverkäufen, die die Prozentwerte sonst verzerren.
                </p>
              )}
            </>
          )}

          {/* ── Performance ─────────────────────────────────────────────── */}
          {tab === "performance" && (
            <>
              {/* Kopf: die drei Renditezahlen, die wirklich zählen */}
              <div className="space-y-2">
                <Pills label="Performance-Ansicht" options={PERF_VIEWS} value={perfView} onChange={setPerfView} />
                <div className="flex flex-wrap items-center gap-2">
                  <Pills label="Zeitraum" options={RANGES} value={range} onChange={setRange} size="sm" />
                  <BenchSelect value={benchIdx} onChange={setBenchIdx} />
                </div>
              </div>
              <div className="lcard grid overflow-hidden sm:grid-cols-3">
                <BigStat
                  label="Zeitgewichtet"
                  value={perfPortfolio}
                  sub="Wie gut deine Auswahl war — unabhängig davon, wann du eingezahlt hast."
                />
                <BigStat
                  label="Geldgewichtet (IZF)"
                  value={izf}
                  sub="Was dein Geld tatsächlich verdient hat, inklusive Timing der Einzahlungen."
                  divider
                />
                <BigStat
                  label={bench.label}
                  value={perfBench}
                  sub={
                    perfPortfolio != null && perfBench != null
                      ? `Du liegst ${num(Math.abs((perfPortfolio - perfBench) * 100))} Prozentpunkte ${
                          perfPortfolio >= perfBench ? "davor" : "dahinter"
                        }.`
                      : "Gleicher Zeitraum, reine Kursentwicklung."
                  }
                  muted
                  divider
                />
              </div>

              {/* ── Verlauf ─────────────────────────────────────────────── */}
              {perfView === "verlauf" && (
                <>
                  <div className="lcard p-4 sm:p-5">
                    <div className="mb-0.5 text-[15px] font-semibold">Monatsrenditen</div>
                    <p className="mb-3 text-[12px] text-subtle">
                      Jede Kachel ein Monat, jede Zeile ein Jahr.
                    </p>
                    <MonthHeatmap months={monthsAll} years={years} />
                  </div>

                  <div className="lcard p-5">
                    <div className="mb-1 text-sm font-semibold">Rendite je Kalenderjahr</div>
                    <p className="mb-3 text-[11px] text-subtle">
                      Zeitgewichtet — Einzahlungen verfälschen die Zahlen nicht.
                    </p>
                    <ReturnBars data={years} />
                  </div>

                  <BenchmarkTable barsOf={toDepot} seriesR={seriesR} perfPortfolio={perfPortfolio} />
                </>
              )}

              {/* ── Positionen ──────────────────────────────────────────── */}
              {perfView === "positionen" && (
                <>
                  <div className="lcard p-5">
                    <div className="mb-1 text-sm font-semibold">Landkarte deines Depots</div>
                    <p className="mb-3 text-[11px] text-subtle">
                      Fläche = Anteil am Depot, Farbe = Rendite. Große rote Kacheln kosten am
                      meisten.
                    </p>
                    <ReturnTreemap items={treeItems} />
                  </div>

                  <div className="lcard p-5">
                    <div className="mb-1 text-sm font-semibold">Wer den Gewinn gemacht hat</div>
                    <ContributionBars items={contribItems} />
                  </div>
                </>
              )}

              {/* ── Risiko ──────────────────────────────────────────────── */}
              {perfView === "risiko" && (
                <>
                  <RiskReturnMap points={riskPoints} />

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    <Kpi label="Rendite p. a." value={pct(perfAnnual)} tone={tone(perfAnnual)} />
                    <Kpi
                      label="Volatilität p. a."
                      value={pctOf(vol, 1, false)}
                      hint="Schwankungsbreite der Tagesrenditen"
                    />
                    <Kpi
                      label="Sharpe Ratio"
                      value={shp === null ? "—" : num(shp, 2)}
                      tone={shp === null ? null : shp >= 1 ? "bull" : shp < 0 ? "bear" : null}
                      sub={
                        shp === null
                          ? undefined
                          : shp >= 1
                          ? "gutes Verhältnis"
                          : shp >= 0.5
                          ? "solide"
                          : "viel Risiko je Rendite"
                      }
                    />
                    <Kpi
                      label="Max. Drawdown"
                      value={mdd ? pctOf(mdd.dd, 1, false) : "—"}
                      tone={mdd ? "bear" : null}
                      sub={mdd ? `Tief am ${formatDate(mdd.date)}` : undefined}
                    />
                    <Kpi
                      label={`Beta zu ${bench.label}`}
                      value={bta === null ? "—" : num(bta, 2)}
                      sub={
                        bta === null
                          ? undefined
                          : bta > 1.15
                          ? "schwankt stärker als der Index"
                          : bta < 0.85
                          ? "ruhiger als der Index"
                          : "läuft wie der Index"
                      }
                    />
                    <Kpi
                      label="Korrelation"
                      value={corr === null ? "—" : num(corr, 2)}
                      hint="1,0 = läuft exakt parallel zum Index"
                    />
                    <Kpi
                      label="Positive Tage"
                      value={pctOf(hit, 0, false)}
                    />
                    <Kpi
                      label="Bester / schwächster Tag"
                      value={ext ? pct2(ext.best.r) : "—"}
                      tone="bull"
                      sub={ext ? `${pct2(ext.worst.r)} am ${formatDate(ext.worst.date)}` : undefined}
                    />
                  </div>

                  <div className="lcard p-5">
                    <div className="mb-1 text-sm font-semibold">Rückgang vom Höchststand</div>
                    <p className="mb-3 text-[11px] text-subtle">
                      Wie tief das Depot jeweils unter seinem bisherigen Hoch lag — der ehrlichste
                      Risikoindikator.
                    </p>
                    <DepotChart
                      series={[
                        {
                          key: "dd2",
                          label: "Rückgang",
                          color: "rgb(var(--bear-fill))",
                          fill: true,
                          points: drawdownSeries(seriesR).map((p) => ({ date: p.date, value: p.dd })),
                        },
                      ]}
                      height={190}
                      zeroLine
                      format={(v) => pctOf(v, 1, false)}
                    />
                  </div>
                </>
              )}

              {/* ── Kapital ─────────────────────────────────────────────── */}
              {perfView === "kapital" && (
                <>
                  <div className="lcard p-5">
                    <div className="mb-1 text-sm font-semibold">Kapitalfluss</div>
                    <p className="mb-3 text-[11px] text-subtle">
                      Grün nach oben: eingezahlt. Rot nach unten: entnommen.
                    </p>
                    <CapitalFlow flows={capitalFlows} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Kpi
                      label="Gebühren gesamt"
                      value={abbrevMoney(feesTotal || null)}
                      sub={
                        depositedNet > 0
                          ? `${pctOf(feesTotal / depositedNet, 2, false)} des eingesetzten Geldes`
                          : undefined
                      }
                    />
                    <Kpi
                      label="Realisiert"
                      value={signed(realizedTotal)}
                      tone={realizedTotal === 0 ? null : tone(realizedTotal)}
                      sub="aus Verkäufen"
                    />
                    <Kpi
                      label="Dividenden"
                      value={abbrevMoney(dividendsTotal || null)}
                      tone={dividendsTotal > 0 ? "bull" : null}
                    />
                    <Kpi
                      label="Buchungen"
                      value={txns.length.toLocaleString("de-DE")}
                      sub={`${positions.length} Papiere insgesamt`}
                    />
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Aufteilung ──────────────────────────────────────────────── */}
          {tab === "allocation" && (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <AllocView segments={posSegs} total={total} title="Nach Position" />
                <Concentration weights={weights} count={rows.length} />
                <AllocView
                  segments={groupSegs((m) => m.sector)}
                  total={total}
                  title="Nach Sektor"
                 
                />
                <AllocView
                  segments={groupSegs((m) => m.region)}
                  total={total}
                  title="Nach Region"
                 
                />
                <AllocView
                  segments={groupSegs((m) => m.assetClass)}
                  total={total}
                  title="Nach Anlageklasse"
                />
                <div className="lcard p-5">
                  <div className="mb-1 text-sm font-semibold">Einordnung</div>
                  <p className="mb-3 text-[11px] text-subtle">
                    Faustregeln aus der Portfoliotheorie — keine Anlageberatung.
                  </p>
                  <div className="space-y-2 text-sm">
                    <Check
                      ok={weights[0] !== undefined && weights[0] <= 0.25}
                      text={`Größte Position unter 25${NBSP}% (${pctOf(weights[0] ?? 0, 0, false)})`}
                    />
                    <Check ok={rows.length >= 10} text={`Mindestens 10 Positionen (${rows.length})`} />
                    <Check
                      ok={
                        groupSegs((m) => m.sector).filter((s) => s.value > 0)
                          .length >= 4
                      }
                      text="Mindestens 4 Sektoren vertreten"
                    />
                    <Check
                      ok={
                        groupSegs((m) => m.region).filter((s) => s.value > 0)
                          .length >= 2
                      }
                      text="Mehr als eine Region"
                    />
                    <Check
                      ok={mdd === null || mdd.dd > -0.35}
                      text={`Maximaler Rückgang unter 35${NBSP}% (${mdd ? pctOf(mdd.dd, 0, false) : "—"})`}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-subtle">
                Sektor, Region und Anlageklasse stammen aus einer gepflegten Liste der gängigsten
                Titel, dem Namen des Fonds (etwa „S&amp;P US … ETF“), dem Land der ISIN und für alle
                übrigen Aktien aus Yahoo Finance. ETFs zählen als ein Block, ihre Einzeltitel werden
                nicht aufgeschlüsselt.
              </p>
            </>
          )}

          {/* ── Dividenden ──────────────────────────────────────────────── */}
          {tab === "dividends" && (
            <DividendsTab
              info={divInfo}
              total={total}
              booked={dividendsBooked ? bookedDividends : 0}
              perTicker={dividendsByTicker}
              entries={divEntries}
            />
          )}

          {/* ── Aktivitäten ─────────────────────────────────────────────── */}
          {tab === "activity" && (
            <ActivityTab
              txns={txns}
              onImport={() => fileRef.current?.click()}
              onExport={exportCsv}
              onClear={() => {
                if (confirm("Wirklich alle Transaktionen löschen?")) {
                  clearTxns();
                  setMsg(null);
                }
              }}
              setMsg={setMsg}
            />
          )}

          {/* ── Investoren ──────────────────────────────────────────────── */}
          {tab === "investors" && (
            <InvestorsTab matches={matches} rows={rows} total={total} />
          )}

          <p className="text-[12px] leading-relaxed text-subtle">
            Bewertet wird mit den verfügbaren Kursen; fehlende oder über sieben Tage alte Kurse und
            fehlende Wechselkurse bleiben außen vor. Tagesänderungen enthalten keine
            Wechselkursbewegungen. <Link href="/datenschutz" className="underline underline-offset-2">Datenschutz & Sicherung</Link>
            {Object.values(hist).some((e) => e.source === "none") && (
              <button
                className="ml-2 !min-h-0 underline underline-offset-2"
                disabled={loadingHist}
                onClick={retryPrices}
              >
                Fehlende Kurse erneut laden
              </button>
            )}
          </p>
        </>
      )}
    </div>
  );
}

// ── Teilkomponenten ─────────────────────────────────────────────────────────

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="lcard p-8 text-center">
      <div className="text-lg font-semibold">Depot anlegen</div>
      <p className="mx-auto mt-2 max-w-md text-sm text-subtle">
        Lade eine CSV hoch — entweder eine einfache Bestandsliste oder einen vollständigen
        Transaktionsexport aus deinem Broker. Daraus rechnen wir Rendite, Risiko, Dividenden und
        den Vergleich zu Indizes und Star-Investoren.
      </p>
      <button onClick={onPick} className="btn-primary mt-5">
        CSV hochladen
      </button>
      <div className="mx-auto mt-5 max-w-lg rounded-xl bg-slate-50 p-4 text-left text-[11px] text-subtle">
        <div className="font-semibold text-ink">Einfach (nur Bestände):</div>
        <pre className="mt-1 font-mono">{`AAPL,10,180\nMSFT,5,320`}</pre>
        <div className="mt-3 font-semibold text-ink">Vollständig (mit Historie):</div>
        <pre className="mt-1 overflow-x-auto font-mono">{`Typ;Datum;Ticker;Anzahl;Kurs;Gebuehr\nKauf;17.03.2022;AAPL;10;158,20;1\nKauf;02.11.2023;MSFT;5;338,10;1\nVerkauf;14.06.2025;AAPL;4;201,50;1`}</pre>
        <p className="mt-3">
          Punkt oder Komma als Dezimaltrenner, Semikolon oder Komma als Spaltentrenner — beides
          funktioniert. Ohne Datum nehmen wir an, die Position wurde von Beginn an gehalten.
        </p>
      </div>
      <p className="mt-4 text-[11px] text-subtle">
        Dein Depot wird in diesem Browser gespeichert. Für Kursabfragen werden Ticker oder ISINs an unsere API und gegebenenfalls Yahoo Finance gesendet. Exportiere regelmäßig eine Sicherung.
      </p>
    </div>
  );
}

function ChartCard({
  mode,
  setMode,
  range,
  setRange,
  benchIdx,
  setBenchIdx,
  chartSeries,
}: {
  mode: ChartMode;
  setMode: (m: ChartMode) => void;
  range: RangeKey;
  setRange: (r: RangeKey) => void;
  benchIdx: number;
  setBenchIdx: (i: number) => void;
  chartSeries: ChartSeries[];
}) {
  const isPct = mode !== "value";
  return (
    <div className="lcard p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pills
          label="Ansicht"
          options={[
            ["value", "Wert"],
            ["return", "Rendite"],
            ["drawdown", "Rückgang"],
          ] as const}
          value={mode}
          onChange={setMode}
          size="sm"
        />
        {mode !== "drawdown" && <BenchSelect value={benchIdx} onChange={setBenchIdx} />}
      </div>
      <DepotChart
        series={chartSeries}
        height={240}
        zeroLine={isPct}
        format={(v) => (isPct ? pctOf(v, 2, false) : usd(v))}
        formatAxis={(v) => (isPct ? pctOf(v, 0, false) : abbrevMoney(v))}
      />
      <div className="mt-3">
        <Pills label="Zeitraum" options={RANGES} value={range} onChange={setRange} size="sm" />
      </div>
      <p className="mt-2 text-[12px] leading-snug text-subtle">
        {mode === "value"
          ? "Graue Treppe = netto eingezahltes Geld. Der Abstand zur Depotlinie ist dein Gewinn."
          : mode === "return"
          ? "Zeitgewichtete Rendite — Ein- und Auszahlungen verzerren den Vergleich nicht."
          : "Rückgang vom jeweils höchsten Stand."}{" "}
        Wischen oder mit der Maus darüberfahren zeigt einzelne Tage.
      </p>
    </div>
  );
}

/** Benchmark picker: one capsule with the native menu, not a third tab row. */
function BenchSelect({ value, onChange }: { value: number; onChange: (i: number) => void }) {
  return (
    <label className="btn-capsule relative !min-h-9 !gap-1 !px-3.5 text-[13px]">
      <span className="text-subtle">vs.</span>
      <span className="font-semibold">{BENCHMARKS[value].label}</span>
      <Icon name="chevronDown" className="h-3.5 w-3.5 text-subtle" />
      <select
        aria-label="Vergleichsindex"
        value={BENCHMARKS[value].key}
        onChange={(e) => onChange(BENCHMARKS.findIndex((b) => b.key === e.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {BENCHMARKS.map((b) => (
          <option key={b.key} value={b.key}>
            {b.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TopMovers({ rows, loading }: { rows: Row[]; loading: boolean }) {
  const day = rows.filter((r) => r.dayPct !== null).sort((a, b) => (b.dayPct ?? 0) - (a.dayPct ?? 0));
  const all = rows.filter((r) => r.unrealPct !== null).sort((a, b) => (b.unrealPct ?? 0) - (a.unrealPct ?? 0));
  if (day.length === 0 && all.length === 0) return null;

  const List = ({
    title,
    items,
    valueOf,
    subOf,
  }: {
    title: string;
    items: typeof rows;
    valueOf: (r: (typeof rows)[number]) => number | null;
    subOf: (r: (typeof rows)[number]) => string;
  }) => (
    <div className="lcard p-5">
      <div className="mb-3 text-sm font-semibold">{title}</div>
      <div className="space-y-2.5">
        {items.map((r) => {
          const v = valueOf(r);
          return (
            <Link
              key={r.ticker}
              href={r.symbol ? stockHref(r.symbol) : "/me"}
              className="flex items-center gap-2.5"
            >
              <CompanyLogo ticker={r.symbol} company={r.company} size={30} />
              <span className="min-w-0 flex-1 truncate text-sm">{r.company}</span>
              <span className="text-xs text-subtle">{subOf(r)}</span>
              <span
                className={`w-20 text-right text-sm font-semibold tabular-nums ${
                  (v ?? 0) >= 0 ? "text-bull" : "text-bear"
                }`}
              >
                {pct2(v)}
              </span>
            </Link>
          );
        })}
        {items.length === 0 && (
          <div className="text-sm text-subtle">
            {loading
              ? "Kurse werden geladen …"
              : "Noch keine Tagesveränderung — die Börse hat seit dem letzten Schlusskurs nicht gehandelt."}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <List
        title="Top Mover heute"
        items={[...day.slice(0, 3), ...day.slice(-3).reverse()].filter(
          (v, i, a) => a.findIndex((x) => x.ticker === v.ticker) === i,
        )}
        valueOf={(r) => r.dayPct}
        subOf={(r) => signed(r.dayAbs)}
      />
      <List
        title="Gewinner & Verlierer gesamt"
        items={[...all.slice(0, 3), ...all.slice(-3).reverse()].filter(
          (v, i, a) => a.findIndex((x) => x.ticker === v.ticker) === i,
        )}
        valueOf={(r) => r.unrealPct}
        subOf={(r) => signed(r.totalGain)}
      />
    </div>
  );
}

type Row = {
  /** ISIN oder Kürzel aus dem Export — die Identität der Position. */
  ticker: string;
  /** Aufgelöstes Börsenkürzel für Kurse, Logo und Verlinkung. */
  symbol: string | null;
  resolution: Resolution | null;
  /** Vom Nutzer eingetragener Kurs für nicht handelbare Papiere. */
  manualPrice: number | null;
  /** Warnung, wenn Kurs und Einstand nicht zusammenpassen können. */
  mismatch: string | null;
  company: string;
  assetClass: string;
  shares: number;
  avgPrice: number | null;
  costBasis: number;
  last: number | null;
  value: number | null;
  unreal: number | null;
  unrealPct: number | null;
  dayPct: number | null;
  dayAbs: number | null;
  realized: number;
  dividends: number;
  totalGain: number;
  live: boolean;
};

type SortKey = "value" | "gainPct" | "day" | "name";

/**
 * Positions as a plain list (getquin / Parqet): logo, name, shares × price;
 * value and result on the right. One control sorts, and "Heute" also swaps
 * the result for today's move. Removing lives behind "Bearbeiten", so a row
 * is never one stray tap away from deletion.
 */
function PositionsTable({
  rows,
  total,
  onRemove,
}: {
  rows: Row[];
  total: number;
  onRemove: (t: string) => void;
}) {
  const [sort, setSort] = useState<SortKey>("value");
  const [editing, setEditing] = useState(false);

  const sorted = useMemo(() => {
    const val = (r: Row): number => (sort === "gainPct" ? r.unrealPct : sort === "day" ? r.dayPct : r.value) ?? -Infinity;
    return [...rows].sort((x, y) => (sort === "name" ? x.company.localeCompare(y.company, "de") : val(y) - val(x)));
  }, [rows, sort]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Pills
          label="Sortieren nach"
          size="sm"
          options={[["value", "Wert"], ["gainPct", "Gewinn"], ["day", "Heute"], ["name", "A–Z"]] as const}
          value={sort}
          onChange={setSort}
        />
        <button type="button" onClick={() => setEditing((e) => !e)} className="press-sm shrink-0 px-1 text-[15px] font-medium text-ink !min-h-9">
          {editing ? "Fertig" : "Bearbeiten"}
        </button>
      </div>

      <ul className="card overflow-hidden">
        {sorted.map((r) => {
          const w = r.value != null && total > 0 ? r.value / total : null;
          const shown = sort === "day" ? r.dayPct : r.unrealPct;
          const shownAbs = sort === "day" ? r.dayAbs : r.unreal;
          const importIssue = !!r.mismatch && r.mismatch.includes("Import");
          const sub = r.mismatch ? null : `${r.shares.toLocaleString("de-DE", { maximumFractionDigits: 4 })}${NBSP}St.${r.last != null ? ` · ${usd(r.last)}` : ""}`;
          const body = (
            <>
              <CompanyLogo ticker={r.symbol} company={r.company} size={42} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-semibold leading-snug">{r.company}</span>
                {sub ? (
                  <span className="block truncate text-[13px] tabular-nums text-subtle">
                    {sub}
                    {r.manualPrice != null ? " · manuell" : ""}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 truncate text-[13px] font-medium text-warn" title={importIssue ? `${r.mismatch}. Lösche die Buchungen und lade die Datei erneut hoch.` : `${r.mismatch}. Vermutlich ist die ISIN einer falschen Börsennotierung zugeordnet.`}>
                    <Icon name="danger" className="h-3.5 w-3.5 shrink-0" />
                    {importIssue ? "Falsch importiert" : "Zuordnung prüfen"}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[16px] font-semibold tabular-nums leading-snug">{r.value != null ? cMoney(r.value) : "—"}</span>
                <span className={`block text-[13px] font-medium tabular-nums ${shown == null ? "text-subtle" : shown >= 0 ? "text-bull" : "text-bear"}`}>
                  {shown == null ? (r.value == null ? "kein Kurs" : "—") : `${shown >= 0 ? "▲" : "▼"} ${pctOf(Math.abs(shown), 2, false)}`}
                  {shownAbs != null && shown != null && <span className="sr-only"> ({signed(shownAbs)})</span>}
                </span>
              </span>
            </>
          );
          const cls = "flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 pr-4";
          return (
            <li key={r.ticker} className="relative flex items-center after:absolute after:bottom-0 after:left-[4.5rem] after:right-0 after:h-px after:bg-hair last:after:hidden">
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`${r.company} mit allen Buchungen entfernen?`)) onRemove(r.ticker);
                  }}
                  aria-label={`${r.company} entfernen`}
                  className="fade-in ml-3 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bear-fill text-white ![animation-delay:0ms] ![animation-duration:200ms] !min-h-0"
                >
                  <span className="block h-[2px] w-3 rounded-full bg-white" />
                </button>
              )}
              {r.symbol && !editing ? (
                <Link href={stockHref(r.symbol)} className={`${cls} transition-colors active:bg-ink/[0.04]`} title={w != null ? `${pctOf(w, 1, false)} deines Depots` : undefined}>
                  {body}
                </Link>
              ) : (
                <div className={cls}>{body}</div>
              )}
            </li>
          );
        })}
        {sorted.length === 0 && <li className="px-4 py-10 text-center text-sm text-subtle">Keine offenen Positionen.</li>}
      </ul>
      <p className="text-[12px] leading-snug text-subtle">
        {sort === "day" ? "Rechts steht die Kursänderung von heute." : "Rechts steht der Kursgewinn der offenen Stücke gegenüber deinem Durchschnittseinstand."} Realisierte
        Gewinne und Dividenden findest du unter Performance bzw. Dividenden.
      </p>
    </div>
  );
}

function BenchmarkTable({
  barsOf,
  seriesR,
  perfPortfolio,
}: {
  barsOf: (symbol: string) => Bar[];
  seriesR: { date: string }[];
  perfPortfolio: number | null;
}) {
  if (seriesR.length < 2) return null;
  const from = seriesR[0].date;
  const to = seriesR[seriesR.length - 1].date;
  const items = BENCHMARKS.map((b) => {
    const bars = barsOf(b.key).filter((x) => x.date >= from && x.date <= to);
    return { ...b, r: seriesReturn(bars) };
  }).filter((x) => x.r !== null);

  const all = [
    { key: "me", label: "Dein Depot", r: perfPortfolio },
    ...items,
  ]
    .filter((x) => x.r !== null)
    .sort((a, b) => (b.r as number) - (a.r as number));

  if (all.length < 2) return null;
  const max = Math.max(...all.map((x) => Math.abs(x.r as number)), 0.01);

  return (
    <div className="lcard p-5">
      <div className="mb-1 text-sm font-semibold">Wer hätte besser abgeschnitten?</div>
      <p className="mb-4 text-[11px] text-subtle">
        Gleicher Zeitraum ({formatDate(from)} – {formatDate(to)}), reine Kursentwicklung der Indizes.
      </p>
      <div className="space-y-2.5">
        {all.map((x) => {
          const r = x.r as number;
          const isMe = x.key === "me";
          return (
            <div key={x.key} className="flex items-center gap-3 text-sm">
              <span className={`w-28 shrink-0 truncate ${isMe ? "font-semibold" : "text-subtle"}`}>
                {x.label}
              </span>
              <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`absolute inset-y-0 rounded-full ${
                    isMe ? "bg-brand" : r >= 0 ? "bg-bull-fill" : "bg-bear-fill"
                  }`}
                  style={{ left: "0%", width: `${(Math.abs(r) / max) * 100}%` }}
                />
              </div>
              <span
                className={`w-20 shrink-0 text-right font-semibold tabular-nums ${
                  r >= 0 ? "text-bull" : "text-bear"
                }`}
              >
                {pct(r)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DividendsTab({
  info,
  total,
  booked,
  perTicker,
  entries,
}: {
  info: {
    received: number;
    forecast: number;
    perPos: {
      ticker: string;
      symbol: string | null;
      company: string;
      received: number;
      perShare: number;
      annual: number;
      yieldNow: number | null;
      yieldOnCost: number | null;
      value: number | null;
    }[];
    byMonth: Map<string, number>;
    upcoming: { ticker: string; date: string; amount: number }[];
    yieldNow: number | null;
    yieldOnCost: number | null;
  };
  total: number;
  /** Summe der tatsächlich importierten Dividendenbuchungen (0 = keine da). */
  booked: number;
  /** Dividenden je Papier — inklusive längst verkaufter Positionen. */
  perTicker: { ticker: string; name: string; amount: number; open: boolean }[];
  /** Einzelne Ausschüttungen für die interaktiven Grafiken. */
  entries: DivEntry[];
}) {
  const receivedTotal = booked > 0 ? booked : info.received;
  const closed = perTicker.filter((x) => !x.open);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="Erhalten (gesamt)"
          value={abbrevMoney(receivedTotal || null)}
          tone={receivedTotal > 0 ? "bull" : null}
          sub={booked > 0 ? "laut deinen Buchungen" : "aus Ausschüttungshistorie"}
        />
        <Kpi
          label="Erwartet nächste 12 M"
          value={abbrevMoney(info.forecast || null)}
          sub={info.forecast > 0 ? `≈ ${abbrevMoney(info.forecast / 12)} / Monat` : undefined}
        />
        <Kpi
          label="Dividendenrendite"
          value={info.yieldNow ? pctOf(info.yieldNow, 2, false) : "—"}
          sub="auf aktuellen Kurs"
        />
        <Kpi
          label="Rendite auf Einstand"
          value={info.yieldOnCost ? pctOf(info.yieldOnCost, 2, false) : "—"}
          tone={
            info.yieldOnCost && info.yieldNow && info.yieldOnCost > info.yieldNow ? "bull" : null
          }
          sub="Yield on Cost"
        />
      </div>

      {info.forecast === 0 && receivedTotal === 0 && (
        <div className="lcard p-8 text-center text-sm text-subtle">
          Für deine Positionen sind keine Ausschüttungen bekannt — viele Wachstumswerte und ETFs
          thesaurieren oder zahlen schlicht keine Dividende.
        </div>
      )}

      {entries.length > 0 && (
        <>
          <DividendChart entries={entries} />
          <DividendSplit entries={entries} />
        </>
      )}

      {info.upcoming.length > 0 && (
        <div className="lcard p-5">
          <div className="mb-3 text-sm font-semibold">Angekündigte Zahlungen</div>
          <div className="space-y-2">
            {info.upcoming.map((u, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <CompanyLogo ticker={u.ticker} company={u.ticker} size={26} />
                <span className="flex-1 font-medium">{u.ticker}</span>
                <span className="text-xs text-subtle">{formatDate(u.date)}</span>
                <span className="font-semibold tabular-nums">{usd(u.amount)} / Stück</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {info.perPos.length > 0 && (
        <section className="space-y-2">
          <h3 className="px-1 text-[17px] font-semibold tracking-[-0.01em]">Je Position</h3>
          <ul className="card overflow-hidden">
            {info.perPos.map((p) => (
              <li key={p.ticker} className="relative flex items-center gap-3 px-4 py-3 after:absolute after:bottom-0 after:left-[4.25rem] after:right-0 after:h-px after:bg-hair last:after:hidden">
                <CompanyLogo ticker={p.symbol} company={p.company} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{p.company}</span>
                  <span className="block truncate text-[13px] tabular-nums text-subtle">
                    {p.yieldNow ? `Rendite ${pctOf(p.yieldNow, 2, false)}` : "Rendite —"}
                    {p.yieldOnCost ? ` · auf Einstand ${pctOf(p.yieldOnCost, 2, false)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-semibold tabular-nums text-bull">{p.annual > 0 ? `${abbrevMoney(p.annual)} / Jahr` : "—"}</span>
                  <span className="block text-[13px] tabular-nums text-subtle">{p.received > 0 ? `${abbrevMoney(p.received)} erhalten` : "noch nichts erhalten"}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {closed.length > 0 && (
        <Collapse
          title={`Dividenden aus verkauften Positionen · ${closed.length}`}
          right={
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-subtle">
              {abbrevMoney(closed.reduce((a, x) => a + x.amount, 0))}
            </span>
          }
        >
          <div className="space-y-2">
            {closed.map((x) => (
              <div key={x.ticker} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{x.name}</span>
                <span className="text-[12px] text-subtle">{x.ticker}</span>
                <span className="w-24 text-right font-semibold tabular-nums">
                  {abbrevMoney(x.amount)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-subtle">
            Diese Papiere hältst du nicht mehr. Die Ausschüttungen zählen trotzdem zu deinem
            Gesamtertrag — sie fehlen nur in der Prognose oben, weil dafür kein Bestand mehr da ist.
          </p>
        </Collapse>
      )}

      <p className="text-[11px] text-subtle">
        {booked > 0
          ? "„Erhalten“ stammt aus deinen importierten Dividendenbuchungen — netto nach Quellensteuer. "
          : "„Erhalten“ ist aus der Ausschüttungshistorie und deiner damaligen Stückzahl rekonstruiert; Quellensteuer ist dabei nicht abgezogen. "}
        Die Prognose schreibt die Ausschüttungen der letzten zwölf Monate fort. Erhöhungen,
        Kürzungen und Sonderdividenden sind darin nicht enthalten — eine Orientierung, keine Zusage.
      </p>
    </div>
  );
}

function ActivityTab({
  txns,
  onImport,
  onExport,
  onClear,
  setMsg,
}: {
  txns: Txn[];
  onImport: () => void;
  onExport: () => void;
  onClear: () => void;
  setMsg: (m: string | null) => void;
}) {
  const [kind, setKind] = useState<TxnKind>("buy");
  const [date, setDate] = useState("");
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("");
  // Bei über tausend Buchungen kostet es den Browser spürbar Speicher, alle
  // Zeilen gleichzeitig im Dokument zu halten. Deshalb stückweise nachladen.
  const [limit, setLimit] = useState(200);
  const shown = useMemo(() => [...txns].reverse().slice(0, limit), [txns, limit]);

  const needsShares = kind === "buy" || kind === "sell";
  const needsTicker = kind !== "deposit" && kind !== "withdrawal";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const T = ticker.trim().toUpperCase();
    if (needsTicker && !SYMBOL_RE.test(T)) {
      setMsg("Bitte einen gültigen Ticker oder eine ISIN eingeben, z. B. AAPL oder US0378331005.");
      return;
    }
    const d = parseDate(date);
    if (needsShares) {
      const s = parseNum(shares);
      const p = parseNum(price);
      if (!Number.isFinite(s) || s <= 0) {
        setMsg("Bitte eine Stückzahl größer als 0 eingeben.");
        return;
      }
      addTxn(
        makeTxn({
          kind,
          ticker: T,
          date: d,
          shares: s,
          price: Number.isFinite(p) && p > 0 ? p : 0,
          fee: Math.abs(parseNum(fee)) || 0,
        }),
      );
    } else {
      const a = Math.abs(parseNum(amount));
      if (!Number.isFinite(a) || a <= 0) {
        setMsg("Bitte einen Betrag größer als 0 eingeben.");
        return;
      }
      addTxn(makeTxn({ kind, ticker: needsTicker ? T : "", date: d, amount: a, fee: Math.abs(parseNum(fee)) || 0 }));
    }
    setTicker("");
    setShares("");
    setPrice("");
    setAmount("");
    setFee("");
    setMsg(null);
  };

  const label = KIND_LABEL;
  const badge: Record<TxnKind, string> = {
    buy: "bg-bull/10 text-bull",
    sell: "bg-bear/10 text-bear",
    dividend: "bg-investor/10 text-investor",
    deposit: "bg-slate-100 text-slate-600",
    withdrawal: "bg-slate-100 text-slate-600",
    interest: "bg-warn/10 text-warn",
    split: "bg-investor/10 text-investor",
  };

  const inputCls = "field h-11";

  return (
    <div className="space-y-4">
      <div className="lcard p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[15px] font-semibold">Transaktion erfassen</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={onImport} className="btn-capsule !min-h-9 !px-3.5 text-[13px]">
              <Icon name="upload" className="h-4 w-4" />
              CSV importieren
            </button>
            <button onClick={onExport} className="btn-capsule !min-h-9 !px-3.5 text-[13px]">
              <Icon name="download" className="h-4 w-4" />
              Exportieren
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Pills
            label="Art der Buchung"
            options={(["buy", "sell", "dividend", "deposit", "withdrawal"] as const).map(
              (k) => [k, label[k]] as const,
            )}
            value={kind}
            onChange={setKind}
            size="sm"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder="Datum, z. B. 17.03.2022"
              aria-label="Datum"
              inputMode="numeric"
              className={`col-span-2 sm:col-span-1 ${inputCls}`}
            />
            {needsTicker && (
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="Ticker oder ISIN"
                aria-label="Ticker oder ISIN"
                autoCapitalize="characters"
                className={`col-span-2 sm:col-span-1 ${inputCls}`}
              />
            )}
            {needsShares ? (
              <>
                <input
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="Stück"
                  aria-label="Stück"
                  inputMode="decimal"
                  className={inputCls}
                />
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Kurs $"
                  aria-label="Kurs in Dollar"
                  inputMode="decimal"
                  className={inputCls}
                />
              </>
            ) : (
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Betrag $"
                aria-label="Betrag in Dollar"
                inputMode="decimal"
                className={inputCls}
              />
            )}
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="Gebühr $"
              aria-label="Gebühr in Dollar"
              inputMode="decimal"
              className={inputCls}
            />
            <button className="btn-primary col-span-2 sm:col-span-1">
              <Icon name="plus" className="h-4 w-4" />
              Hinzufügen
            </button>
          </div>
        </form>
        <p className="mt-3 text-[12px] leading-snug text-subtle">
          Ohne Datum gilt die Position als „von Anfang an gehalten“. Für exakte Rendite, IZF und
          Dividendenzuordnung lohnt es sich, Datum und Kurs zu ergänzen.
        </p>
      </div>

      <div className="lcard overflow-hidden">
        <div className="flex items-center justify-between border-b border-hair px-5 py-3">
          <span className="text-sm font-semibold">
            {txns.length} {txns.length === 1 ? "Buchung" : "Buchungen"}
          </span>
          {txns.length > 0 && (
            <button onClick={onClear} className="text-xs text-subtle underline hover:text-bear">
              Alle löschen
            </button>
          )}
        </div>
        <div className="max-h-[32rem] overflow-y-auto">
          {shown.map((t) => (
            <div key={t.id} className="cv-row flex items-center gap-3 border-b border-hair py-2.5 pl-5 pr-2 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                    {t.name || t.ticker || "—"}
                    {t.name && t.ticker && <span className="ml-1.5 text-[12px] font-normal text-subtle">{t.ticker}</span>}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[15px] tabular-nums">
                    {t.kind === "buy" || t.kind === "sell"
                      ? `${t.shares.toLocaleString("de-DE", { maximumFractionDigits: 4 })} × ${usd(t.price)}`
                      : t.kind === "split"
                      ? `${t.shares > 0 ? "+" : ""}${t.shares.toLocaleString("de-DE", { maximumFractionDigits: 4 })}${NBSP}St.`
                      : usd(t.amount)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge[t.kind]}`}>{label[t.kind]}</span>
                  <span className="text-[12px] text-subtle">{t.date ? formatDate(t.date) : "ohne Datum"}</span>
                </div>
              </div>
              <button
                onClick={() => removeTxn(t.id)}
                aria-label="Buchung löschen"
                className="press-sm inline-flex h-9 w-9 !min-h-0 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bear/10 hover:text-bear"
              >
                <Icon name="delete" className="h-[18px] w-[18px]" />
              </button>
            </div>
          ))}
          {txns.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-subtle">Noch keine Buchungen.</div>
          )}
          {shown.length < txns.length && (
            <button
              onClick={() => setLimit((n) => n + 200)}
              className="press-sm w-full border-t border-hair px-5 py-3 text-sm font-medium text-brand hover:bg-slate-50"
            >
              Weitere 200 anzeigen ({txns.length - shown.length} übrig)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function InvestorsTab({
  matches,
  rows,
  total,
}: {
  matches: MatchRow[] | null;
  rows: Row[];
  total: number;
}) {
  // The match API speaks in exchange symbols (the ones sent to it); a row's
  // `ticker` is usually the ISIN from the broker export, which never matched
  // and showed every investor at 0 %.
  const norm = (t: string) => t.toUpperCase().replace(/[.\-/]/g, "");
  const weightWith = (m: MatchRow) => {
    if (total <= 0) return null;
    const shared = new Set(m.sharedTickers.map(norm));
    const w = rows
      .filter((r) => shared.has(norm(r.symbol ?? r.ticker)))
      .reduce((a, r) => a + (r.value ?? 0), 0);
    return w / total;
  };

  if (!matches) return <div className="lcard p-8 text-center text-sm text-subtle">Wird geladen …</div>;
  if (matches.length === 0)
    return (
      <div className="lcard p-8 text-center text-sm text-subtle">
        Keiner der verfolgten Investoren hält aktuell eine deiner Positionen. Das muss nichts
        Schlechtes heißen — Fonds melden ihre Bestände nur quartalsweise und oft mit Verzögerung.
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="lcard overflow-hidden">
        {matches.map((m) => {
          const uw = weightWith(m);
          return (
            <Link
              key={m.slug}
              href={`/investor/${m.slug}`}
              className="flex items-center gap-3 border-b border-hair px-4 py-3.5 transition last:border-0 hover:bg-slate-50"
            >
              <Avatar name={m.person ?? m.fund} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{m.person ?? m.fund}</div>
                <div className="truncate text-xs text-subtle">
                  {m.sharedCount} gemeinsame {m.sharedCount === 1 ? "Aktie" : "Aktien"}:{" "}
                  {m.sharedTickers.slice(0, 5).join(", ")}
                  {m.sharedTickers.length > 5 ? " …" : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">
                  {uw != null ? pctOf(uw, uw < 0.1 ? 1 : 0, false) : "—"}
                </div>
                <div className="text-[11px] text-subtle">deines Depots</div>
              </div>
              <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-zinc-300" />
            </Link>
          );
        })}
      </div>
      <Collapse title="Wie wird die Überschneidung berechnet?">
        <p className="text-sm text-subtle">
          Wir vergleichen deine Ticker mit den zuletzt gemeldeten 13F-Beständen der verfolgten
          Investoren. „% deines Depots“ ist der Anteil deines Depotwerts, der in Aktien steckt, die
          dieser Investor ebenfalls hält. Weil 13F-Meldungen bis zu 45 Tage nach Quartalsende
          erscheinen, ist das immer ein Blick in den Rückspiegel — und Leerverkäufe sowie
          ausländische Papiere tauchen dort gar nicht auf.
        </p>
      </Collapse>
    </div>
  );
}

/** Ehrlicher Import-Bericht: was kam an, was blieb bewusst draußen. */
function ImportSummary({ report, onClose }: { report: ImportReport; onClose: () => void }) {
  const c = report.counts;
  const items: [string, number, string][] = [
    ["Käufe & Verkäufe", c.trades, "text-ink"],
    ["Dividenden", c.dividends, "text-bull"],
    ["Splits & Überträge", c.corporate, "text-ink"],
    ["Ein- & Auszahlungen", c.cash, "text-subtle"],
  ];
  return (
    <div className="lcard p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{summarize(report)}</div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {items
              .filter(([, n]) => n > 0)
              .map(([label, n, cls]) => (
                <div key={label}>
                  <div className={`text-lg font-semibold tabular-nums ${cls}`}>
                    {n.toLocaleString("de-DE")}
                  </div>
                  <div className="text-[11px] text-subtle">{label}</div>
                </div>
              ))}
            <div>
              <div className="text-lg font-semibold tabular-nums">{report.instruments.length}</div>
              <div className="text-[11px] text-subtle">Wertpapiere</div>
            </div>
          </div>
          {report.notes.length > 0 && (
            <ul className="mt-3 space-y-1 text-[11px] text-subtle">
              {report.notes.map((n, i) => (
                <li key={i}>· {n}</li>
              ))}
            </ul>
          )}
          {c.unusable > 0 && (
            <p className="mt-1 text-[11px] text-subtle">
              · {c.unusable} Zeilen ohne verwertbare Stückzahl oder Betrag übersprungen.
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Schließen"
          className="glass press-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-subtle hover:text-ink"
        >
          <Icon name="close" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

/** Positionen ohne Kurs — mit der Möglichkeit, selbst ein Kürzel zuzuordnen. */
function UnpricedPanel({
  rows,
  resolving,
  onRemove,
}: {
  rows: Row[];
  resolving: boolean;
  onRemove: (t: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});
  const cost = rows.reduce((a, r) => a + r.costBasis, 0);

  const saveManual = (r: Row) => {
    const v = parseNum(priceDraft[r.ticker] ?? "");
    if (Number.isFinite(v) && v > 0) {
      setManualPrice(r.ticker, v);
      setPriceDraft((d) => ({ ...d, [r.ticker]: "" }));
    }
  };

  return (
    <div className="lcard overflow-hidden">
      <div className="border-b border-hair px-5 py-3.5">
        <div className="text-sm font-semibold">
          Nicht bewertet · {rows.length} {rows.length === 1 ? "Position" : "Positionen"}
        </div>
        <p className="mt-1 text-[11px] text-subtle">
          Diese Papiere fließen bewusst nicht in Depotwert, Rendite und Aufteilung ein — lieber eine
          Lücke als eine erfundene Zahl. Eingesetzt sind hier {cAbbrev(cost)}. Für Optionsscheine
          kannst du den aktuellen Kurs aus deinem Broker eintragen; die Position zählt dann normal
          mit.
          {resolving && " Kürzel werden gerade gesucht …"}
        </p>
      </div>
      {rows.map((r) => {
        const why = r.resolution?.unpriceable;
        return (
          <div key={r.ticker} className="flex flex-wrap items-center gap-3 border-b border-hair px-5 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.company}</div>
              <div className="text-[12px] text-subtle">
                {r.ticker} · {r.shares.toLocaleString("de-DE", { maximumFractionDigits: 4 })}{NBSP}St. ·
                Einstand {cAbbrev(r.costBasis)}
              </div>
            </div>
            {why ? (
              // Optionsscheine und Privatmarkt-Anteile haben keinen öffentlichen
              // Kurs — dafür kann der aktuelle Wert aus dem Broker übernommen
              // werden. Klar als manuell gekennzeichnet.
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-subtle"
                  title={why}
                >
                  {why.split(" — ")[0]}
                </span>
                <input
                  value={priceDraft[r.ticker] ?? ""}
                  onChange={(e) => setPriceDraft((d) => ({ ...d, [r.ticker]: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && saveManual(r)}
                  placeholder={`Kurs je Stück (${currencySymbol().trim()})`}
                  className="w-40 rounded-full border border-hair bg-card px-3 py-1 text-sm focus:border-brand"
                />
                <button
                  onClick={() => saveManual(r)}
                  className="btn-primary press-sm !px-3 !py-1"
                >
                  Wert setzen
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  value={draft[r.ticker] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [r.ticker]: e.target.value }))}
                  placeholder="Kürzel, z. B. AAPL"
                  className="w-36 rounded-full border border-hair bg-card px-3 py-1 text-sm focus:border-brand"
                />
                <button
                  onClick={() => {
                    const v = (draft[r.ticker] ?? "").trim().toUpperCase();
                    if (v && SYMBOL_RE.test(v)) setUserSymbol(r.ticker, v);
                  }}
                  className="btn-primary press-sm !px-3 !py-1"
                >
                  Zuordnen
                </button>
              </div>
            )}
            <button
              onClick={() => onRemove(r.ticker)}
              aria-label="Entfernen"
              className="press-sm shrink-0 rounded-full px-1.5 text-slate-300 hover:text-bear"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Große Renditezahl mit Erklärsatz — der Kopf des Performance-Reiters. */
function BigStat({
  label,
  value,
  sub,
  muted,
  divider,
}: {
  label: string;
  value: number | null;
  sub: string;
  muted?: boolean;
  /** Hairline to the previous cell: above on phones, left on wider screens. */
  divider?: boolean;
}) {
  return (
    <div className={`p-5 ${divider ? "border-t border-hair sm:border-l sm:border-t-0" : ""}`}>
      <div className="text-xs text-subtle">{label}</div>
      <div
        className={`num-xl mt-1 ${
          value === null ? "" : muted ? "text-ink" : value >= 0 ? "text-bull" : "text-bear"
        }`}
      >
        {value === null ? (
          "—"
        ) : (
          <CountUp to={value * 100} format={(v) => pctOf(v / 100, 1)} />
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-subtle">{sub}</p>
    </div>
  );
}

function AssumedHint({ n, onGo }: { n: number; onGo: () => void }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-subtle">
      <span className="font-semibold">
        {n} {n === 1 ? "Position hat" : "Positionen haben"} kein Kaufdatum.
      </span>{" "}
      Sie werden als „seit Beginn des Charts gehalten“ gerechnet. Ergänze Datum und Kaufkurs, dann
      stimmen auch IZF und Jahresrenditen.{" "}
      <button onClick={onGo} className="underline hover:no-underline">
        Zu den Aktivitäten
      </button>
    </div>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
          ok ? "bg-bull-fill" : "bg-slate-300"
        }`}
      >
        {ok ? "✓" : "·"}
      </span>
      <span className={ok ? "text-subtle" : "text-ink"}>{text}</span>
    </div>
  );
}
