// ────────────────────────────────────────────────────────────────────────────
// Broker-Import.
//
// Ein Transaktionsexport ist kein simples "Ticker,Stück"-Blatt: Trade Republic,
// Parqet & Co. mischen Wertpapiergeschäfte, Kartenzahlungen, Zinsen, Splits und
// Depotüberträge in eine Datei. Wer das nicht auseinandersortiert, bekommt
// falsche Bestände — oder schlimmer: erfundene.
//
// Grundsätze hier:
//  • Identität immer über ISIN/Kürzel, niemals über den Namen.
//  • Unbekannte Buchungsarten werden gemeldet, nicht stillschweigend als Kauf
//    verbucht.
//  • Kartenzahlungen sind kein Importfehler, sondern gehören nicht ins Depot.
// ────────────────────────────────────────────────────────────────────────────

import { isIsin, isinValid, SYMBOL_RE } from "./instruments";
import { Txn, TxnKind, makeTxn, parseDate, parseNum } from "./portfolio";

export interface ImportReport {
  txns: Txn[];
  /** Erkanntes Format, für die Rückmeldung an den Nutzer. */
  format: string;
  /** Depotwährung laut Datei. */
  currency: string;
  counts: {
    trades: number;
    dividends: number;
    cash: number;
    corporate: number;
    /** Kartenzahlungen & Co. — bewusst nicht importiert. */
    notPortfolio: number;
    /** Zeilen ohne verwertbare Angaben. */
    unusable: number;
    /** Buchungsarten, die wir (noch) nicht kennen. */
    unknown: number;
  };
  unknownTypes: string[];
  dated: number;
  instruments: { key: string; name: string; assetClass: string; count: number }[];
  notes: string[];
}

// ── CSV-Grundlagen ──────────────────────────────────────────────────────────

function detectSep(line: string): string {
  const counts = [",", ";", "\t"].map((s) => [s, (line.match(new RegExp(`\\${s}`, "g")) || []).length] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

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
  return out.map((c) => c.trim());
}

/** Zeilen zusammenführen, die durch ein Feld mit Zeilenumbruch zerrissen wurden. */
function readRows(text: string, sep: string): string[] {
  const raw = text.split(/\r?\n/);
  const out: string[] = [];
  let buf = "";
  for (const line of raw) {
    buf = buf ? `${buf}\n${line}` : line;
    const quotes = (buf.match(/"/g) || []).length;
    if (quotes % 2 === 0) {
      if (buf.trim()) out.push(buf);
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf);
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");

function findCol(header: string[], names: string[]): number {
  const low = header.map(norm);
  for (const n of names) {
    const i = low.indexOf(norm(n));
    if (i >= 0) return i;
  }
  return -1;
}

// ── Buchungsarten von Trade Republic / Parqet ───────────────────────────────

type Mapped =
  | { kind: TxnKind; bucket: "trades" | "dividends" | "cash" | "corporate" }
  | { kind: null; bucket: "notPortfolio" };

const TYPE_MAP: Record<string, Mapped> = {
  // Wertpapiergeschäfte
  BUY: { kind: "buy", bucket: "trades" },
  SELL: { kind: "sell", bucket: "trades" },
  PRIVATE_MARKET_BUY: { kind: "buy", bucket: "trades" },
  PRIVATE_MARKET_SELL: { kind: "sell", bucket: "trades" },
  SAVINGS_PLAN_EXECUTION: { kind: "buy", bucket: "trades" },
  ORDER_EXECUTION: { kind: "buy", bucket: "trades" },

  // Erträge
  DIVIDEND: { kind: "dividend", bucket: "dividends" },
  LIQUIDATION_DIVIDEND: { kind: "dividend", bucket: "dividends" },
  LIQUIDATION_PROCEEDS: { kind: "dividend", bucket: "dividends" },
  TILG: { kind: "dividend", bucket: "dividends" }, // Tilgung eines Zertifikats
  COUPON: { kind: "dividend", bucket: "dividends" },
  EARNINGS: { kind: "dividend", bucket: "dividends" },
  INTEREST_PAYMENT: { kind: "interest", bucket: "cash" },
  TAX_OPTIMIZATION: { kind: "interest", bucket: "cash" }, // Steuererstattung
  TAX_REFUND: { kind: "interest", bucket: "cash" },
  BONUS: { kind: "interest", bucket: "cash" },

  // Geldbewegungen auf dem Verrechnungskonto
  CUSTOMER_INPAYMENT: { kind: "deposit", bucket: "cash" },
  CUSTOMER_INBOUND: { kind: "deposit", bucket: "cash" },
  TRANSFER_INBOUND: { kind: "deposit", bucket: "cash" },
  TRANSFER_INSTANT_INBOUND: { kind: "deposit", bucket: "cash" },
  INCOMING_TRANSFER: { kind: "deposit", bucket: "cash" },
  CUSTOMER_OUTPAYMENT: { kind: "withdrawal", bucket: "cash" },
  CUSTOMER_OUTBOUND_REQUEST: { kind: "withdrawal", bucket: "cash" },
  TRANSFER_OUTBOUND: { kind: "withdrawal", bucket: "cash" },
  TRANSFER_INSTANT_OUTBOUND: { kind: "withdrawal", bucket: "cash" },
  CUSTOMER_INPAYMENT_REVERSAL: { kind: "withdrawal", bucket: "cash" },
  OUTGOING_TRANSFER: { kind: "withdrawal", bucket: "cash" },

  // Bestandsänderungen ohne Geldfluss
  SPLIT: { kind: "split", bucket: "corporate" },
  REVERSE_SPLIT: { kind: "split", bucket: "corporate" },
  MIGRATION: { kind: "split", bucket: "corporate" },
  FREE_RECEIPT: { kind: "split", bucket: "corporate" },
  WARRANT_EXERCISE: { kind: "split", bucket: "corporate" },
  SPINOFF: { kind: "split", bucket: "corporate" },
  DELIVERY: { kind: "split", bucket: "corporate" },

  // Bargeschenke, die separat als Kauf gebucht werden ⇒ als Einzahlung werten,
  // sonst erscheint der Kauf als Gewinn aus dem Nichts.
  STOCKPERK: { kind: "deposit", bucket: "cash" },
  BENEFITS_SAVEBACK: { kind: "deposit", bucket: "cash" },
  BENEFITS_SPARE_CHANGE_EXECUTION: { kind: "deposit", bucket: "cash" },
  REFERRAL_FIRST_TRADE: { kind: "deposit", bucket: "cash" },

  // Kein Depotgeschehen
  CARD_TRANSACTION: { kind: null, bucket: "notPortfolio" },
  CARD_TRANSACTION_INTERNATIONAL: { kind: null, bucket: "notPortfolio" },
  CARD_TRANSACTION_REFUND: { kind: null, bucket: "notPortfolio" },
  CARD_ORDERING_FEE: { kind: null, bucket: "notPortfolio" },
  CARD_SUCCESSOR_ORDERING: { kind: null, bucket: "notPortfolio" },
  CARD_FAILED_TRANSACTION: { kind: null, bucket: "notPortfolio" },
  ROUND_UP: { kind: null, bucket: "notPortfolio" },
  PAYOUT: { kind: null, bucket: "notPortfolio" },
};

/** Freitext-Buchungsarten aus einfacheren Exporten. */
const WORD_MAP: [RegExp, TxnKind][] = [
  [/^(kauf|buy|purchase|k|acquisition|zeichnung)$/i, "buy"],
  [/^(verkauf|sell|sale|v|veraeusserung|veräußerung)$/i, "sell"],
  [/^(dividende|dividend|div|ausschüttung|ausschuettung|coupon|zins.*ertrag)$/i, "dividend"],
  [/^(einzahlung|deposit|einlage|einlieferung)$/i, "deposit"],
  [/^(auszahlung|withdrawal|entnahme|auslieferung)$/i, "withdrawal"],
  [/^(zinsen|interest)$/i, "interest"],
  [/^(split|bestandsänderung|bestandsaenderung|umbuchung)$/i, "split"],
];

function mapType(raw: string): Mapped | null {
  const t = raw.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!t) return null;
  if (TYPE_MAP[t]) return TYPE_MAP[t];
  for (const [re, kind] of WORD_MAP) {
    if (re.test(raw.trim())) {
      return {
        kind,
        bucket:
          kind === "buy" || kind === "sell"
            ? "trades"
            : kind === "dividend"
            ? "dividends"
            : kind === "split"
            ? "corporate"
            : "cash",
      };
    }
  }
  return null;
}

// ── Hauptfunktion ───────────────────────────────────────────────────────────

export function importCsv(text: string): ImportReport {
  const lines = readRows(text, ",");
  const empty: ImportReport = {
    txns: [],
    format: "unbekannt",
    currency: "EUR",
    counts: { trades: 0, dividends: 0, cash: 0, corporate: 0, notPortfolio: 0, unusable: 0, unknown: 0 },
    unknownTypes: [],
    dated: 0,
    instruments: [],
    notes: [],
  };
  if (lines.length === 0) return empty;

  const sep = detectSep(lines[0]);
  const header = splitLine(lines[0], sep);

  const col = {
    date: findCol(header, ["date", "datum", "datetime", "zeitpunkt", "handelstag", "valuta", "buchungstag"]),
    type: findCol(header, ["type", "typ", "art", "transaktionstyp", "aktion", "action", "buchungsart", "kind"]),
    isin: findCol(header, ["isin", "symbol", "wkn", "identifier", "instrument"]),
    symbol: findCol(header, ["ticker", "kürzel", "kuerzel", "boersenkuerzel"]),
    name: findCol(header, ["name", "bezeichnung", "wertpapier", "titel", "beschreibung", "asset"]),
    shares: findCol(header, ["shares", "anzahl", "stück", "stueck", "stk", "menge", "quantity", "qty", "nominal"]),
    price: findCol(header, ["price", "kurs", "preis", "stückpreis", "stueckpreis", "kaufpreis"]),
    amount: findCol(header, ["amount", "betrag", "summe", "gesamt", "total", "wert"]),
    fee: findCol(header, ["fee", "gebühr", "gebuehr", "gebühren", "gebuehren", "kosten", "provision", "courtage"]),
    tax: findCol(header, ["tax", "steuer", "steuern", "quellensteuer"]),
    currency: findCol(header, ["currency", "währung", "waehrung"]),
    assetClass: findCol(header, ["assetclass", "anlageklasse", "wertpapierart", "gattung"]),
  };

  // Ohne Kopfzeile mit Wertpapier-Spalte: einfache Bestandsliste.
  const hasHeader = col.isin >= 0 || col.symbol >= 0 || col.name >= 0;
  if (!hasHeader) return importSimple(lines, sep);

  const isTradeRepublic = col.type >= 0 && col.isin >= 0 && findCol(header, ["transactionid", "transaction_id"]) >= 0;

  const txns: Txn[] = [];
  const counts = { trades: 0, dividends: 0, cash: 0, corporate: 0, notPortfolio: 0, unusable: 0, unknown: 0 };
  const unknownTypes = new Set<string>();
  const currencies = new Map<string, number>();
  const instruments = new Map<string, { name: string; assetClass: string; count: number }>();
  let dated = 0;

  const at = (cols: string[], i: number) => (i >= 0 && i < cols.length ? cols[i] : "");

  for (let li = 1; li < lines.length; li++) {
    const cols = splitLine(lines[li], sep);
    if (cols.every((c) => !c)) continue;

    const rawType = at(cols, col.type);
    const mapped = col.type >= 0 ? mapType(rawType) : { kind: "buy" as TxnKind, bucket: "trades" as const };

    if (!mapped) {
      if (rawType) unknownTypes.add(rawType);
      counts.unknown++;
      continue;
    }
    if (mapped.kind === null) {
      counts.notPortfolio++;
      continue;
    }

    const kind = mapped.kind;
    const date = parseDate(at(cols, col.date));
    const cur = (at(cols, col.currency) || "").toUpperCase();
    if (cur) currencies.set(cur, (currencies.get(cur) ?? 0) + 1);

    const fee = Math.abs(parseNum(at(cols, col.fee))) || 0;
    const taxRaw = parseNum(at(cols, col.tax));
    const tax = Number.isFinite(taxRaw) ? Math.abs(taxRaw) : 0;
    const amountRaw = parseNum(at(cols, col.amount));
    const amount = Number.isFinite(amountRaw) ? amountRaw : NaN;
    const name = at(cols, col.name);
    const assetClass = at(cols, col.assetClass).toUpperCase();

    // Reine Geldbewegung — kein Wertpapier nötig.
    if (kind === "deposit" || kind === "withdrawal" || kind === "interest") {
      // Steuererstattungen stehen in der Steuerspalte, nicht im Betrag.
      const v = Number.isFinite(amount) && Math.abs(amount) > 0 ? Math.abs(amount) : tax;
      if (!(v > 0)) {
        counts.unusable++;
        continue;
      }
      if (date) dated++;
      txns.push(makeTxn({ kind, date, amount: v, currency: cur || undefined, seq: li }));
      counts.cash++;
      continue;
    }

    // Ab hier brauchen wir eine Wertpapier-Identität.
    const isinCell = at(cols, col.isin).toUpperCase();
    const symCell = at(cols, col.symbol).toUpperCase();
    let key = "";
    if (isIsin(isinCell) && isinValid(isinCell)) key = isinCell;
    else if (symCell && SYMBOL_RE.test(symCell)) key = symCell;
    else if (isinCell && SYMBOL_RE.test(isinCell) && isinCell.length <= 8) key = isinCell;

    if (!key) {
      counts.unusable++;
      continue;
    }

    const prev = instruments.get(key);
    if (prev) prev.count++;
    else instruments.set(key, { name: name || key, assetClass, count: 1 });

    const sharesRaw = parseNum(at(cols, col.shares));
    const shares = Number.isFinite(sharesRaw) ? sharesRaw : NaN;
    let price = parseNum(at(cols, col.price));
    if (!Number.isFinite(price) || price < 0) price = NaN;

    if (kind === "split") {
      // Vorzeichen beibehalten: Depotübertrag raus ist negativ.
      if (!Number.isFinite(shares) || shares === 0) {
        counts.unusable++;
        continue;
      }
      if (date) dated++;
      txns.push(
        makeTxn({ kind, ticker: key, date, shares, name, assetClass, currency: cur || undefined, seq: li }),
      );
      counts.corporate++;
      continue;
    }

    if (kind === "dividend") {
      const net = Number.isFinite(amount) ? Math.abs(amount) - tax : NaN;
      if (!(net > 0)) {
        counts.unusable++;
        continue;
      }
      if (date) dated++;
      txns.push(
        makeTxn({ kind, ticker: key, date, amount: net, fee, name, assetClass, currency: cur || undefined, seq: li }),
      );
      counts.dividends++;
      continue;
    }

    // Kauf / Verkauf
    let qty = Number.isFinite(shares) ? Math.abs(shares) : NaN;
    if (!(qty > 0)) {
      // Privatmarkt-Anteile werden ohne Stückzahl gebucht. Damit der
      // eingesetzte Betrag nicht verloren geht, zählen wir 1 Anteil = 1 €.
      if (Number.isFinite(amount) && Math.abs(amount) > 0) {
        qty = Math.abs(amount);
        price = 1;
      } else {
        counts.unusable++;
        continue;
      }
    }
    if (!Number.isFinite(price)) {
      price = Number.isFinite(amount) && Math.abs(amount) > 0 ? Math.abs(amount) / qty : 0;
    }
    if (date) dated++;
    txns.push(
      makeTxn({ kind, ticker: key, date, shares: qty, price, fee, name, assetClass, currency: cur || undefined, seq: li }),
    );
    counts.trades++;
  }

  const currency = [...currencies.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "EUR";

  const notes: string[] = [];
  if (counts.notPortfolio > 0)
    notes.push(
      `${counts.notPortfolio} Kartenzahlungen und sonstige Kontobewegungen gehören nicht ins Depot und wurden übersprungen.`,
    );
  if (counts.corporate > 0)
    notes.push(`${counts.corporate} Bestandsänderungen (Splits, Überträge, Gratisstücke) verarbeitet.`);
  if (counts.unknown > 0)
    notes.push(
      `${counts.unknown} Zeilen mit unbekannter Buchungsart: ${[...unknownTypes].slice(0, 6).join(", ")}`,
    );

  return {
    txns,
    format: isTradeRepublic ? "Trade Republic / Parqet" : "Transaktionsexport",
    currency,
    counts,
    unknownTypes: [...unknownTypes],
    dated,
    instruments: [...instruments.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count),
    notes,
  };
}

/** Einfache Bestandsliste ohne Kopfzeile: TICKER,Anzahl[,Kaufpreis] */
function importSimple(lines: string[], sep: string): ImportReport {
  const txns: Txn[] = [];
  const instruments = new Map<string, { name: string; assetClass: string; count: number }>();
  let unusable = 0;

  for (const line of lines) {
    const cols = splitLine(line, sep);
    const key = (cols[0] || "").toUpperCase();
    const valid = (isIsin(key) && isinValid(key)) || (SYMBOL_RE.test(key) && key.length <= 10);
    if (!valid) {
      unusable++;
      continue;
    }
    const shares = parseNum(cols[1] || "");
    if (!Number.isFinite(shares) || shares <= 0) {
      unusable++;
      continue;
    }
    const p = parseNum(cols[2] || "");
    txns.push(
      makeTxn({
        kind: "buy",
        ticker: key,
        shares,
        price: Number.isFinite(p) && p > 0 ? p : 0,
        date: parseDate(cols[3] || ""),
      }),
    );
    instruments.set(key, { name: key, assetClass: "", count: 1 });
  }

  return {
    txns,
    format: "Bestandsliste",
    currency: "USD",
    counts: { trades: txns.length, dividends: 0, cash: 0, corporate: 0, notPortfolio: 0, unusable, unknown: 0 },
    unknownTypes: [],
    dated: txns.filter((t) => t.date).length,
    instruments: [...instruments.entries()].map(([key, v]) => ({ key, ...v })),
    notes: txns.some((t) => !t.date)
      ? ["Ohne Kaufdatum werden Positionen als „seit Beginn gehalten“ gerechnet."]
      : [],
  };
}

export function summarize(r: ImportReport): string {
  const parts: string[] = [];
  if (r.counts.trades) parts.push(`${r.counts.trades} Trades`);
  if (r.counts.dividends) parts.push(`${r.counts.dividends} Dividenden`);
  if (r.counts.corporate) parts.push(`${r.counts.corporate} Bestandsänderungen`);
  if (r.counts.cash) parts.push(`${r.counts.cash} Geldbewegungen`);
  const head = parts.length ? parts.join(" · ") : "keine verwertbaren Buchungen";
  return `${r.format} erkannt (${r.currency}): ${head}.`;
}
