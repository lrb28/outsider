import type { FeedRow } from "./types";
export function pct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `$${Math.round(v).toLocaleString("de-DE")}`;
}

// Compact money like Eaves: $263.1B, $12.4M, $980K.
export function abbrevMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e12) return `${sign}$${(a / 1e12).toFixed(1)} Bio.`;
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(1)} Mrd.`;
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)} Mio.`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

// Key figures on phones: three significant digits, so $263 Mrd., $26.3 Mrd.
export function shortMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  const units: [number, string][] = [[1e12, " Bio."], [1e9, " Mrd."], [1e6, " Mio."], [1e3, "K"]];
  for (const [i, [size, unit]] of units.entries()) {
    const n = a / size;
    if (n < 1) continue;
    // Number() drops a trailing ".0": $71 Mrd., not $71.0 Mrd.
    const r = Number(n.toFixed(n >= 99.95 ? 0 : 1));
    // 999.6 Mrd. would round to "1000 Mrd."; the next unit up reads better.
    if (i > 0 && r >= 1000) return `${sign}$1${units[i - 1][1]}`;
    return `${sign}$${r}${unit}`;
  }
  return `${sign}$${a.toFixed(0)}`;
}

// ISO date (2026-01-27) -> deutsches Format (27.01.2026)
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

// ISO date (2026-01-27) -> 27.01.26, for key figures.
export function shortDate(iso: string | null | undefined): string {
  const long = formatDate(iso);
  return /^\d\d\.\d\d\.\d{4}$/.test(long) ? long.slice(0, 6) + long.slice(8) : long;
}

/**
 * Beschriftung für die Spalte „Seit Offenlegung".
 *
 * Ein nackter Strich sieht aus, als wäre etwas kaputt. Dabei gibt es zwei ganz
 * verschiedene Gründe für die Leere: die Meldung ist von heute (dann gibt es
 * noch keinen Zeitraum), oder wir führen für dieses Papier gar keine Kursreihe
 * (dann kann die Zahl nicht berechnet werden). Beides wird ausgeschrieben,
 * statt eine Rendite zu erfinden.
 */
export function disclosureLabel(
  pctSince: number | null,
  disclosedAt: string | null | undefined,
  today: string,
): { text: string; muted: boolean } {
  if (pctSince !== null && Number.isFinite(pctSince)) return { text: pct(pctSince), muted: false };
  const d = disclosedAt ? disclosedAt.slice(0, 10) : null;
  if (d && d >= today) return { text: "heute gemeldet", muted: true };
  return { text: "kein Kurs hinterlegt", muted: true };
}

/**
 * Fasst Meldeserien im Feed zusammen.
 *
 * Bei einer Vesting-Runde meldet ein Unternehmen am selben Tag ein Dutzend
 * Insider-Buchungen für dieselbe Aktie. Untereinander gelistet verdrängen sie
 * alles andere und der Feed wirkt wie ein einziges Ereignis. Direkt
 * aufeinanderfolgende Zeilen mit gleichem Tag, gleicher Aktie, gleicher Art und
 * gleichem Signal werden deshalb ab drei Stück zu einer Zeile gebündelt — die
 * Einzelmeldungen bleiben erhalten und lassen sich aufklappen.
 */
export const SERIES_MIN = 3;

export function groupSeries<
  T extends {
    disclosedAt: string | null;
    ticker: string | null;
    entityType: string;
    txnType: string;
    putCall?: string | null;
    transactionCode?: string | null;
  },
>(rows: T[]): ({ key: string; rows: T[] })[] {
  const out: { key: string; rows: T[] }[] = [];
  for (const r of rows) {
    const key = [r.disclosedAt ?? "", r.ticker ?? "", r.entityType, r.txnType, r.putCall ?? "", r.transactionCode ?? ""].join("|");
    const last = out[out.length - 1];
    if (last && last.key === key) last.rows.push(r);
    else out.push({ key, rows: [r] });
  }
  return out;
}

export function weightPct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function sizeDisplay(row: {
  shares: number | null;
  amount_min: number | null;
  amount_max: number | null;
}): string {
  if (row.amount_min !== null || row.amount_max !== null) {
    if (row.amount_min !== null && row.amount_max !== null) {
      return row.amount_min === row.amount_max
        ? money(row.amount_min)
        : `${money(row.amount_min)}–${money(row.amount_max)}`;
    }
    return row.amount_min !== null ? `≥ ${money(row.amount_min)}` : `≤ ${money(row.amount_max)}`;
  }
  if (row.shares !== null && row.shares > 0 && row.shares < 0.000001) return "< 0,000001 St.";
  if (row.shares !== null) return `${row.shares.toLocaleString("de-DE", { maximumFractionDigits: 6 })} St.`;
  return "—";
}

export function signalLabel(txnType: string, putCall: string | null): {
  text: string;
  tone: "bull" | "bear" | "neutral";
} {
  const opening = txnType === "buy";
  if (putCall === "Put")
    return opening
      ? { text: "Put · bearish", tone: "bear" }
      : { text: "Put geschlossen", tone: "neutral" };
  if (putCall === "Call")
    return opening
      ? { text: "Call · bullish", tone: "bull" }
      : { text: "Call geschlossen", tone: "neutral" };
  if (txnType === "buy") return { text: "Kauf", tone: "bull" };
  if (txnType === "sell") return { text: "Verkauf", tone: "bear" };
  if (txnType === "exchange") return { text: "Umschichtung", tone: "neutral" };
  return { text: txnType, tone: "neutral" };
}

// ── Personennamen aus SEC-Meldungen ──────────────────────────────────────────
//
// Form 4 nennt den Meldenden als "NACHNAME VORNAME MITTELNAME", oft komplett
// in Großbuchstaben: "BARTON RICHARD N". So gelesen wirkt jede Seite wie ein
// Behördenausdruck. Hier wird daraus "Richard N. Barton".

const NAME_SUFFIX = new Set(["JR", "SR", "II", "III", "IV", "V", "MD", "PHD"]);
const NAME_PARTICLE = new Set(["van", "von", "de", "del", "der", "den", "di", "da", "la", "le"]);

function titleCasePart(w: string): string {
  const low = w.toLowerCase();
  if (NAME_PARTICLE.has(low)) return low;
  // O'Brien, McDonald-Smith
  return low
    .split(/(['\-])/)
    .map((p, i) => (i % 2 === 1 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join("");
}

/**
 * "BARTON RICHARD N" → "Richard N. Barton"
 * "Zuckerberg Mark"  → "Mark Zuckerberg"
 * "SMITH BRADFORD L JR" → "Bradford L. Smith Jr."
 *
 * Firmennamen bleiben unangetastet — erkennbar an Rechtsformen und Ziffern.
 */
export function personName(raw: string | null | undefined): string {
  const s = (raw || "").trim().replace(/\s+/g, " ");
  if (!s) return "";
  // Sieht nach einem Unternehmen aus? Dann nicht anfassen.
  if (/\b(inc|corp|llc|lp|ltd|plc|trust|fund|capital|partners|holdings?|group|management|gmbh|ag|s\.?a)\b/i.test(s))
    return s;
  if (/\d/.test(s)) return s;
  if (s.includes(",")) {
    // Manche Quellen liefern bereits "Nachname, Vorname".
    const [last, rest] = s.split(",", 2);
    const given = (rest || "").trim();
    if (given) return `${formatGiven(given)} ${titleCasePart(last.trim())}`.trim();
  }

  const parts = s.split(" ").filter(Boolean);
  if (parts.length < 2) return titleCasePart(s);

  // Anhängsel wie JR/III hinten abtrennen und später wieder anfügen.
  const suffixes: string[] = [];
  while (parts.length > 2 && NAME_SUFFIX.has(parts[parts.length - 1].replace(/\./g, "").toUpperCase())) {
    suffixes.unshift(parts.pop() as string);
  }
  if (parts.length < 2) return titleCasePart(s);

  const last = parts.shift() as string;
  const given = parts.join(" ");
  const suffix = suffixes.map((x) => {
    const u = x.replace(/\./g, "").toUpperCase();
    return u === "JR" || u === "SR" ? `${u.charAt(0)}${u.slice(1).toLowerCase()}.` : u;
  });
  return [formatGiven(given), titleCasePart(last), ...suffix].filter(Boolean).join(" ");
}

/** Vornamen sauber setzen; einzelne Buchstaben bekommen einen Punkt. */
function formatGiven(given: string): string {
  return given
    .split(" ")
    .filter(Boolean)
    .map((w) => {
      const clean = w.replace(/\./g, "");
      return clean.length === 1 ? `${clean.toUpperCase()}.` : titleCasePart(clean);
    })
    .join(" ");
}

export function initials(name: string): string {
  const parts = name.replace(/\(.*?\)/g, "").trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "?";
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

// Aura of an entity type: the identity colour used for avatars, glows and
// chart marks (CSS variable names from globals.css).
export type AuraKind = "investor" | "insider" | "politician";
export function auraOf(entityType: string | null | undefined): AuraKind {
  if (entityType === "politician") return "politician";
  if (entityType === "corporate_insider") return "insider";
  return "investor";
}

// Curated registry: an entity's fund OR person name -> portrait key and the
// person's display name. Matched by substring, so it works whether the feed
// shows the fund or the person; keys are specific enough not to hit other
// names. Portraits live in lib/portraits.ts (free licences only).
const INVESTOR_PEOPLE: [string, string, string][] = [
  ["berkshire", "Warren_Buffett", "Warren Buffett"],
  ["buffett", "Warren_Buffett", "Warren Buffett"],
  ["scion", "Michael_Burry", "Michael Burry"],
  ["burry", "Michael_Burry", "Michael Burry"],
  ["pershing", "Bill_Ackman", "Bill Ackman"],
  ["ackman", "Bill_Ackman", "Bill Ackman"],
  ["duquesne", "Stanley_Druckenmiller", "Stanley Druckenmiller"],
  ["druckenmiller", "Stanley_Druckenmiller", "Stanley Druckenmiller"],
  ["soros", "George_Soros", "George Soros"],
  ["daily journal", "Charlie_Munger", "Charlie Munger"],
  ["munger", "Charlie_Munger", "Charlie Munger"],
  ["bridgewater", "Ray_Dalio", "Ray Dalio"],
  ["dalio", "Ray_Dalio", "Ray Dalio"],
  ["perceptive", "Joseph_Edelman", "Joseph Edelman"],
  ["edelman", "Joseph_Edelman", "Joseph Edelman"],
  ["dalal street", "Mohnish_Pabrai", "Mohnish Pabrai"],
  ["pabrai", "Mohnish_Pabrai", "Mohnish Pabrai"],
  ["situational", "Leopold_Aschenbrenner", "Leopold Aschenbrenner"],
  ["aschenbrenner", "Leopold_Aschenbrenner", "Leopold Aschenbrenner"],
  ["point72", "Steven_A._Cohen", "Steven A. Cohen"],
  ["tiger global", "Chase_Coleman_III", "Chase Coleman"],
  ["baupost", "Seth_Klarman", "Seth Klarman"],
  ["icahn", "Carl_Icahn", "Carl Icahn"],
  ["gates foundation", "Bill_Gates", "Bill Gates"],
  ["ark investment", "Cathie_Wood", "Cathie Wood"],
  ["cathie wood", "Cathie_Wood", "Cathie Wood"],
  ["appaloosa", "David_Tepper", "David Tepper"],
  ["himalaya capital", "Li_Lu", "Li Lu"],
  ["third point", "Daniel_Loeb", "Daniel Loeb"],
  ["fundsmith", "Terry_Smith", "Terry Smith"],
  ["trian fund", "Nelson_Peltz", "Nelson Peltz"],
  ["akre capital", "Chuck_Akre", "Chuck Akre"],
  ["gardner russo", "Thomas_Russo", "Thomas Russo"],
  ["oaktree", "Howard_Marks", "Howard Marks"],
  ["coatue", "Philippe_Laffont", "Philippe Laffont"],
  ["viking global", "Andreas_Halvorsen", "Andreas Halvorsen"],
  ["lone pine", "Stephen_Mandel", "Stephen Mandel"],
  ["altimeter", "Brad_Gerstner", "Brad Gerstner"],
  ["d1 capital", "Dan_Sundheim", "Dan Sundheim"],
  ["fairfax financial", "Prem_Watsa", "Prem Watsa"],
  ["markel", "Tom_Gayner", "Tom Gayner"],
  ["starboard value", "Jeff_Smith", "Jeff Smith"],
  ["glenview", "Larry_Robbins", "Larry Robbins"],
  ["pelosi", "Nancy_Pelosi", "Nancy Pelosi"],
];

function investorEntry(name: string): [string, string, string] | null {
  const n = name.toLowerCase();
  for (const entry of INVESTOR_PEOPLE) if (n.includes(entry[0])) return entry;
  return null;
}

/** Portrait key (lib/portraits.ts) for a fund or person name. */
export function wikiTitleFor(name: string): string | null {
  return investorEntry(name)?.[1] ?? null;
}

// Display name of the person behind a fund.
export function investorPerson(name: string): string | null {
  return investorEntry(name)?.[2] ?? null;
}

// Short bio shown on investor pages (Eaves-style, 2–3 punchy sentences).
const BIO_BUFFETT =
  "Das „Orakel von Omaha“. Baute Berkshire Hathaway über sechs Jahrzehnte zur größten Investmentholding der Welt — Value-Investing, Lieblingshaltedauer: für immer. Kündigte 2025 an, den CEO-Posten an Greg Abel zu übergeben.";
const BIO_BURRY =
  "Wurde mit seiner Wette gegen den US-Häusermarkt weltberühmt („The Big Short“). Fährt ein kleines, extrem konzentriertes Portfolio und wettet gern gegen den Konsens — zuletzt auch mit Puts auf die KI-Lieblinge.";
const BIO_ACKMAN =
  "Aktivistischer Investor: kauft große Anteile an wenigen Firmen und mischt sich aktiv ins Management ein. Bekannt für öffentliche Kampagnen — und ein konzentriertes Portfolio aus rund zehn Positionen.";
const BIO_DRUCK =
  "Makro-Legende: managte drei Jahrzehnte Geld ohne ein einziges Verlustjahr und war Soros’ rechte Hand beim Pfund-Trade 1992. Investiert heute über sein Family Office — wenige Wetten, hohe Überzeugung.";
const BIO_SOROS =
  "„Der Mann, der die Bank von England brach“ — seine Pfund-Wette 1992 machte ihn zur Legende. Sein Family Office investiert breit über Aktien, Anleihen und Währungen.";
const BIO_MUNGER =
  "Buffetts Partner über 45 Jahre und Vize-Chairman von Berkshire (1924–2023). Das Daily-Journal-Depot, das er prägte, hält bis heute nur eine Handvoll langfristiger Positionen.";
const BIO_DALIO =
  "Gründete Bridgewater, den größten Hedgefonds der Welt — knapp 1.000 Positionen, extrem diversifiziert. Bekannt für seine „Principles“ und das Allwetter-Portfolio.";
const BIO_EDELMAN =
  "Biotech-Spezialist: Perceptive Advisors investiert fast ausschließlich in Life Sciences und gilt als einer der erfolgreichsten Healthcare-Fonds überhaupt.";
const BIO_PABRAI =
  "Nennt sich selbst einen „schamlosen Kloner“ von Buffett und Munger. Extrem konzentriert — oft nur eine Handvoll Positionen, gern abseits der ausgetretenen US-Pfade.";
const BIO_ASCHEN =
  "Ex-OpenAI-Forscher, schrieb 2024 das viel diskutierte Essay „Situational Awareness“. Gründete danach einen Fonds, der voll auf das KI-Zeitalter setzt — von Chips bis Energie.";
const BIO_COHEN =
  "Hedgefonds-Milliardär und Besitzer der New York Mets. Point72 (Nachfolger von SAC Capital) handelt mit Dutzenden Teams tausende Positionen.";
const BIO_COLEMAN =
  "„Tiger Cub“ aus dem Stall von Julian Robertson. Tiger Global wurde mit frühen Tech-Wetten wie Facebook und JD.com groß — Fokus: Internet und Software weltweit.";
const BIO_KLARMAN =
  "Value-Legende und Autor des Kultbuchs „Margin of Safety“. Baupost investiert geduldig und hält gern viel Cash, wenn nichts günstig ist.";

const BIO_ICAHN =
  "Aktivist der ersten Stunde: kauft große Pakete und fordert dann öffentlich Veränderungen – von TWA bis Apple. Seine Beteiligungen laufen heute vor allem über Icahn Enterprises.";
const BIO_GATES =
  "Die Gates Foundation Trust verwaltet das Vermögen der Gates-Stiftung – ein ruhiges, konzentriertes Depot aus langfristigen Qualitätswerten.";
const BIO_WOOD =
  "Gründerin von ARK Invest und bekannteste Verfechterin „disruptiver Innovation“: KI, Robotik, Genomik, Krypto. Ihre aktiven ETFs handeln fast täglich; hier siehst du die Quartalsbestände.";
const BIO_TEPPER =
  "Gründer von Appaloosa, berühmt für seine Wette auf US-Banken nach der Finanzkrise 2009. Gehört seit Jahren zu den erfolgreichsten Hedgefonds-Managern und besitzt die Carolina Panthers.";
const BIO_LILU =
  "Gründer von Himalaya Capital; Charlie Munger vertraute ihm einen Teil seines Familienvermögens an. Hält nur eine Handvoll Positionen, gern in Asien und bei Finanzwerten.";
const BIO_LOEB =
  "Aktivistischer Investor mit Third Point – bekannt für scharf formulierte Briefe an Vorstände und eine Mischung aus Tech, Konsum und Sondersituationen.";
const BIO_SMITH =
  "Der „britische Buffett“: Fundsmith kauft nur Qualitätsunternehmen, zahlt keinen Überpreis und tut dann möglichst nichts. Sehr konzentriert, sehr geduldig.";
const BIO_PELTZ =
  "Aktivist mit Trian: kauft große Anteile an etablierten Konsum- und Industrieunternehmen und drängt in den Aufsichtsrat – etwa bei Procter & Gamble und Disney.";
const BIO_AKRE =
  "Akre Capital sucht „Compounding Machines“ – Firmen, die ihr Kapital jahrzehntelang hoch verzinsen – und hält wenige Positionen sehr lange.";
const BIO_RUSSO =
  "Thomas Russo investiert seit Jahrzehnten in globale Markenhersteller mit langem Atem – Getränke, Luxus, Konsumgüter – und hält sie oft über Jahrzehnte.";
const BIO_MARKS =
  "Mitgründer von Oaktree und Autor der berühmten Kunden-Memos, die viele Profis sofort lesen. Oaktree ist vor allem für Anleihen und Sondersituationen bekannt; der 13F zeigt nur den Aktienteil.";
const BIO_LAFFONT =
  "„Tiger Cub“ und Gründer von Coatue: setzt stark auf Technologie – von den großen Plattformen bis zu schnell wachsenden Software-Werten.";
const BIO_HALVORSEN =
  "Ebenfalls ein „Tiger Cub“: Viking Global verbindet gründliche Unternehmensanalyse mit einem breiten Portfolio aus Gesundheit, Finanzen und Tech.";
const BIO_MANDEL =
  "Der „Tiger Cub“ Stephen Mandel machte Lone Pine zu einem der bekanntesten Wachstumsfonds – konzentriert auf Qualitätsunternehmen mit starken Marken.";
const BIO_GERSTNER =
  "Gründer von Altimeter: investiert früh in Tech-Plattformen, hält Börsengewinner lange und setzt groß auf die Infrastruktur hinter KI.";
const BIO_SUNDHEIM =
  "Gründete D1 Capital nach Jahren bei Viking: börsennotierte Tech- und Konsumwerte, ergänzt um private Beteiligungen.";
const BIO_WATSA =
  "Der „kanadische Buffett“: führt Fairfax Financial wie Berkshire – Versicherungsgeld, geduldig und gern antizyklisch angelegt.";
const BIO_GAYNER =
  "Führt Markel, oft „Baby Berkshire“ genannt: ein Versicherer mit einem langfristigen Aktiendepot aus Qualitätstiteln.";
const BIO_STARBOARD =
  "Starboard Value ist einer der aktivsten Aktivisten der Wall Street: großer Anteil, konkreter Plan für bessere Margen, notfalls die Kampfabstimmung.";
const BIO_ROBBINS =
  "Glenview Capital ist auf Gesundheitswerte spezialisiert und bekannt für wenige, gründlich recherchierte Wetten.";

const INVESTOR_BIO: [string, string][] = [
  ["icahn", BIO_ICAHN],
  ["gates foundation", BIO_GATES],
  ["ark investment", BIO_WOOD],
  ["appaloosa", BIO_TEPPER],
  ["himalaya capital", BIO_LILU],
  ["third point", BIO_LOEB],
  ["fundsmith", BIO_SMITH],
  ["trian fund", BIO_PELTZ],
  ["akre capital", BIO_AKRE],
  ["gardner russo", BIO_RUSSO],
  ["oaktree", BIO_MARKS],
  ["coatue", BIO_LAFFONT],
  ["viking global", BIO_HALVORSEN],
  ["lone pine", BIO_MANDEL],
  ["altimeter", BIO_GERSTNER],
  ["d1 capital", BIO_SUNDHEIM],
  ["fairfax financial", BIO_WATSA],
  ["markel", BIO_GAYNER],
  ["starboard value", BIO_STARBOARD],
  ["glenview", BIO_ROBBINS],
  ["buffett", BIO_BUFFETT],
  ["berkshire", BIO_BUFFETT],
  ["burry", BIO_BURRY],
  ["scion", BIO_BURRY],
  ["ackman", BIO_ACKMAN],
  ["pershing", BIO_ACKMAN],
  ["druckenmiller", BIO_DRUCK],
  ["duquesne", BIO_DRUCK],
  ["soros", BIO_SOROS],
  ["munger", BIO_MUNGER],
  ["daily journal", BIO_MUNGER],
  ["dalio", BIO_DALIO],
  ["bridgewater", BIO_DALIO],
  ["edelman", BIO_EDELMAN],
  ["perceptive", BIO_EDELMAN],
  ["pabrai", BIO_PABRAI],
  ["dalal", BIO_PABRAI],
  ["aschenbrenner", BIO_ASCHEN],
  ["situational", BIO_ASCHEN],
  ["point72", BIO_COHEN],
  ["tiger global", BIO_COLEMAN],
  ["baupost", BIO_KLARMAN],
];

export function investorBio(name: string): string | null {
  const n = name.toLowerCase();
  for (const [sub, bio] of INVESTOR_BIO) if (n.includes(sub)) return bio;
  return null;
}

// ── Company display names ────────────────────────────────────────────────────
// Show a clean company name instead of the ticker / raw SEC issuer name.
const COMPANY_BY_TICKER: Record<string, string> = {
  AAPL: "Apple", MSFT: "Microsoft", NVDA: "NVIDIA", AMZN: "Amazon",
  GOOGL: "Alphabet", GOOG: "Alphabet", META: "Meta", TSLA: "Tesla",
  AVGO: "Broadcom", AMD: "AMD", TSM: "TSMC", NFLX: "Netflix",
  ORCL: "Oracle", INTC: "Intel", CRM: "Salesforce", COIN: "Coinbase",
  PLTR: "Palantir", JPM: "JPMorgan Chase", KO: "Coca-Cola", WMT: "Walmart",
  PFE: "Pfizer", HAL: "Halliburton", MOH: "Molina Healthcare",
  LULU: "Lululemon", SLM: "SLM (Sallie Mae)", BRKR: "Bruker",
  "BRK.A": "Berkshire Hathaway", "BRK.B": "Berkshire Hathaway",
  AXP: "American Express", BAC: "Bank of America", V: "Visa", MA: "Mastercard",
  DIS: "Disney", NKE: "Nike", SBUX: "Starbucks", MCD: "McDonald's",
  UBER: "Uber", ABNB: "Airbnb", SHOP: "Shopify", PYPL: "PayPal",
  QCOM: "Qualcomm", MU: "Micron", ADBE: "Adobe", NOW: "ServiceNow",
  SPY: "S&P 500 ETF", QQQ: "Nasdaq 100 ETF", DVA: "DaVita",
  BABA: "Alibaba", UNH: "UnitedHealth", LLY: "Eli Lilly", MRK: "Merck",
  XOM: "ExxonMobil", CVX: "Chevron", GM: "General Motors", F: "Ford",
  C: "Citigroup", GS: "Goldman Sachs", MS: "Morgan Stanley", WFC: "Wells Fargo",
  // Berkshire & other commonly-held names (correct US tickers)
  OXY: "Occidental Petroleum", KHC: "Kraft Heinz", DAL: "Delta Air Lines",
  SIRI: "SiriusXM", VRSN: "Verisign", KR: "Kroger", CB: "Chubb", MCO: "Moody's",
  COF: "Capital One", ALLY: "Ally Financial", NU: "Nu Holdings",
  CHTR: "Charter Communications", LEN: "Lennar", DHI: "D.R. Horton",
  AON: "Aon", DPZ: "Domino's Pizza", LPX: "Louisiana-Pacific", LAMR: "Lamar",
  // Broad large caps
  JNJ: "Johnson & Johnson", PG: "Procter & Gamble", HD: "Home Depot",
  COST: "Costco", PEP: "PepsiCo", ABBV: "AbbVie", TMO: "Thermo Fisher",
  ACN: "Accenture", ABT: "Abbott", DHR: "Danaher", VZ: "Verizon", T: "AT&T",
  CSCO: "Cisco", CMCSA: "Comcast", BLK: "BlackRock", SCHW: "Charles Schwab",
  CAT: "Caterpillar", BA: "Boeing", GE: "GE Aerospace", HON: "Honeywell",
  UNP: "Union Pacific", UPS: "UPS", LMT: "Lockheed Martin", RTX: "RTX",
  DE: "Deere", LOW: "Lowe's", TJX: "TJX", MDLZ: "Mondelez", GILD: "Gilead",
  AMGN: "Amgen", BMY: "Bristol Myers Squibb", CVS: "CVS Health",
  SNOW: "Snowflake", PANW: "Palo Alto Networks", CRWD: "CrowdStrike",
  DDOG: "Datadog", NET: "Cloudflare", SPGI: "S&P Global", ICE: "ICE",
  CME: "CME Group", TXN: "Texas Instruments", IBM: "IBM", INTU: "Intuit",
  ISRG: "Intuitive Surgical", VRT: "Vertiv", SMCI: "Super Micro",
};

// A CUSIP (9-char security id) sometimes ends up in the name/ticker column when
// symbol resolution didn't return a clean name. Detect it so we never show it.
function isCusipLike(s: string | null | undefined): boolean {
  const t = (s || "").trim();
  return t.length >= 6 && t.length <= 9 && /^[0-9A-Za-z]+$/.test(t) && /[0-9]/.test(t);
}

const SUFFIX_RE =
  /(?:^|\s)(incorporated|inc|corporation|corp|company|co|plc|ltd|limited|llc|l\.?p|lp|sa|s\.a|n\.?\s?v|a\.?g|a\/s|se|oyj|asa|holdings?|group|the|com|new|sponsored|adr|ads)\.?(?=\s|$)/gi;

function prettifyCompany(raw: string): string {
  // SEC registrant names are often already in proper case ("STMicroelectronics
  // N.V."); keep that. Only ALL-CAPS 13F abbreviations are title-cased.
  const shouting = raw === raw.toUpperCase();
  let s = (raw || "").replace(/\b(class [a-c]|cl\.? [a-c]|series [a-c]|common stock|ordinary shares?|shares?)\b/gi, " ");
  s = s.replace(/\s\/[a-z]{2}\/?\s*$/i, " "); // drop trailing /DE/ etc.
  s = s.replace(/[,]+/g, " ").replace(/\s+/g, " ").trim();
  if (shouting) s = s.toLowerCase().replace(/(^|[\s\-&(])([a-z])/g, (_, lead: string, c: string) => lead + c.toUpperCase());
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(SUFFIX_RE, " ").replace(/\s+/g, " ").trim();
  }
  // Registrant tails: state of incorporation ("DEL"), trust ("TR"), dangling "&".
  s = s.replace(/\s(del|tr|&)$/i, "").replace(/[\s.&]+$/, "");
  return s || raw;
}

// Some CUSIPs resolve to a non-US listing (CHV instead of CVX). Correct the
// display ticker to the familiar US symbol, and recover a symbol for a couple
// of names that came through without one. Used for the logo lookup and label;
// routing/DB lookups keep the raw ticker.
const TICKER_FIX: Record<string, string> = {
  CHV: "CVX",
  DUT: "MCO",
  TRL: "DVA",
};

export function fixTicker(ticker: string | null, name?: string | null): string | null {
  if (ticker) return TICKER_FIX[ticker.toUpperCase()] ?? ticker;
  if (name) {
    const n = name.toLowerCase();
    if (n.includes("chubb")) return "CB";
  }
  return ticker;
}

export function companyName(ticker: string | null, rawName: string | null): string {
  const rawT = (ticker || "").trim();
  const T = rawT && !isCusipLike(rawT) ? rawT.toUpperCase() : "";
  if (T && COMPANY_BY_TICKER[T]) return COMPANY_BY_TICKER[T];
  if (rawName && !isCusipLike(rawName)) {
    const pretty = prettifyCompany(rawName);
    if (pretty && !isCusipLike(pretty)) return pretty;
  }
  if (T) return T; // clean ticker symbol beats an unresolved CUSIP
  if (rawName && !isCusipLike(rawName)) return rawName;
  return rawT || rawName || "—";
}

/** Interpretation depends on disclosure type, not just the stored direction. */
export function tradeSignal(row: Pick<FeedRow, "entityType" | "txnType" | "putCall" | "transactionCode" | "isDerivative">): { text: string; tone: "bull" | "bear" | "neutral" } {
  if (row.entityType === "institution") {
    const suffix = row.putCall ? ` · ${row.putCall}` : "";
    return { text: (row.txnType === "buy" ? "Bestand erhöht" : row.txnType === "sell" ? "Bestand reduziert" : "Bestand verändert") + suffix, tone: "neutral" };
  }
  if (row.entityType === "corporate_insider") {
    const code = row.transactionCode;
    if (!code) return { text: row.txnType === "buy" ? "Zugang gemeldet" : row.txnType === "sell" ? "Abgang gemeldet" : "Änderung gemeldet", tone: "neutral" };
    const codes: Record<string, string> = { A: "Zuteilung", F: "Steuereinbehalt / Ausübung", D: "Abgabe an Emittenten", G: "Schenkung", M: "Ausübung / Umwandlung", C: "Umwandlung", X: "Optionsausübung", J: "Sonstiger Vorgang" };
    if (code !== "P" && code !== "S") return { text: codes[code] ?? `SEC-Code ${code}`, tone: "neutral" };
    if (row.isDerivative) return { text: `${code === "P" ? "Derivat erworben" : "Derivat veräußert"}`, tone: "neutral" };
  }
  return signalLabel(row.txnType, row.putCall);
}
export function isStaleDate(value: string | null | undefined, days = 7): boolean {
  return !value || !Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now() + 86400000 || Date.now() - Date.parse(value) > days * 86400000;
}
export function sourceLink(value: string | null | undefined): string | null {
  if (!value) return null;
  try { const u = new URL(value); return u.protocol === "https:" ? u.toString() : null; } catch { return null; }
}
