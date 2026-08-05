// Währungsformatierung für das Depot.
//
// Ein Trade-Republic-Export läuft in Euro, US-Kurse kommen in Dollar. Wer das
// vermischt, zeigt Zahlen an, die um den Wechselkurs danebenliegen. Die
// Depotwährung wird deshalb einmal gesetzt und überall verwendet.

const SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF ",
  JPY: "¥",
  CAD: "C$",
  AUD: "A$",
  SEK: "kr ",
  NOK: "kr ",
  DKK: "kr ",
  PLN: "zł ",
};

let current = "USD";

export function setCurrency(c: string | null | undefined) {
  if (c && /^[A-Z]{3}$/.test(c)) current = c;
}

export function getCurrency(): string {
  return current;
}

export function currencySymbol(c: string = current): string {
  return SYMBOLS[c] ?? `${c} `;
}

/** Voller Betrag mit zwei Nachkommastellen: 1.234,56 € */
export function cMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const s = currencySymbol();
  const n = v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return current === "EUR" ? `${n} ${s}` : `${s}${n}`;
}

/** Kompakt für Kacheln und Achsen: 40,4K € */
export function cAbbrev(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const s = currencySymbol();
  const a = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  const num =
    a >= 1e9
      ? `${(a / 1e9).toFixed(1)} Mrd.`
      : a >= 1e6
      ? `${(a / 1e6).toFixed(1)} Mio.`
      : a >= 1e4
      ? `${(a / 1e3).toFixed(1)}K`
      : a >= 1e3
      ? a.toLocaleString("de-DE", { maximumFractionDigits: 0 })
      : a.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return current === "EUR" ? `${sign}${num} ${s}` : `${sign}${s}${num}`;
}

/** Mit Vorzeichen — für Gewinne und Verluste. */
export function cSigned(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v >= 0 ? "+" : "−"}${cAbbrev(Math.abs(v))}`;
}

const CUR_KEY = "outsider:currency";

export function loadCurrency(): string {
  if (typeof window === "undefined") return "USD";
  const c = window.localStorage.getItem(CUR_KEY);
  return c && /^[A-Z]{3}$/.test(c) ? c : "USD";
}

export function saveCurrency(c: string) {
  if (typeof window === "undefined") return;
  if (/^[A-Z]{3}$/.test(c)) window.localStorage.setItem(CUR_KEY, c);
}
