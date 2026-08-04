// ────────────────────────────────────────────────────────────────────────────
// Depot-Engine: Transaktionen, Positionen und Rendite-Mathematik.
//
// Alles läuft lokal im Browser (localStorage) — kein Konto, keine Server.
// Das Modell ist transaktionsbasiert (wie getquin/parqet), damit wir echte
// Kennzahlen rechnen können: zeitgewichtete Rendite, IZF, Drawdown, realisierte
// Gewinne, Dividenden.
// ────────────────────────────────────────────────────────────────────────────

export type TxnKind = "buy" | "sell" | "dividend" | "deposit" | "withdrawal";

export interface Txn {
  id: string;
  kind: TxnKind;
  /** YYYY-MM-DD. Leer = "Bestand ohne Kaufdatum" (Alt-Import). */
  date: string;
  /** Leer bei deposit/withdrawal. */
  ticker: string;
  /** Stückzahl bei buy/sell. */
  shares: number;
  /** Kurs je Stück (USD) bei buy/sell. */
  price: number;
  /** Gesamtbetrag (USD) bei dividend/deposit/withdrawal. */
  amount: number;
  /** Ordergebühr (USD). */
  fee: number;
}

const KEY = "outsider:txns:v2";
const LEGACY_KEY = "outsider:mydepot";
export const EVENT = "mydepot";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function makeTxn(p: Partial<Txn> & { kind: TxnKind }): Txn {
  return {
    id: p.id ?? newId(),
    kind: p.kind,
    date: p.date ?? "",
    ticker: (p.ticker ?? "").toUpperCase(),
    shares: p.shares ?? 0,
    price: p.price ?? 0,
    amount: p.amount ?? 0,
    fee: p.fee ?? 0,
  };
}

// ── Speicher ────────────────────────────────────────────────────────────────

function readRaw(): Txn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "null");
    if (Array.isArray(raw)) return raw.filter(isTxn);
  } catch {
    /* fällt unten auf die Migration zurück */
  }
  return migrateLegacy();
}

function isTxn(t: unknown): t is Txn {
  if (!t || typeof t !== "object") return false;
  const x = t as Partial<Txn>;
  return typeof x.id === "string" && typeof x.kind === "string";
}

/** Alte Struktur ({ticker, shares, buyPrice}[]) → Kauf-Transaktionen ohne Datum. */
function migrateLegacy(): Txn[] {
  if (typeof window === "undefined") return [];
  try {
    const old = JSON.parse(window.localStorage.getItem(LEGACY_KEY) || "[]");
    if (!Array.isArray(old) || old.length === 0) return [];
    const txns = old
      .filter((h) => h && h.ticker && h.shares > 0)
      .map((h) =>
        makeTxn({
          kind: "buy",
          ticker: String(h.ticker).toUpperCase(),
          shares: Number(h.shares),
          price: Number(h.buyPrice) > 0 ? Number(h.buyPrice) : 0,
          date: "",
        }),
      );
    if (txns.length) window.localStorage.setItem(KEY, JSON.stringify(txns));
    return txns;
  } catch {
    return [];
  }
}

export function getTxns(): Txn[] {
  return sortTxns(readRaw());
}

function write(t: Txn[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(t));
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function setTxns(t: Txn[]) {
  write(sortTxns(t));
}

export function addTxn(t: Txn) {
  write(sortTxns([...readRaw(), t]));
}

export function addTxns(list: Txn[]) {
  write(sortTxns([...readRaw(), ...list]));
}

export function removeTxn(id: string) {
  write(readRaw().filter((t) => t.id !== id));
}

/** Entfernt alle Transaktionen einer Position. */
export function removeTicker(ticker: string) {
  const T = ticker.toUpperCase();
  write(readRaw().filter((t) => t.ticker !== T));
}

export function clearTxns() {
  write([]);
  if (typeof window !== "undefined") window.localStorage.removeItem(LEGACY_KEY);
}

/** Undatierte zuerst (sie gelten als "seit Beginn gehalten"), dann chronologisch. */
export function sortTxns(t: Txn[]): Txn[] {
  return [...t].sort((a, b) => (a.date || "0").localeCompare(b.date || "0") || a.id.localeCompare(b.id));
}

// ── Zahlen- und CSV-Parsing ─────────────────────────────────────────────────

/** Tolerant: "1.234,56" | "1,234.56" | "1234.56" | "1234" | "$12" */
export function parseNum(s: string | number | undefined | null): number {
  if (typeof s === "number") return s;
  const t = String(s ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/[$€£']/g, "");
  if (!t) return NaN;
  const hasComma = t.includes(",");
  const hasDot = t.includes(".");
  if (hasComma && hasDot) {
    // Das letzte Trennzeichen ist das Dezimaltrennzeichen.
    return t.lastIndexOf(",") > t.lastIndexOf(".")
      ? parseFloat(t.replace(/\./g, "").replace(",", "."))
      : parseFloat(t.replace(/,/g, ""));
  }
  if (hasComma) {
    // "1,234" mit exakt 3 Nachkommastellen ist fast immer ein Tausendertrenner.
    const parts = t.split(",");
    if (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3) {
      return parseFloat(t.replace(",", ""));
    }
    return parseFloat(t.replace(",", "."));
  }
  return parseFloat(t);
}

/** Akzeptiert 2026-01-27, 27.01.2026, 27/01/2026, 01/27/2026 → YYYY-MM-DD */
export function parseDate(s: string | undefined | null): string {
  const t = String(s ?? "").trim().slice(0, 24);
  if (!t) return "";
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    // >12 im ersten Feld ⇒ Tag zuerst, sonst US-Format (Monat zuerst).
    const [, a, b, y] = m;
    const [dd, mm] = Number(a) > 12 ? [a, b] : [b, a];
    return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,7}$/;

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === sep && !q) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((c) => c.trim().replace(/^"|"$/g, ""));
}

function detectSep(line: string): string {
  for (const s of [";", "\t", ","]) if (line.includes(s)) return s;
  return ",";
}

const HEADER_ALIASES: Record<string, string[]> = {
  ticker: ["ticker", "symbol", "wertpapier", "aktie", "isin", "wkn", "name", "titel", "asset"],
  kind: ["typ", "type", "art", "aktion", "action", "transaktion", "seite", "side", "kind"],
  date: ["datum", "date", "kaufdatum", "handelsdatum", "zeitpunkt", "tag"],
  shares: ["anzahl", "stück", "stueck", "stk", "shares", "menge", "quantity", "qty", "nominal"],
  price: ["kurs", "preis", "price", "kaufpreis", "einstand", "stückpreis", "stueckpreis"],
  amount: ["betrag", "amount", "summe", "wert", "total", "gesamt", "dividende"],
  fee: ["gebühr", "gebuehr", "fee", "fees", "kosten", "provision", "courtage"],
};

function headerIndex(cols: string[]): Record<string, number> | null {
  const idx: Record<string, number> = {};
  const low = cols.map((c) => c.toLowerCase().replace(/[^a-zäöüß]/g, ""));
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const i = low.findIndex((c) => c && aliases.some((a) => c === a.replace(/[^a-zäöüß]/g, "")));
    if (i >= 0) idx[field] = i;
  }
  // Als Kopfzeile gilt sie nur, wenn Wertpapier + (Stück oder Betrag) erkannt wurden.
  if (idx.ticker === undefined) return null;
  if (idx.shares === undefined && idx.amount === undefined) return null;
  return idx;
}

const KIND_WORDS: [RegExp, TxnKind][] = [
  [/^(kauf|buy|purchase|k)$/i, "buy"],
  [/^(verkauf|sell|sale|v)$/i, "sell"],
  [/^(dividende|dividend|div|ausschüttung|ausschuettung)$/i, "dividend"],
  [/^(einzahlung|deposit|einlage)$/i, "deposit"],
  [/^(auszahlung|withdrawal|entnahme)$/i, "withdrawal"],
];

function parseKind(s: string | undefined): TxnKind | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  for (const [re, k] of KIND_WORDS) if (re.test(t)) return k;
  return null;
}

export interface ImportResult {
  txns: Txn[];
  skipped: number;
  dated: number;
  format: "transaktionen" | "bestände";
}

/**
 * Importiert sowohl eine reine Bestandsliste (TICKER,Anzahl[,Kaufpreis]) als
 * auch eine vollständige Transaktionsliste mit Kopfzeile.
 */
export function parseCsv(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { txns: [], skipped: 0, dated: 0, format: "bestände" };

  const sep = detectSep(lines[0]);
  const head = headerIndex(splitLine(lines[0], sep));
  const txns: Txn[] = [];
  let skipped = 0;
  let dated = 0;

  for (let i = head ? 1 : 0; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep);
    if (cols.length === 0 || !cols.some((c) => c)) continue;

    const at = (f: string, fallback: number) =>
      head && head[f] !== undefined ? cols[head[f]] : cols[fallback];

    const rawTicker = (at("ticker", 0) || "").toUpperCase().split(/\s/)[0];
    const kind = parseKind(at("kind", -1)) ?? "buy";

    if (kind === "deposit" || kind === "withdrawal") {
      const amount = Math.abs(parseNum(at("amount", 2)));
      const date = parseDate(at("date", 1));
      if (!Number.isFinite(amount) || amount <= 0) {
        skipped++;
        continue;
      }
      if (date) dated++;
      txns.push(makeTxn({ kind, date, amount }));
      continue;
    }

    if (!TICKER_RE.test(rawTicker)) {
      skipped++;
      continue;
    }

    const date = parseDate(at("date", -1));
    const fee = Math.abs(parseNum(at("fee", -1))) || 0;

    if (kind === "dividend") {
      const amount = Math.abs(parseNum(at("amount", 2)));
      if (!Number.isFinite(amount) || amount <= 0) {
        skipped++;
        continue;
      }
      if (date) dated++;
      txns.push(makeTxn({ kind, ticker: rawTicker, date, amount, fee }));
      continue;
    }

    const shares = Math.abs(parseNum(at("shares", 1)));
    if (!Number.isFinite(shares) || shares <= 0) {
      skipped++;
      continue;
    }
    let pricev = parseNum(at("price", 2));
    if (!Number.isFinite(pricev) || pricev < 0) {
      // Kein Stückpreis, aber ein Gesamtbetrag? Dann daraus ableiten.
      const amt = parseNum(at("amount", -1));
      pricev = Number.isFinite(amt) && amt > 0 ? Math.abs(amt) / shares : 0;
    }
    if (date) dated++;
    txns.push(makeTxn({ kind, ticker: rawTicker, date, shares, price: pricev, fee }));
  }

  return {
    txns,
    skipped,
    dated,
    format: head && (head.kind !== undefined || head.date !== undefined) ? "transaktionen" : "bestände",
  };
}

export function toCsv(txns: Txn[]): string {
  const head = "Typ;Datum;Ticker;Anzahl;Kurs;Betrag;Gebuehr";
  const label: Record<TxnKind, string> = {
    buy: "Kauf",
    sell: "Verkauf",
    dividend: "Dividende",
    deposit: "Einzahlung",
    withdrawal: "Auszahlung",
  };
  const rows = txns.map((t) =>
    [
      label[t.kind],
      t.date,
      t.ticker,
      t.shares || "",
      t.price || "",
      t.amount || "",
      t.fee || "",
    ].join(";"),
  );
  return [head, ...rows].join("\n") + "\n";
}

// ── Positionen ──────────────────────────────────────────────────────────────

export interface Position {
  ticker: string;
  /** Aktuell gehaltene Stückzahl. */
  shares: number;
  /** Buchwert der offenen Stücke (Durchschnittskosten inkl. Gebühren). */
  costBasis: number;
  /** Durchschnittlicher Einstand je Stück. */
  avgPrice: number | null;
  /** Realisierter Gewinn aus Verkäufen. */
  realized: number;
  /** Erhaltene Dividenden. */
  dividends: number;
  /** Summe aller Gebühren. */
  fees: number;
  /** Gesamt gekaufte / verkaufte Stückzahl. */
  bought: number;
  sold: number;
  firstDate: string;
  lastDate: string;
  /** true, wenn mindestens ein Kauf ohne Datum importiert wurde. */
  assumed: boolean;
}

/** Durchschnittskosten-Methode (Standard bei getquin/parqet). */
export function positionsFrom(txns: Txn[]): Position[] {
  const map = new Map<string, Position>();
  const get = (t: string): Position => {
    let p = map.get(t);
    if (!p) {
      p = {
        ticker: t,
        shares: 0,
        costBasis: 0,
        avgPrice: null,
        realized: 0,
        dividends: 0,
        fees: 0,
        bought: 0,
        sold: 0,
        firstDate: "",
        lastDate: "",
        assumed: false,
      };
      map.set(t, p);
    }
    return p;
  };

  for (const t of sortTxns(txns)) {
    if (!t.ticker) continue;
    const p = get(t.ticker);
    if (t.date) {
      if (!p.firstDate || t.date < p.firstDate) p.firstDate = t.date;
      if (t.date > p.lastDate) p.lastDate = t.date;
    } else p.assumed = true;

    if (t.kind === "buy") {
      p.shares += t.shares;
      p.costBasis += t.shares * t.price + t.fee;
      p.bought += t.shares;
      p.fees += t.fee;
    } else if (t.kind === "sell") {
      const avg = p.shares > 0 ? p.costBasis / p.shares : t.price;
      const sold = Math.min(t.shares, p.shares);
      p.realized += sold * (t.price - avg) - t.fee;
      p.costBasis = Math.max(0, p.costBasis - sold * avg);
      p.shares = Math.max(0, p.shares - sold);
      p.sold += sold;
      p.fees += t.fee;
    } else if (t.kind === "dividend") {
      p.dividends += t.amount;
      p.fees += t.fee;
    }
    p.avgPrice = p.shares > 0 ? p.costBasis / p.shares : null;
  }

  return [...map.values()];
}

/** Gehaltene Stückzahl je Ticker an einem Stichtag (undatiertes gilt als "immer gehalten"). */
export function sharesOn(txns: Txn[], date: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of sortTxns(txns)) {
    if (!t.ticker || (t.kind !== "buy" && t.kind !== "sell")) continue;
    if (t.date && t.date > date) continue;
    const cur = out.get(t.ticker) ?? 0;
    out.set(t.ticker, t.kind === "buy" ? cur + t.shares : Math.max(0, cur - t.shares));
  }
  return out;
}

// ── Zeitreihen ──────────────────────────────────────────────────────────────

export interface Bar {
  date: string;
  close: number;
}

export interface SeriesPoint {
  date: string;
  /** Kurswert aller Positionen. */
  value: number;
  /** Netto zugeführtes Kapital (Käufe − Verkäufe, kumuliert). */
  invested: number;
  /** Kumulierte Dividenden bis zu diesem Tag. */
  dividends: number;
  /** Externer Netto-Zufluss an genau diesem Tag (Käufe − Verkäufe). */
  flow: number;
}

/**
 * Tägliche Depot-Zeitreihe. Kurse werden vorwärts fortgeschrieben, damit auch
 * Positionen ohne Kurs an jedem Handelstag sauber mitlaufen.
 */
export function buildSeries(
  txns: Txn[],
  barsByTicker: Record<string, Bar[] | null | undefined>,
): SeriesPoint[] {
  const usable = Object.entries(barsByTicker).filter(
    (e): e is [string, Bar[]] => Array.isArray(e[1]) && e[1].length > 1,
  );
  if (usable.length === 0) return [];

  const firstBar = new Map(usable.map(([t, b]) => [t, b[0].date]));
  const earliestBar = [...firstBar.values()].reduce((a, d) => (d < a ? d : a), "9999-12-31");

  // Startdatum der Reihe:
  //  • Gibt es Bestände ohne Kaufdatum, sind sie "seit jeher" im Depot — dann
  //    kann die Reihe erst beginnen, wenn für alle davon Kurse vorliegen.
  //  • Sonst startet sie mit der ersten datierten Transaktion, denn davor war
  //    das Depot schlicht leer.
  const dayZero = [...new Set(txns.filter((t) => !t.date && t.ticker).map((t) => t.ticker))].filter(
    (t) => firstBar.has(t),
  );
  const datedDates = txns.filter((t) => t.date).map((t) => t.date);
  let start: string;
  if (dayZero.length > 0) {
    start = dayZero.map((t) => firstBar.get(t) as string).reduce((a, d) => (d > a ? d : a));
  } else if (datedDates.length > 0) {
    start = datedDates.reduce((a, d) => (d < a ? d : a));
  } else {
    start = earliestBar;
  }
  if (start < earliestBar) start = earliestBar;

  const dates = [...new Set(usable.flatMap(([, b]) => b.map((x) => x.date)))]
    .filter((d) => d >= start)
    .sort();
  if (dates.length === 0) return [];

  const closes = new Map<string, number>();
  const cursor = new Map<string, number>();
  const shares = new Map<string, number>();
  const sorted = sortTxns(txns);
  let ti = 0;
  let invested = 0;
  let dividends = 0;

  // Undatierte Transaktionen gelten ab dem ersten Tag der Reihe.
  for (const t of sorted) {
    if (t.date) break;
    ti++;
    if (t.kind === "buy" && t.ticker) {
      shares.set(t.ticker, (shares.get(t.ticker) ?? 0) + t.shares);
      invested += t.shares * t.price + t.fee;
    } else if (t.kind === "sell" && t.ticker) {
      shares.set(t.ticker, Math.max(0, (shares.get(t.ticker) ?? 0) - t.shares));
      invested -= t.shares * t.price - t.fee;
    } else if (t.kind === "dividend") dividends += t.amount;
  }

  const out: SeriesPoint[] = [];
  for (const d of dates) {
    // Kurse bis einschließlich d fortschreiben
    for (const [tk, bars] of usable) {
      let i = cursor.get(tk) ?? 0;
      while (i < bars.length && bars[i].date <= d) {
        closes.set(tk, bars[i].close);
        i++;
      }
      cursor.set(tk, i);
    }
    // Transaktionen dieses Tages verbuchen
    let flow = 0;
    while (ti < sorted.length && sorted[ti].date && sorted[ti].date <= d) {
      const t = sorted[ti++];
      if (t.kind === "buy" && t.ticker) {
        shares.set(t.ticker, (shares.get(t.ticker) ?? 0) + t.shares);
        const c = t.shares * t.price + t.fee;
        invested += c;
        flow += c;
      } else if (t.kind === "sell" && t.ticker) {
        shares.set(t.ticker, Math.max(0, (shares.get(t.ticker) ?? 0) - t.shares));
        const c = t.shares * t.price - t.fee;
        invested -= c;
        flow -= c;
      } else if (t.kind === "dividend") dividends += t.amount;
    }

    let value = 0;
    for (const [tk, s] of shares) {
      if (s <= 0) continue;
      const c = closes.get(tk);
      if (c !== undefined) value += s * c;
    }
    out.push({ date: d, value, invested, dividends, flow });
  }
  return out;
}

// ── Rendite-Kennzahlen ──────────────────────────────────────────────────────

/**
 * Tägliche zeitgewichtete Renditen. Externe Zahlungsströme werden neutralisiert,
 * Dividenden zählen als Ertrag (Gesamtrendite).
 */
export function dailyReturns(series: SeriesPoint[]): { date: string; r: number }[] {
  const out: { date: string; r: number }[] = [];
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1];
    const cur = series[i];
    const base = prev.value;
    if (base <= 0) continue;
    const divGain = cur.dividends - prev.dividends;
    const r = (cur.value - cur.flow + divGain - base) / base;
    if (Number.isFinite(r) && r > -0.99 && r < 5) out.push({ date: cur.date, r });
  }
  return out;
}

/** TTWROR — die "echte" Rendite des Depots, unabhängig vom Zahlungszeitpunkt. */
export function twr(series: SeriesPoint[]): number | null {
  const rets = dailyReturns(series);
  if (rets.length === 0) return null;
  let f = 1;
  for (const { r } of rets) f *= 1 + r;
  return f - 1;
}

/** Auf ein Jahr hochgerechnete zeitgewichtete Rendite. */
export function twrAnnualized(series: SeriesPoint[]): number | null {
  const t = twr(series);
  if (t === null || series.length < 2) return null;
  const years = dayDiff(series[0].date, series[series.length - 1].date) / 365.25;
  if (years <= 0.08) return null; // unter ~1 Monat ist eine Hochrechnung Unsinn
  return Math.pow(1 + t, 1 / years) - 1;
}

export function dayDiff(a: string, b: string): number {
  return (Date.parse(b) - Date.parse(a)) / 86_400_000;
}

export interface Flow {
  date: string;
  amount: number;
}

/** Zahlungsströme aus Sicht des Anlegers: Kauf = negativ, Verkauf/Dividende = positiv. */
export function cashFlows(txns: Txn[], fallbackDate: string): Flow[] {
  const out: Flow[] = [];
  for (const t of sortTxns(txns)) {
    const date = t.date || fallbackDate;
    if (!date) continue;
    if (t.kind === "buy") out.push({ date, amount: -(t.shares * t.price + t.fee) });
    else if (t.kind === "sell") out.push({ date, amount: t.shares * t.price - t.fee });
    else if (t.kind === "dividend") out.push({ date, amount: t.amount - t.fee });
  }
  return out.filter((f) => Number.isFinite(f.amount) && f.amount !== 0);
}

/**
 * IZF (interner Zinsfuß / geldgewichtete Rendite). Robuste Bisektion — kein
 * Newton-Verfahren, das bei unregelmäßigen Sparplänen gern wegdriftet.
 */
export function xirr(flows: Flow[]): number | null {
  if (flows.length < 2) return null;
  const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  const hasNeg = sorted.some((f) => f.amount < 0);
  const hasPos = sorted.some((f) => f.amount > 0);
  if (!hasNeg || !hasPos) return null;

  const t0 = Date.parse(sorted[0].date);
  const yrs = sorted.map((f) => (Date.parse(f.date) - t0) / (365.25 * 86_400_000));
  const npv = (r: number) => {
    let s = 0;
    for (let i = 0; i < sorted.length; i++) {
      const d = Math.pow(1 + r, yrs[i]);
      if (!Number.isFinite(d) || d === 0) return NaN;
      s += sorted[i].amount / d;
    }
    return s;
  };

  let lo = -0.9999;
  let hi = 10;
  let flo = npv(lo);
  let fhi = npv(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 240; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (!Number.isFinite(fm)) return null;
    if (Math.abs(fm) < 1e-9) return mid;
    if (flo * fm <= 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export interface DrawdownPoint {
  date: string;
  dd: number; // ≤ 0
}

/** Rückgang vom bisherigen Höchststand — auf Basis der zeitgewichteten Kurve. */
export function drawdownSeries(series: SeriesPoint[]): DrawdownPoint[] {
  const rets = dailyReturns(series);
  if (rets.length === 0) return [];
  let idx = 1;
  let peak = 1;
  const out: DrawdownPoint[] = [];
  for (const { date, r } of rets) {
    idx *= 1 + r;
    if (idx > peak) peak = idx;
    out.push({ date, dd: peak > 0 ? idx / peak - 1 : 0 });
  }
  return out;
}

export function maxDrawdown(series: SeriesPoint[]): { dd: number; date: string } | null {
  const dds = drawdownSeries(series);
  if (dds.length === 0) return null;
  let worst = dds[0];
  for (const p of dds) if (p.dd < worst.dd) worst = p;
  return { dd: worst.dd, date: worst.date };
}

/** Annualisierte Volatilität (Standardabweichung der Tagesrenditen × √252). */
export function volatility(series: SeriesPoint[]): number | null {
  const r = dailyReturns(series).map((x) => x.r);
  if (r.length < 20) return null;
  const m = r.reduce((a, x) => a + x, 0) / r.length;
  const v = r.reduce((a, x) => a + (x - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(v) * Math.sqrt(252);
}

/** Sharpe Ratio gegen einen risikofreien Zins (Standard 3 %). */
export function sharpe(series: SeriesPoint[], riskFree = 0.03): number | null {
  const vol = volatility(series);
  const ann = twrAnnualized(series);
  if (vol === null || ann === null || vol === 0) return null;
  return (ann - riskFree) / vol;
}

function alignReturns(
  a: { date: string; r: number }[],
  b: { date: string; r: number }[],
): [number[], number[]] {
  const mb = new Map(b.map((x) => [x.date, x.r]));
  const xa: number[] = [];
  const xb: number[] = [];
  for (const p of a) {
    const q = mb.get(p.date);
    if (q !== undefined) {
      xa.push(p.r);
      xb.push(q);
    }
  }
  return [xa, xb];
}

function barsToReturns(bars: Bar[]): { date: string; r: number }[] {
  const out: { date: string; r: number }[] = [];
  for (let i = 1; i < bars.length; i++) {
    const p = bars[i - 1].close;
    if (p > 0) out.push({ date: bars[i].date, r: bars[i].close / p - 1 });
  }
  return out;
}

/** Beta: wie stark das Depot auf Marktbewegungen reagiert (1 = wie der Index). */
export function beta(series: SeriesPoint[], bench: Bar[]): number | null {
  const [p, m] = alignReturns(dailyReturns(series), barsToReturns(bench));
  if (p.length < 20) return null;
  const mp = p.reduce((a, x) => a + x, 0) / p.length;
  const mm = m.reduce((a, x) => a + x, 0) / m.length;
  let cov = 0;
  let varm = 0;
  for (let i = 0; i < p.length; i++) {
    cov += (p[i] - mp) * (m[i] - mm);
    varm += (m[i] - mm) ** 2;
  }
  return varm > 0 ? cov / varm : null;
}

/** Korrelation zum Benchmark (−1 … 1). */
export function correlation(series: SeriesPoint[], bench: Bar[]): number | null {
  const [p, m] = alignReturns(dailyReturns(series), barsToReturns(bench));
  if (p.length < 20) return null;
  const mp = p.reduce((a, x) => a + x, 0) / p.length;
  const mm = m.reduce((a, x) => a + x, 0) / m.length;
  let cov = 0;
  let vp = 0;
  let vm = 0;
  for (let i = 0; i < p.length; i++) {
    cov += (p[i] - mp) * (m[i] - mm);
    vp += (p[i] - mp) ** 2;
    vm += (m[i] - mm) ** 2;
  }
  return vp > 0 && vm > 0 ? cov / Math.sqrt(vp * vm) : null;
}

/** Anteil der Tage mit positiver Rendite. */
export function hitRate(series: SeriesPoint[]): number | null {
  const r = dailyReturns(series);
  if (r.length < 20) return null;
  return r.filter((x) => x.r > 0).length / r.length;
}

/** Bester / schlechtester Tag. */
export function extremeDays(series: SeriesPoint[]) {
  const r = dailyReturns(series);
  if (r.length === 0) return null;
  let best = r[0];
  let worst = r[0];
  for (const x of r) {
    if (x.r > best.r) best = x;
    if (x.r < worst.r) worst = x;
  }
  return { best, worst };
}

export interface PeriodReturn {
  key: string; // "2026" oder "2026-03"
  r: number;
}

function chainByKey(
  rets: { date: string; r: number }[],
  keyOf: (d: string) => string,
): PeriodReturn[] {
  const acc = new Map<string, number>();
  for (const { date, r } of rets) {
    const k = keyOf(date);
    acc.set(k, (acc.get(k) ?? 1) * (1 + r));
  }
  return [...acc.entries()].map(([key, f]) => ({ key, r: f - 1 })).sort((a, b) => a.key.localeCompare(b.key));
}

export function annualReturns(series: SeriesPoint[]): PeriodReturn[] {
  return chainByKey(dailyReturns(series), (d) => d.slice(0, 4));
}

export function monthlyReturns(series: SeriesPoint[]): PeriodReturn[] {
  return chainByKey(dailyReturns(series), (d) => d.slice(0, 7));
}

/** Benchmark auf denselben Zeitraum & Startwert normiert (für Vergleichscharts). */
export function indexTo(bars: Bar[], base: number): Bar[] {
  if (bars.length === 0 || bars[0].close === 0) return [];
  const f = base / bars[0].close;
  return bars.map((b) => ({ date: b.date, close: b.close * f }));
}

export function sliceFrom(bars: Bar[], startDate: string): Bar[] {
  return bars.filter((b) => b.date >= startDate);
}

/** Rendite einer einfachen Kursreihe über den ganzen Zeitraum. */
export function seriesReturn(bars: Bar[]): number | null {
  if (bars.length < 2 || bars[0].close === 0) return null;
  return bars[bars.length - 1].close / bars[0].close - 1;
}
