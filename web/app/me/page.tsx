"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";
import { CountUp } from "@/components/Donut";
import { ChartSeries, DepotChart, ReturnBars } from "@/components/DepotChart";
import { DivEntry, DividendChart, DividendSplit } from "@/components/DividendChart";
import { LiveValue } from "@/components/LiveValue";
import {
  CapitalFlow,
  ContributionBars,
  MonthHeatmap,
  ReturnTreemap,
  TreeItem,
} from "@/components/PerformanceViews";
import { AllocView, Collapse, Concentration, Kpi, Pills, Segment } from "@/components/DepotPanels";
import { companyName, fixTicker, formatDate, pct } from "@/lib/format";
import { fetchJson } from "@/lib/fetchJson";
import { ImportReport, importCsv, summarize } from "@/lib/brokers";
import {
  Resolution,
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
  convertBars,
  correlation,
  dailyReturns,
  dayDiff,
  drawdownSeries,
  extremeDays,
  getTxns,
  hitRate,
  indexTo,
  lastFx,
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
import {
  ASSET_COLOR,
  REGION_COLOR,
  SECTOR_COLOR,
  assetMeta,
} from "@/lib/sectors";
import { MatchResponse, MatchRow } from "@/lib/types";
import { useQuotes } from "@/lib/useQuotes";

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

const POS_COLORS = [
  "#4f46e5", "#0ea5e9", "#16a34a", "#f59e0b", "#db2777",
  "#8b5cf6", "#14b8a6", "#ef4444", "#65a30d", "#0891b2",
];

// ── Hilfen ──────────────────────────────────────────────────────────────────

const usd = cMoney;
const abbrevMoney = cAbbrev;
const signed = cSigned;

const pct2 = (v: number | null): string =>
  v === null || Number.isNaN(v) ? "—" : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)} %`;

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
    const out = new Map<string, Resolution>();
    for (const k of keys) {
      const m = meta.get(k);
      out.set(k, resolveInstrument(k, m?.name ?? null, m?.assetClass ?? null, userMap, cache));
    }
    return out;
    // mapTick zwingt zur Neuberechnung, wenn der Nutzer etwas zuordnet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, meta, mapTick]);

  // Offene ISINs serverseitig nachschlagen.
  const [resolving, setResolving] = useState(false);
  useEffect(() => {
    const open = keys.filter(
      (k) => isIsin(k) && !resolutions.get(k)?.symbol && !resolutions.get(k)?.unpriceable,
    );
    if (open.length === 0) return;
    let on = true;
    setResolving(true);
    fetchJson<{ symbols: Record<string, string> }>(
      `/api/resolve?ids=${encodeURIComponent(open.slice(0, 60).join(","))}`,
    )
      .then((d) => {
        if (!on || !d.symbols) return;
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
    const want = [...symbols, ...BENCHMARKS.map((b) => b.key), ...(fxPair ? [fxPair] : [])];
    const need = [...new Set(want)].filter((t) => !(t in hist));
    if (need.length === 0) return;
    let on = true;
    setLoadingHist(true);
    fetchJson<{ entries: Record<string, HistoryEntry> }>(
      `/api/history?tickers=${encodeURIComponent(need.join(","))}&range=6y`,
    )
      .then((d) => on && setHist((p) => ({ ...p, ...d.entries })))
      .catch(() => {
        if (!on) return;
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
  }, [symbols, hist, fxPair]);

  /** Wechselkursreihe Depotwährung → USD. */
  const fxBars = fxPair ? hist[fxPair]?.bars ?? null : null;
  const fxNow = lastFx(fxBars);

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
      const q = (e.currency ?? "USD").toUpperCase();
      m.set(sym, q !== currency && q === "USD" && fxBars ? convertBars(e.bars, fxBars) : e.bars);
    }
    return m;
  }, [hist, currency, fxBars]);

  const toDepot = useCallback((symbol: string): Bar[] => depotBars.get(symbol) ?? [], [depotBars]);

  const quotes = useQuotes(symbols);

  // ── Investoren-Überschneidung ─────────────────────────────────────────────
  useEffect(() => {
    if (symbols.length === 0) {
      setMatches(null);
      return;
    }
    let on = true;
    fetchJson<MatchResponse>(`/api/match?tickers=${encodeURIComponent(symbols.join(","))}`)
      .then((d) => on && setMatches(d.rows))
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
      const eod = bars && bars.length ? bars[bars.length - 1].close : null;
      // Live-Kurs notiert in der Kurswährung — in die Depotwährung umrechnen.
      const qCur = (q?.currency ?? "USD").toUpperCase();
      const live = q ? (qCur === currency ? q.price : qCur === "USD" ? q.price / fxNow : q.price) : null;
      const last = manualPrice ?? live ?? eod;
      const value = last != null ? p.shares * last : null;
      // Passt der Kurs überhaupt zum Einstand? Eine falsch aufgelöste ISIN
      // erzeugt sonst lautlos eine Rendite von mehreren hundert Prozent.
      const heldYears = p.firstDate ? Math.max(0.2, dayDiff(p.firstDate, today) / 365.25) : 1;
      const mismatch = manualPrice ? null : priceMismatch(p.avgPrice, last, heldYears);
      const unreal = value != null ? value - p.costBasis : null;
      const unrealPct = value != null && p.costBasis > 0 ? value / p.costBasis - 1 : null;
      const dayPct = q?.changePct ?? null;
      const dayAbs =
        q && q.prevClose != null && last != null
          ? ((q.price - q.prevClose) / (q.prevClose || 1)) * (value ?? 0)
          : null;
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
        live: !!q,
      };
    });
  }, [openPositions, quotes, barsByTicker, hist, resolutions, meta, currency, fxNow]);

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
      const divCur = ((sym && hist[sym]?.currency) ?? "USD").toUpperCase();
      const conv = divCur === currency ? 1 : divCur === "USD" ? 1 / fxNow : 1;
      const tl = sharesTimeline(normTxns, t);
      let sum = 0;
      let psYear = 0;
      for (const raw of evs) {
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
  }, [keys, resolutions, hist, normTxns, rows, total, currency, fxNow]);

  // Aus dem Broker importierte Dividenden sind die Wahrheit; die Rekonstruktion
  // aus der Ausschüttungshistorie ist nur der Ersatz, wenn nichts importiert wurde.
  const bookedDividends = positions.reduce((a, p) => a + p.dividends, 0);
  const dividendsBooked = bookedDividends > 0;
  const dividendsTotal = dividendsBooked ? bookedDividends : divInfo.received;
  const gainTotal = unrealTotal + realizedTotal + dividendsTotal;
  // Bezugsgröße für die Gesamtrendite: was wirklich eingesetzt wurde.
  const gainBase = hasCashFlows && depositedNet > 0 ? depositedNet : costTotal;

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
      const divCur = ((sym && hist[sym]?.currency) ?? "USD").toUpperCase();
      const conv = divCur === currency ? 1 : divCur === "USD" ? 1 / fxNow : 1;
      const tl = sharesTimeline(normTxns, k);
      for (const e of evs) {
        if (e.date > today) continue;
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
  }, [normTxns, keys, resolutions, hist, meta, currency, fxNow]);

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
  const chartSeries: ChartSeries[] = useMemo(() => {
    if (seriesR.length < 2) return [];
    if (mode === "drawdown") {
      return [
        {
          key: "dd",
          label: "Rückgang vom Hoch",
          color: "#e11d48",
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
          color: "#4f46e5",
          fill: true,
          points: twrCurve(seriesR),
        },
      ];
      if (benchR.length > 1) {
        out.push({
          key: "bench",
          label: bench.label,
          color: "#64748b",
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
        color: "#4f46e5",
        fill: true,
        points: seriesR.map((p) => ({ date: p.date, value: p.value })),
      },
      {
        key: "invested",
        label: hasCashFlows ? "Netto eingezahlt" : "In Wertpapieren gebunden",
        color: "#94a3b8",
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
        color: "#0ea5e9",
        dashed: true,
        points: indexTo(benchR, seriesR[0].value).map((b) => ({ date: b.date, value: b.close })),
      });
    }
    return out;
  }, [seriesR, benchR, mode, bench.label, hasCashFlows]);

  // ── Aufteilungen ──────────────────────────────────────────────────────────
  const groupSegs = (pick: (t: string) => string, colors: Record<string, string>): Segment[] => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.value === null) continue;
      const k = pick(r.symbol ?? r.ticker);
      m.set(k, (m.get(k) ?? 0) + r.value);
    }
    return [...m.entries()].map(([label, value]) => ({
      label,
      value,
      color: colors[label] ?? "#cbd5e1",
    }));
  };

  const posSegs: Segment[] = rows
    .filter((r) => r.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .map((r, i) => ({ label: r.company, value: r.value as number, color: POS_COLORS[i % POS_COLORS.length] }));

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
    a.download = "outsider-depot.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const empty = txns.length === 0;

  return (
    <div className="space-y-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Mein Depot</h1>
            {liveCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                <span className="animate-live h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Live
              </span>
            )}
          </div>
          {!empty && (
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <LiveValue
                value={total}
                format={(v) => cMoney(v)}
                className="text-3xl font-semibold tracking-tight"
              />
              {dayPctSum != null && (
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    dayPctSum >= 0 ? "text-bull" : "text-bear"
                  }`}
                >
                  {dayAbsSum >= 0 ? "+" : "−"}
                  {cMoney(Math.abs(dayAbsSum))} ({pct2(dayPctSum)}) heute
                </span>
              )}
            </div>
          )}
          {empty && (
            <p className="text-sm text-subtle">
              Lade dein Portfolio hoch und vergleiche es mit den Star-Investoren und dem Markt.
              Gespeichert wird nur lokal in deinem Browser.
            </p>
          )}
        </div>
        {!empty && (
          <Pills options={TABS} value={tab} onChange={setTab} />
        )}
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
        <div className="rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 ring-1 ring-indigo-100">
          {msg}
        </div>
      )}

      {report && <ImportSummary report={report} onClose={() => setReport(null)} />}

      {!empty && loadingHist && Object.keys(hist).length === 0 && (
        <div className="lcard p-8 text-center text-sm text-subtle">Kurse werden geladen …</div>
      )}

      {!empty && (
        <>
          {/* ── Übersicht ───────────────────────────────────────────────── */}
          {tab === "overview" && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Kpi label="Depotwert" value={abbrevMoney(total || null)} sub={`${rows.length} Positionen`} />
                <Kpi
                  label="Gewinn gesamt"
                  value={signed(gainTotal)}
                  tone={tone(gainTotal)}
                  sub={
                    gainBase > 0
                      ? `${pct2(gainTotal / gainBase)} auf ${cAbbrev(gainBase)} ${
                          hasCashFlows ? "eingezahlt" : "Einstand"
                        }`
                      : undefined
                  }
                  hint="Kursgewinn der offenen Positionen + realisierte Gewinne + Dividenden"
                />
                <Kpi
                  label="Kursgewinn (offen)"
                  value={signed(unrealTotal)}
                  tone={tone(unrealTotal)}
                  sub={costTotal > 0 ? pct2(unrealTotal / costTotal) : undefined}
                />
                <Kpi label="Investiert" value={abbrevMoney(costTotal || null)} sub="Einstand offener Positionen" />
                <Kpi
                  label="Dividenden"
                  value={abbrevMoney(dividendsTotal || null)}
                  tone={dividendsTotal > 0 ? "bull" : null}
                  sub={dividendsBooked ? "laut deinen Buchungen" : "geschätzt"}
                />
                <Kpi
                  label="Realisiert"
                  value={signed(realizedTotal)}
                  tone={realizedTotal === 0 ? null : tone(realizedTotal)}
                  sub="aus Verkäufen"
                />
              </div>

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
                <div
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
                    perfPortfolio >= perfBench
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                  }`}
                >
                  {perfPortfolio >= perfBench
                    ? `Dein Depot schlägt den ${bench.label} um ${((perfPortfolio - perfBench) * 100).toFixed(1)} Prozentpunkte (${range}).`
                    : `Dein Depot liegt ${((perfBench - perfPortfolio) * 100).toFixed(1)} Prozentpunkte hinter dem ${bench.label} (${range}).`}{" "}
                  Du {pct(perfPortfolio)}, Index {pct(perfBench)}.
                </div>
              )}

              <TopMovers rows={rows} loading={liveCount === 0} />

              <div className="grid gap-4 lg:grid-cols-2">
                <AllocView segments={posSegs} total={total} title="Aufteilung nach Position" />
                <AllocView
                  segments={groupSegs((t) => assetMeta(t).sector, SECTOR_COLOR)}
                  total={total}
                  title="Aufteilung nach Sektor"
                 
                />
              </div>

              {assumedCount > 0 && <AssumedHint n={assumedCount} onGo={() => setTab("activity")} />}
              {noPrice > 0 && (
                <button
                  onClick={() => setTab("positions")}
                  className="press-sm w-full rounded-xl bg-slate-50 px-4 py-3 text-left text-sm text-subtle ring-1 ring-black/5 hover:bg-slate-100"
                >
                  <span className="font-semibold text-ink">
                    {noPrice} {noPrice === 1 ? "Position ohne Kurs" : "Positionen ohne Kurs"}
                  </span>{" "}
                  — Optionsscheine und Privatmarkt-Anteile. Kurs eintragen und mitzählen lassen ›
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
              <div className="lcard overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
                  <Pills
                    options={PERF_VIEWS}
                    value={perfView}
                    onChange={setPerfView}
                    size="sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Pills
                      options={BENCHMARKS.map((b) => [b.key, b.label] as const)}
                      value={bench.key}
                      onChange={(k) => setBenchIdx(BENCHMARKS.findIndex((b) => b.key === k))}
                      size="sm"
                    />
                    <Pills options={RANGES} value={range} onChange={setRange} size="sm" />
                  </div>
                </div>

                <div className="grid gap-px bg-hair p-px sm:grid-cols-3">
                  <BigStat
                    label="Zeitgewichtet"
                    value={perfPortfolio}
                    sub="Wie gut deine Auswahl war — unabhängig davon, wann du eingezahlt hast."
                  />
                  <BigStat
                    label="Geldgewichtet (IZF)"
                    value={izf}
                    sub="Was dein Geld tatsächlich verdient hat, inklusive Timing der Einzahlungen."
                  />
                  <BigStat
                    label={bench.label}
                    value={perfBench}
                    sub={
                      perfPortfolio != null && perfBench != null
                        ? `Du liegst ${Math.abs((perfPortfolio - perfBench) * 100).toFixed(1)} Punkte ${
                            perfPortfolio >= perfBench ? "davor" : "dahinter"
                          }.`
                        : "Gleicher Zeitraum, reine Kursentwicklung."
                    }
                    muted
                  />
                </div>
              </div>

              {/* ── Verlauf ─────────────────────────────────────────────── */}
              {perfView === "verlauf" && (
                <>
                  <div className="lcard p-5">
                    <div className="mb-1 text-sm font-semibold">Monatsrenditen</div>
                    <p className="mb-3 text-[11px] text-subtle">
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
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                    <Kpi label="Rendite p. a." value={pct(perfAnnual)} tone={tone(perfAnnual)} />
                    <Kpi
                      label="Volatilität p. a."
                      value={vol === null ? "—" : `${(vol * 100).toFixed(1)} %`}
                      hint="Schwankungsbreite der Tagesrenditen"
                    />
                    <Kpi
                      label="Sharpe Ratio"
                      value={shp === null ? "—" : shp.toFixed(2)}
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
                      value={mdd ? `${(mdd.dd * 100).toFixed(1)} %` : "—"}
                      tone={mdd ? "bear" : null}
                      sub={mdd ? `Tief am ${formatDate(mdd.date)}` : undefined}
                    />
                    <Kpi
                      label={`Beta zu ${bench.label}`}
                      value={bta === null ? "—" : bta.toFixed(2)}
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
                      value={corr === null ? "—" : corr.toFixed(2)}
                      hint="1,0 = läuft exakt parallel zum Index"
                    />
                    <Kpi
                      label="Positive Tage"
                      value={hit === null ? "—" : `${(hit * 100).toFixed(0)} %`}
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
                          color: "#e11d48",
                          fill: true,
                          points: drawdownSeries(seriesR).map((p) => ({ date: p.date, value: p.dd })),
                        },
                      ]}
                      height={190}
                      zeroLine
                      format={(v) => `${(v * 100).toFixed(1)} %`}
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
                          ? `${((feesTotal / depositedNet) * 100).toFixed(2)} % des eingesetzten Geldes`
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
                  segments={groupSegs((t) => assetMeta(t).sector, SECTOR_COLOR)}
                  total={total}
                  title="Nach Sektor"
                 
                />
                <AllocView
                  segments={groupSegs((t) => assetMeta(t).region, REGION_COLOR)}
                  total={total}
                  title="Nach Region"
                 
                />
                <AllocView
                  segments={groupSegs((t) => assetMeta(t).assetClass, ASSET_COLOR)}
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
                      text={`Größte Position unter 25 % (${((weights[0] ?? 0) * 100).toFixed(0)} %)`}
                    />
                    <Check ok={rows.length >= 10} text={`Mindestens 10 Positionen (${rows.length})`} />
                    <Check
                      ok={
                        groupSegs((t) => assetMeta(t).sector, SECTOR_COLOR).filter((s) => s.value > 0)
                          .length >= 4
                      }
                      text="Mindestens 4 Sektoren vertreten"
                    />
                    <Check
                      ok={
                        groupSegs((t) => assetMeta(t).region, REGION_COLOR).filter((s) => s.value > 0)
                          .length >= 2
                      }
                      text="Mehr als eine Region"
                    />
                    <Check
                      ok={mdd === null || mdd.dd > -0.35}
                      text={`Maximaler Rückgang unter 35 % (${mdd ? (mdd.dd * 100).toFixed(0) : "—"} %)`}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-subtle">
                Sektor und Region stammen aus einer gepflegten Liste der gängigsten Titel.
                Unbekannte Ticker landen bewusst in „Unbekannt“ statt geraten zu werden.
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
        Alles bleibt in deinem Browser. Keine Anmeldung, kein Server, keine Weitergabe.
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
    <div className="lcard p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pills
          options={[
            ["value", "Wertentwicklung"],
            ["return", "Rendite %"],
            ["drawdown", "Drawdown"],
          ] as const}
          value={mode}
          onChange={setMode}
          size="sm"
        />
        <div className="ml-auto flex flex-wrap gap-2">
          {mode !== "drawdown" && (
            <Pills
              options={BENCHMARKS.map((b) => [b.key, b.label] as const)}
              value={BENCHMARKS[benchIdx].key}
              onChange={(k) => setBenchIdx(BENCHMARKS.findIndex((b) => b.key === k))}
              size="sm"
            />
          )}
          <Pills options={RANGES} value={range} onChange={setRange} size="sm" />
        </div>
      </div>
      <DepotChart
        series={chartSeries}
        height={260}
        zeroLine={isPct}
        format={(v) => (isPct ? `${(v * 100).toFixed(2)} %` : usd(v))}
        formatAxis={(v) => (isPct ? `${(v * 100).toFixed(0)} %` : abbrevMoney(v))}
      />
      <p className="mt-2 text-[11px] text-subtle">
        {mode === "value"
          ? "Graue Treppe = netto zugeführtes Kapital. Der Abstand zur blauen Linie ist dein Gewinn."
          : mode === "return"
          ? "Zeitgewichtete Rendite — Ein- und Auszahlungen verzerren den Vergleich nicht."
          : "Rückgang vom jeweils höchsten Stand."}{" "}
        Fahr mit der Maus über den Chart (am Handy: wischen).
      </p>
    </div>
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
              href={r.symbol ? `/stock/${r.symbol}` : "/me"}
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

type SortKey = "value" | "gain" | "gainPct" | "day" | "name" | "weight";

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
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const val = (r: Row): number | string => {
      switch (sort) {
        case "name":
          return r.company;
        case "gain":
          return r.unreal ?? -Infinity;
        case "gainPct":
          return r.unrealPct ?? -Infinity;
        case "day":
          return r.dayPct ?? -Infinity;
        default:
          return r.value ?? -Infinity;
      }
    };
    const a = [...rows].sort((x, y) => {
      const vx = val(x);
      const vy = val(y);
      if (typeof vx === "string" || typeof vy === "string")
        return String(vx).localeCompare(String(vy));
      return vx - vy;
    });
    return desc ? a.reverse() : a;
  }, [rows, sort, desc]);

  const head: [SortKey, string, string][] = [
    ["name", "Position", "text-left"],
    ["value", "Wert", "text-right"],
    ["day", "Heute", "text-right hidden sm:table-cell"],
    ["gainPct", "Gewinn", "text-right"],
    ["weight", "Anteil", "text-right hidden md:table-cell"],
  ];

  return (
    <div className="space-y-3">
      <div className="lcard overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-subtle">
                {head.map(([key, label, cls]) => (
                  <th key={key} className={`px-4 py-2.5 font-medium ${cls}`}>
                    <button
                      onClick={() => {
                        if (sort === key) setDesc((d) => !d);
                        else {
                          setSort(key);
                          setDesc(key !== "name");
                        }
                      }}
                      className="press-sm inline-flex items-center gap-1 hover:text-ink"
                    >
                      {label}
                      {sort === key && <span className="text-[9px]">{desc ? "▼" : "▲"}</span>}
                    </button>
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const w = r.value != null && total > 0 ? (r.value / total) * 100 : null;
                return (
                  <tr key={r.ticker} className="border-b border-hair last:border-0 hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo ticker={r.symbol} company={r.company} size={34} />
                        <div className="min-w-0">
                          {r.symbol ? (
                            <Link
                              href={`/stock/${r.symbol}`}
                              className="block truncate font-medium hover:text-brand"
                            >
                              {r.company}
                            </Link>
                          ) : (
                            <div className="truncate font-medium">{r.company}</div>
                          )}
                          <div className="font-mono text-[11px] text-subtle">
                            {r.symbol ? fixTicker(r.symbol, r.company) : r.ticker} ·{" "}
                            {r.shares.toLocaleString("de-DE", { maximumFractionDigits: 4 })} St.
                            {r.avgPrice ? ` · Ø ${usd(r.avgPrice)}` : ""}
                          </div>
                          {r.manualPrice != null && (
                            <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-subtle">
                              Kurs manuell gesetzt
                            </span>
                          )}
                          {r.mismatch && (
                            <span
                              className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-subtle"
                              title={`${r.mismatch}. Vermutlich ist die ISIN einer falschen Börsennotierung zugeordnet.`}
                            >
                              Zuordnung prüfen · {r.mismatch}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold tabular-nums">
                        {r.value != null ? abbrevMoney(r.value) : "—"}
                      </div>
                      <div className="text-[11px] tabular-nums text-subtle">
                        {r.last != null ? usd(r.last) : "kein Kurs"}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-right sm:table-cell">
                      <div
                        className={`font-medium tabular-nums ${
                          r.dayPct === null ? "text-subtle" : r.dayPct >= 0 ? "text-bull" : "text-bear"
                        }`}
                      >
                        {pct2(r.dayPct)}
                      </div>
                      <div className="text-[11px] tabular-nums text-subtle">{signed(r.dayAbs)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div
                        className={`font-semibold tabular-nums ${
                          r.unrealPct === null ? "text-subtle" : r.unrealPct >= 0 ? "text-bull" : "text-bear"
                        }`}
                      >
                        {pct2(r.unrealPct)}
                      </div>
                      <div className="text-[11px] tabular-nums text-subtle">{signed(r.unreal)}</div>
                    </td>
                    <td className="hidden px-4 py-3 text-right md:table-cell">
                      <div className="font-medium tabular-nums">{w != null ? `${w.toFixed(1)} %` : "—"}</div>
                      <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${w ?? 0}%` }} />
                      </div>
                    </td>
                    <td className="pr-3 text-right">
                      <button
                        onClick={() => onRemove(r.ticker)}
                        aria-label="Position entfernen"
                        className="press-sm rounded-full px-1.5 text-slate-300 hover:text-bear"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-subtle">
                    Keine offenen Positionen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-subtle">
        „Gewinn“ zeigt den Kursgewinn der offenen Stücke gegenüber deinem Durchschnittseinstand.
        Realisierte Gewinne und Dividenden findest du unter Performance bzw. Dividenden.
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
                    isMe ? "bg-brand" : r >= 0 ? "bg-emerald-400" : "bg-rose-400"
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
          value={info.yieldNow ? `${(info.yieldNow * 100).toFixed(2)} %` : "—"}
          sub="auf aktuellen Kurs"
        />
        <Kpi
          label="Rendite auf Einstand"
          value={info.yieldOnCost ? `${(info.yieldOnCost * 100).toFixed(2)} %` : "—"}
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
        <div className="lcard overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hair text-[11px] uppercase tracking-wide text-subtle">
                  <th className="px-4 py-2.5 text-left font-medium">Position</th>
                  <th className="px-4 py-2.5 text-right font-medium">Erhalten</th>
                  <th className="px-4 py-2.5 text-right font-medium">Erwartet / Jahr</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Rendite</th>
                  <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Auf Einstand</th>
                </tr>
              </thead>
              <tbody>
                {info.perPos.map((p) => (
                  <tr key={p.ticker} className="border-b border-hair last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <CompanyLogo ticker={p.symbol} company={p.company} size={30} />
                        <span className="truncate font-medium">{p.company}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {p.received > 0 ? abbrevMoney(p.received) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-bull">
                      {p.annual > 0 ? abbrevMoney(p.annual) : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                      {p.yieldNow ? `${(p.yieldNow * 100).toFixed(2)} %` : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-right tabular-nums md:table-cell">
                      {p.yieldOnCost ? `${(p.yieldOnCost * 100).toFixed(2)} %` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
                <span className="font-mono text-[11px] text-subtle">{x.ticker}</span>
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
    buy: "bg-emerald-50 text-emerald-700",
    sell: "bg-rose-50 text-rose-700",
    dividend: "bg-sky-50 text-sky-700",
    deposit: "bg-slate-100 text-slate-600",
    withdrawal: "bg-slate-100 text-slate-600",
    interest: "bg-amber-50 text-amber-700",
    split: "bg-violet-50 text-violet-700",
  };

  const inputCls =
    "rounded-full border border-hair bg-white px-3.5 py-1.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="space-y-4">
      <div className="lcard p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Transaktion erfassen</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={onImport} className="btn-primary">
              CSV importieren
            </button>
            <button
              onClick={onExport}
              className="press-sm rounded-full bg-slate-100 px-4 py-2 text-sm font-medium hover:bg-slate-200"
            >
              Exportieren
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <Pills
            options={(["buy", "sell", "dividend", "deposit", "withdrawal"] as const).map(
              (k) => [k, label[k]] as const,
            )}
            value={kind}
            onChange={setKind}
            size="sm"
          />
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="Datum (17.03.2022)"
            className={`w-44 ${inputCls}`}
          />
          {needsTicker && (
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Ticker"
              className={`w-32 ${inputCls}`}
            />
          )}
          {needsShares ? (
            <>
              <input
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="Stück"
                className={`w-24 ${inputCls}`}
              />
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Kurs $"
                className={`w-28 ${inputCls}`}
              />
            </>
          ) : (
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Betrag $"
              className={`w-32 ${inputCls}`}
            />
          )}
          <input
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            placeholder="Gebühr"
            className={`w-24 ${inputCls}`}
          />
          <button className="press-sm rounded-full bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800">
            Hinzufügen
          </button>
        </form>
        <p className="mt-2 text-[11px] text-subtle">
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
            <div key={t.id} className="flex items-center gap-3 border-b border-hair px-5 py-2.5 last:border-0">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge[t.kind]}`}>
                {label[t.kind]}
              </span>
              <span className="w-24 shrink-0 text-xs text-subtle">
                {t.date ? formatDate(t.date) : "ohne Datum"}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {t.name || t.ticker || "—"}
                {t.name && t.ticker && (
                  <span className="ml-1.5 font-mono text-[11px] text-subtle">{t.ticker}</span>
                )}
              </span>
              <span className="text-right text-sm tabular-nums">
                {t.kind === "buy" || t.kind === "sell"
                  ? `${t.shares.toLocaleString("de-DE", { maximumFractionDigits: 4 })} × ${usd(t.price)}`
                  : t.kind === "split"
                  ? `${t.shares > 0 ? "+" : ""}${t.shares.toLocaleString("de-DE", { maximumFractionDigits: 4 })} St.`
                  : usd(t.amount)}
              </span>
              <button
                onClick={() => removeTxn(t.id)}
                aria-label="Buchung löschen"
                className="press-sm shrink-0 rounded-full px-1.5 text-slate-300 hover:text-bear"
              >
                ✕
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
  const weightWith = (m: MatchRow) => {
    if (total <= 0) return null;
    const w = rows
      .filter((r) => m.sharedTickers.includes(r.ticker.toUpperCase()))
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
                  {uw != null ? `${(uw * 100).toFixed(0)} %` : "—"}
                </div>
                <div className="text-[11px] text-subtle">deines Depots</div>
              </div>
              <span className="text-slate-300">›</span>
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
          className="press-sm shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-sm text-subtle hover:bg-slate-200"
        >
          ✕
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
              <div className="font-mono text-[11px] text-subtle">
                {r.ticker} · {r.shares.toLocaleString("de-DE", { maximumFractionDigits: 4 })} St. ·
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
                  className="w-40 rounded-full border border-hair bg-white px-3 py-1 text-sm outline-none focus:border-brand"
                />
                <button
                  onClick={() => saveManual(r)}
                  className="press-sm rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800"
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
                  className="w-36 rounded-full border border-hair bg-white px-3 py-1 text-sm outline-none focus:border-brand"
                />
                <button
                  onClick={() => {
                    const v = (draft[r.ticker] ?? "").trim().toUpperCase();
                    if (v && SYMBOL_RE.test(v)) setUserSymbol(r.ticker, v);
                  }}
                  className="press-sm rounded-full bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-800"
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
              ✕
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
}: {
  label: string;
  value: number | null;
  sub: string;
  muted?: boolean;
}) {
  return (
    <div className="bg-card p-5">
      <div className="text-xs text-subtle">{label}</div>
      <div
        className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${
          value === null ? "" : muted ? "text-ink" : value >= 0 ? "text-bull" : "text-bear"
        }`}
      >
        {value === null ? (
          "—"
        ) : (
          <CountUp to={value * 100} format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)} %`} />
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-subtle">{sub}</p>
    </div>
  );
}

function AssumedHint({ n, onGo }: { n: number; onGo: () => void }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-subtle ring-1 ring-black/5">
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
          ok ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        {ok ? "✓" : "·"}
      </span>
      <span className={ok ? "text-subtle" : "text-ink"}>{text}</span>
    </div>
  );
}
